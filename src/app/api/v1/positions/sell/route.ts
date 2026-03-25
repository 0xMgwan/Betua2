/**
 * Partner Sell Position API
 * POST /api/v1/positions/sell - Sell shares (exit position early)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { getPayoutForShares, getMultiOptionPayoutForShares } from "@/lib/amm";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) return apiError("Invalid or missing API key", 401);

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/positions/sell", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { externalId, marketId, side, sharesToSell, optionIndex } = await req.json();

    if (!externalId || !marketId || !sharesToSell || sharesToSell < 1) {
      return apiError("externalId, marketId, and sharesToSell (>= 1) are required", 400);
    }

    // Find user mapping
    const mapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId } },
    });
    if (!mapping) return apiError("User not found", 404);

    const [market, user, position] = await Promise.all([
      prisma.market.findUnique({ where: { id: marketId } }),
      prisma.user.findUnique({ where: { id: mapping.userId }, select: { id: true, ntzsUserId: true } }),
      prisma.position.findUnique({ where: { userId_marketId: { userId: mapping.userId, marketId } } }),
    ]);

    if (!market) return apiError("Market not found", 404);
    if (market.status !== "OPEN") return apiError("Market is not open", 400);
    if (!user) return apiError("User not found", 404);
    if (!position) return apiError("No position in this market", 400);

    const isMultiOption = Array.isArray(market.options) && (market.options as string[]).length >= 2;

    // Validate shares
    let availableShares: number;
    let tradeSide: string;

    if (isMultiOption) {
      if (optionIndex === undefined || optionIndex < 0 || optionIndex >= (market.options as string[]).length) {
        return apiError("Invalid optionIndex", 400);
      }
      const optionShares = (position.optionShares as Record<string, number>) || {};
      availableShares = optionShares[String(optionIndex)] || 0;
      tradeSide = (market.options as string[])[optionIndex];
    } else {
      if (!side || (side !== "YES" && side !== "NO")) {
        return apiError("side must be YES or NO for binary markets", 400);
      }
      availableShares = side === "YES" ? position.yesShares : position.noShares;
      tradeSide = side;
    }

    if (sharesToSell > availableShares) {
      return apiError(`Only ${availableShares} ${tradeSide} shares available`, 400);
    }

    // Calculate payout via AMM
    let grossPayout: number;
    let avgPrice: number;
    let newPoolData: Record<string, number | number[]>;

    if (isMultiOption) {
      const pools = market.optionPools as number[];
      const result = getMultiOptionPayoutForShares(sharesToSell, optionIndex, pools);
      grossPayout = result.payout;
      avgPrice = result.avgPrice;
      newPoolData = { optionPools: result.newPools };
    } else {
      const result = side === "YES"
        ? getPayoutForShares(sharesToSell, market.yesPool, market.noPool)
        : getPayoutForShares(sharesToSell, market.noPool, market.yesPool);
      grossPayout = Math.round(result.payout);
      avgPrice = result.avgPrice;
      newPoolData = side === "YES"
        ? { yesPool: result.newPoolIn, noPool: result.newPoolOut }
        : { noPool: result.newPoolIn, yesPool: result.newPoolOut };
    }

    if (grossPayout <= 0) return apiError("Shares have no value at current price", 400);

    const feeAmount = Math.round(grossPayout * FEE_PERCENT);
    const netPayout = grossPayout - feeAmount;

    // Transfer payout
    let ntzsTransferId: string | undefined;
    if (PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      try {
        const transfer = await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: user.ntzsUserId,
          amountTzs: netPayout,
        });
        ntzsTransferId = transfer.id;
      } catch (err) {
        if (err instanceof NtzsApiError) return apiError(err.message || "Payout failed", 400);
        throw err;
      }
    }

    // Build position update
    let positionUpdate: Record<string, unknown>;
    if (isMultiOption) {
      const existingShares = (position.optionShares as Record<string, number>) || {};
      const updatedShares = { ...existingShares };
      updatedShares[String(optionIndex)] = Math.max(0, (updatedShares[String(optionIndex)] || 0) - sharesToSell);
      positionUpdate = { optionShares: updatedShares };
    } else {
      positionUpdate = side === "YES"
        ? { yesShares: { decrement: sharesToSell } }
        : { noShares: { decrement: sharesToSell } };
    }

    // Atomic DB update
    const [updatedMarket, , trade] = await prisma.$transaction([
      prisma.market.update({
        where: { id: marketId },
        data: { ...newPoolData, totalVolume: { decrement: netPayout } },
      }),
      prisma.position.update({
        where: { userId_marketId: { userId: mapping.userId, marketId } },
        data: positionUpdate,
      }),
      prisma.trade.create({
        data: {
          userId: mapping.userId,
          marketId,
          side: `SELL_${tradeSide}`,
          amountTzs: -netPayout,
          shares: -sharesToSell,
          price: avgPrice,
          ntzsTransferId,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: mapping.userId,
          type: "SELL_SHARES",
          amountTzs: netPayout,
          status: "COMPLETED",
          recipientUsername: `${market.title} (${tradeSide})`,
        },
      }),
      prisma.user.update({
        where: { id: mapping.userId },
        data: { balanceTzs: { increment: netPayout } },
      }),
    ]);

    await logApiRequest(partner.partnerId, "/api/v1/positions/sell", "POST", 200, Date.now() - startTime, req);
    return apiSuccess({
      tradeId: trade.id,
      externalId,
      marketId,
      side: tradeSide,
      sharesSold: sharesToSell,
      grossPayout,
      fee: feeAmount,
      netPayout,
      avgPrice,
      ntzsTransferId,
    });

  } catch (err) {
    console.error("Partner sell error:", err);
    return apiError("Sell failed", 500);
  }
}
