/**
 * Trades API
 * POST /api/v1/trades - Place a trade
 * GET /api/v1/trades - Get trade history for a user
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import { getPartnerMarkup } from "@/lib/partnerFees";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const body = await req.json();
    const { externalId, marketId, side, amountTzs, optionIndex } = body;

    // Validate required fields
    if (!externalId || !marketId || !amountTzs) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
      return apiError("externalId, marketId, and amountTzs are required");
    }

    if (amountTzs < 100) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
      return apiError("Minimum trade amount is 100 TZS");
    }

    // Find user mapping
    const mapping = await prisma.partnerUser.findUnique({
      where: {
        partnerId_externalId: {
          partnerId: partner.partnerId,
          externalId,
        },
      },
    });

    if (!mapping) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 404, Date.now() - startTime, req);
      return apiError("User not found. Create user first via POST /api/v1/users", 404);
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: mapping.userId },
      select: { id: true, balanceTzs: true, ntzsUserId: true },
    });

    if (!user) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 404, Date.now() - startTime, req);
      return apiError("User not found", 404);
    }

    // Get market
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 404, Date.now() - startTime, req);
      return apiError("Market not found", 404);
    }

    if (market.status !== "OPEN") {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
      return apiError("Market is not open for trading");
    }

    if (new Date(market.resolvesAt) < new Date()) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
      return apiError("Market has expired");
    }

    // Partner markup: charged on top of the stake, 100% to the market's owning
    // partner. Kept separate from the pot, so AMM/solvency math is untouched.
    const { tradingMarkupPercent } = await getPartnerMarkup(market.partnerId);
    const markupAmount = Math.round(amountTzs * (tradingMarkupPercent / 100));

    // Pooled model: funds are already in the settlement pool; spend against the
    // DB balance ledger (matches the in-app /api/trades flow).
    const availableBalance = user.balanceTzs || 0;
    const totalDebit = amountTzs + markupAmount;
    if (availableBalance < totalDebit) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
      return apiError(`Insufficient balance. Need ${totalDebit} TZS (incl. ${markupAmount} fee), have ${availableBalance} TZS`);
    }

    // Calculate fees and shares
    const feeAmount = Math.round(amountTzs * FEE_PERCENT);
    const netAmount = amountTzs - feeAmount;

    const isMultiOption = Array.isArray(market.options) && (market.options as string[]).length >= 2;
    let sharesOut = 0;
    let newYesPool = market.yesPool;
    let newNoPool = market.noPool;
    let newOptionPools = market.optionPools as number[] | null;

    if (isMultiOption) {
      if (optionIndex === undefined || optionIndex < 0 || optionIndex >= (market.options as string[]).length) {
        await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
        return apiError("optionIndex is required for multi-option markets");
      }
      const pools = (market.optionPools as number[]) || [];
      const result = getMultiOptionSharesOut(netAmount, optionIndex, pools);
      sharesOut = result.shares;
      newOptionPools = result.newPools;
    } else {
      if (!side || !["YES", "NO"].includes(side.toUpperCase())) {
        await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
        return apiError("side must be YES or NO for binary markets");
      }
      const isYes = side.toUpperCase() === "YES";
      const result = isYes
        ? getSharesOut(netAmount, market.noPool, market.yesPool)
        : getSharesOut(netAmount, market.yesPool, market.noPool);
      sharesOut = result.shares;
      newYesPool = isYes ? result.newPoolOut : result.newPoolIn;
      newNoPool = isYes ? result.newPoolIn : result.newPoolOut;
    }

    // Fixed-odds payout locked in at trade time: each winning share resolves to
    // 1 TZS, net of the 5% settlement fee. Redeem pays this directly (guaranteed
    // odds), backed by the platform pool — never diluted by the market's seed.
    const payoutIfWin = Math.round(sharesOut * (1 - FEE_PERCENT));

    // Execute trade in transaction
    const trade = await prisma.$transaction(async (tx) => {
      // Update market pools
      await tx.market.update({
        where: { id: marketId },
        data: {
          yesPool: newYesPool,
          noPool: newNoPool,
          optionPools: newOptionPools ?? undefined,
          totalVolume: { increment: amountTzs },
        },
      });

      // Update or create position
      const existingPosition = await tx.position.findUnique({
        where: { userId_marketId: { userId: user.id, marketId } },
      });

      if (existingPosition) {
        if (isMultiOption) {
          const currentShares = (existingPosition.optionShares as Record<string, number>) || {};
          currentShares[String(optionIndex)] = (currentShares[String(optionIndex)] || 0) + sharesOut;
          const currentImplied = (existingPosition.optionImpliedPayouts as Record<string, number>) || {};
          currentImplied[String(optionIndex)] = (currentImplied[String(optionIndex)] || 0) + payoutIfWin;
          await tx.position.update({
            where: { id: existingPosition.id },
            data: { optionShares: currentShares, optionImpliedPayouts: currentImplied },
          });
        } else {
          const isYes = side.toUpperCase() === "YES";
          await tx.position.update({
            where: { id: existingPosition.id },
            data: isYes
              ? { yesShares: { increment: sharesOut }, yesImpliedPayout: { increment: payoutIfWin } }
              : { noShares: { increment: sharesOut }, noImpliedPayout: { increment: payoutIfWin } },
          });
        }
      } else {
        const positionData: any = {
          userId: user.id,
          marketId,
          yesShares: 0,
          noShares: 0,
        };
        if (isMultiOption) {
          positionData.optionShares = { [String(optionIndex)]: sharesOut };
          positionData.optionImpliedPayouts = { [String(optionIndex)]: payoutIfWin };
        } else {
          const isYes = side.toUpperCase() === "YES";
          if (isYes) { positionData.yesShares = sharesOut; positionData.yesImpliedPayout = payoutIfWin; }
          else { positionData.noShares = sharesOut; positionData.noImpliedPayout = payoutIfWin; }
        }
        await tx.position.create({ data: positionData });
      }

      // Deduct local balance (stake + partner markup)
      await tx.user.update({
        where: { id: user.id },
        data: { balanceTzs: { decrement: totalDebit } },
      });

      // Credit the owning partner's earnings with the markup + ledger entry
      if (markupAmount > 0 && market.partnerId) {
        await tx.partner.update({
          where: { id: market.partnerId },
          data: { earningsTzs: { increment: markupAmount } },
        });
        await tx.partnerEarning.create({
          data: {
            partnerId: market.partnerId,
            type: "TRADE_MARKUP",
            amountTzs: markupAmount,
            marketId,
            description: `${tradingMarkupPercent}% markup on trade · ${market.title}`,
          },
        });
      }

      // Create trade record
      const tradeRecord = await tx.trade.create({
        data: {
          userId: user.id,
          marketId,
          side: isMultiOption ? `OPTION_${optionIndex}` : side.toUpperCase(),
          amountTzs,
          shares: sharesOut,
          price: amountTzs / sharesOut,
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "BUY_SHARES",
          amountTzs,
          status: "COMPLETED",
          recipientUsername: market.title,
        },
      });

      return tradeRecord;
    });

    // Pooled model: the stake is already in the settlement pool (credited at
    // deposit), so there's no per-user→pool transfer here. Just forward the 5%
    // fee from the pool to the settlement-fee wallet (non-blocking).
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && feeAmount > 0) {
      ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
        amountTzs: feeAmount,
      }).catch((err) => console.error("Fee transfer failed:", err));
    }

    await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 201, Date.now() - startTime, req);
    return apiSuccess({
      tradeId: trade.id,
      marketId,
      side: isMultiOption ? `OPTION_${optionIndex}` : side.toUpperCase(),
      amountTzs,
      shares: sharesOut,
      price: amountTzs / sharesOut,
      fee: feeAmount,
      createdAt: trade.createdAt,
    }, 201);

  } catch (err: any) {
    console.error("Trade error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 500, Date.now() - startTime, req);
    return apiError(err.message || "Failed to place trade", 500);
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/trades", "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { searchParams } = new URL(req.url);
    const externalId = searchParams.get("externalId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!externalId) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "GET", 400, Date.now() - startTime, req);
      return apiError("externalId is required");
    }

    // Find user mapping
    const mapping = await prisma.partnerUser.findUnique({
      where: {
        partnerId_externalId: {
          partnerId: partner.partnerId,
          externalId,
        },
      },
    });

    if (!mapping) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "GET", 404, Date.now() - startTime, req);
      return apiError("User not found", 404);
    }

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { userId: mapping.userId },
        include: {
          market: {
            select: { id: true, title: true, status: true, outcome: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.trade.count({ where: { userId: mapping.userId } }),
    ]);

    await logApiRequest(partner.partnerId, "/api/v1/trades", "GET", 200, Date.now() - startTime, req);
    return apiSuccess({
      trades: trades.map((t) => ({
        id: t.id,
        marketId: t.marketId,
        marketTitle: t.market.title,
        marketStatus: t.market.status,
        side: t.side,
        amountTzs: t.amountTzs,
        shares: t.shares,
        price: t.price,
        createdAt: t.createdAt,
      })),
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });

  } catch (err) {
    console.error("Trade history error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/trades", "GET", 500, Date.now() - startTime, req);
    return apiError("Failed to fetch trades", 500);
  }
}
