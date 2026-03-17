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

    if (!user || !user.ntzsUserId) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 404, Date.now() - startTime, req);
      return apiError("User wallet not found", 404);
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

    // Check balance via nTZS
    let availableBalance = user.balanceTzs;
    try {
      const ntzsUser = await ntzs.users.get(user.ntzsUserId);
      availableBalance = ntzsUser.balanceTzs;
    } catch {
      // Fall back to local balance
    }

    if (availableBalance < amountTzs) {
      await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
      return apiError(`Insufficient balance. Need ${amountTzs} TZS, have ${availableBalance} TZS`);
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
      const result = getMultiOptionSharesOut(pools, optionIndex, netAmount);
      sharesOut = result.shares;
      newOptionPools = result.newPools;
    } else {
      if (!side || !["YES", "NO"].includes(side.toUpperCase())) {
        await logApiRequest(partner.partnerId, "/api/v1/trades", "POST", 400, Date.now() - startTime, req);
        return apiError("side must be YES or NO for binary markets");
      }
      const isYes = side.toUpperCase() === "YES";
      const result = getSharesOut(market.yesPool, market.noPool, isYes, netAmount);
      sharesOut = result.shares;
      newYesPool = result.newYesPool;
      newNoPool = result.newNoPool;
    }

    // Execute trade in transaction
    const trade = await prisma.$transaction(async (tx) => {
      // Update market pools
      await tx.market.update({
        where: { id: marketId },
        data: {
          yesPool: newYesPool,
          noPool: newNoPool,
          optionPools: newOptionPools,
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
          await tx.position.update({
            where: { id: existingPosition.id },
            data: { optionShares: currentShares },
          });
        } else {
          const isYes = side.toUpperCase() === "YES";
          await tx.position.update({
            where: { id: existingPosition.id },
            data: isYes
              ? { yesShares: { increment: sharesOut } }
              : { noShares: { increment: sharesOut } },
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
        } else {
          const isYes = side.toUpperCase() === "YES";
          if (isYes) positionData.yesShares = sharesOut;
          else positionData.noShares = sharesOut;
        }
        await tx.position.create({ data: positionData });
      }

      // Deduct local balance
      await tx.user.update({
        where: { id: user.id },
        data: { balanceTzs: { decrement: amountTzs } },
      });

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

    // Transfer funds via nTZS (non-blocking)
    if (PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs,
        });

        // Transfer fee to settlement wallet
        if (SETTLEMENT_FEE_NTZS_USER_ID && feeAmount > 0) {
          ntzs.transfers.create({
            fromUserId: PLATFORM_NTZS_USER_ID,
            toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
            amountTzs: feeAmount,
          }).catch((err) => console.error("Fee transfer failed:", err));
        }
      } catch (err) {
        console.error("nTZS transfer failed:", err);
      }
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
