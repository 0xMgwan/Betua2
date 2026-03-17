/**
 * Redeem Position API
 * POST /api/v1/positions/:id/redeem - Redeem winnings from a resolved market
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: positionId } = await params;
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const body = await req.json();
    const { externalId } = body;

    if (!externalId) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 400, Date.now() - startTime, req);
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
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 404, Date.now() - startTime, req);
      return apiError("User not found", 404);
    }

    // Get position with market
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { market: true },
    });

    if (!position) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 404, Date.now() - startTime, req);
      return apiError("Position not found", 404);
    }

    if (position.userId !== mapping.userId) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 403, Date.now() - startTime, req);
      return apiError("Position does not belong to this user", 403);
    }

    if (position.market.status !== "RESOLVED") {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 400, Date.now() - startTime, req);
      return apiError("Market not resolved yet");
    }

    if (position.redeemed) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 400, Date.now() - startTime, req);
      return apiError("Already redeemed");
    }

    // Atomically mark as redeemed
    const lockResult = await prisma.position.updateMany({
      where: { id: positionId, redeemed: false },
      data: { redeemed: true },
    });

    if (lockResult.count === 0) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 400, Date.now() - startTime, req);
      return apiError("Already redeemed (concurrent request)");
    }

    // Calculate payout
    const outcome = position.market.outcome;
    const isMultiOption = Array.isArray(position.market.options) && (position.market.options as string[]).length >= 2;
    let winningShares = 0;

    if (isMultiOption) {
      const optShares = (position.optionShares as Record<string, number>) || {};
      winningShares = optShares[String(outcome)] || 0;
    } else {
      winningShares = outcome === 1 ? position.yesShares : position.noShares;
    }

    if (winningShares === 0) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 400, Date.now() - startTime, req);
      return apiError("No winning shares to redeem");
    }

    // Get total winning shares
    const allPositions = await prisma.position.findMany({
      where: { marketId: position.marketId },
    });

    let totalWinningShares = 0;
    for (const pos of allPositions) {
      if (isMultiOption) {
        const optShares = (pos.optionShares as Record<string, number>) || {};
        totalWinningShares += optShares[String(outcome)] || 0;
      } else {
        totalWinningShares += outcome === 1 ? pos.yesShares : pos.noShares;
      }
    }

    // Calculate payout
    const pot = Math.round(position.market.totalVolume * (1 - FEE_PERCENT));
    const grossPayout = totalWinningShares > 0
      ? Math.round((winningShares / totalWinningShares) * pot)
      : 0;
    const settlementFee = Math.round(grossPayout * FEE_PERCENT);
    const payoutTzs = grossPayout - settlementFee;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: mapping.userId },
    });

    if (!user || !user.ntzsUserId) {
      await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 404, Date.now() - startTime, req);
      return apiError("User wallet not found", 404);
    }

    // Transfer payout via nTZS
    if (PLATFORM_NTZS_USER_ID) {
      try {
        await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: user.ntzsUserId,
          amountTzs: payoutTzs,
        });

        // Transfer settlement fee
        if (SETTLEMENT_FEE_NTZS_USER_ID && settlementFee > 0) {
          ntzs.transfers.create({
            fromUserId: PLATFORM_NTZS_USER_ID,
            toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
            amountTzs: settlementFee,
          }).catch((err) => console.error("Settlement fee transfer failed:", err));
        }
      } catch (err) {
        console.error("Redeem transfer failed:", err);
        // Revert redemption status
        await prisma.position.update({
          where: { id: positionId },
          data: { redeemed: false },
        });
        await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 500, Date.now() - startTime, req);
        return apiError("Transfer failed", 500);
      }
    }

    // Update local balance and create transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: mapping.userId },
        data: { balanceTzs: { increment: payoutTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: mapping.userId,
          type: "REDEEM",
          amountTzs: payoutTzs,
          status: "COMPLETED",
          recipientUsername: position.market.title,
        },
      }),
    ]);

    await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 200, Date.now() - startTime, req);
    return apiSuccess({
      positionId,
      marketId: position.marketId,
      marketTitle: position.market.title,
      winningShares,
      grossPayout,
      settlementFee,
      netPayout: payoutTzs,
      redeemedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error("Redeem error:", err);
    await logApiRequest(partner.partnerId, `/api/v1/positions/${positionId}/redeem`, "POST", 500, Date.now() - startTime, req);
    return apiError("Redeem failed", 500);
  }
}
