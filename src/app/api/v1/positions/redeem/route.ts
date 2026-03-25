/**
 * Partner Redeem Winnings API
 * POST /api/v1/positions/redeem - Redeem winnings from resolved market
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) return apiError("Invalid or missing API key", 401);

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/positions/redeem", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { externalId, positionId } = await req.json();

    if (!externalId || !positionId) {
      return apiError("externalId and positionId are required", 400);
    }

    // Find user mapping
    const mapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId } },
    });
    if (!mapping) return apiError("User not found", 404);

    // Get position with market
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { market: true },
    });

    if (!position) return apiError("Position not found", 404);
    if (position.userId !== mapping.userId) return apiError("Not your position", 403);
    if (position.market.status !== "RESOLVED") return apiError("Market not resolved yet", 400);
    if (position.redeemed) return apiError("Already redeemed", 400);

    // Lock position to prevent double redemption
    const lockResult = await prisma.position.updateMany({
      where: { id: positionId, redeemed: false },
      data: { redeemed: true },
    });
    if (lockResult.count === 0) return apiError("Already redeemed (concurrent request)", 400);

    // Calculate payout
    const outcome = position.market.outcome;
    const isMultiOption = !!(position.market.options && (position.market.options as string[]).length >= 2);
    let winningShares = 0;

    if (isMultiOption) {
      const optShares = (position.optionShares as Record<string, number>) || {};
      winningShares = optShares[String(outcome)] || 0;
    } else {
      winningShares = outcome === 1 ? position.yesShares : position.noShares;
    }

    if (winningShares === 0) {
      // Revert the redeemed flag since no payout
      await prisma.position.update({ where: { id: positionId }, data: { redeemed: false } });
      return apiError("No winning shares to redeem", 400);
    }

    // Calculate total winning shares
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

    const pot = Math.round(position.market.totalVolume * (1 - FEE_PERCENT));
    const grossPayout = totalWinningShares > 0 ? Math.round((winningShares / totalWinningShares) * pot) : 0;
    const settlementFee = Math.round(grossPayout * FEE_PERCENT);
    const payoutTzs = grossPayout - settlementFee;

    // Get user
    const user = await prisma.user.findUnique({ where: { id: mapping.userId } });
    if (!user?.ntzsUserId) return apiError("User wallet not found", 404);

    // Transfer payout
    let ntzsTransferId: string | undefined;
    if (PLATFORM_NTZS_USER_ID && payoutTzs > 0) {
      try {
        const transfer = await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: user.ntzsUserId,
          amountTzs: payoutTzs,
        });
        ntzsTransferId = transfer.id;
      } catch (err) {
        // Revert redeemed flag on failure
        await prisma.position.update({ where: { id: positionId }, data: { redeemed: false } });
        console.error("Redeem transfer failed:", err);
        return apiError("Transfer failed", 500);
      }
    }

    // Record transaction
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
          recipientUsername: isMultiOption
            ? `${position.market.title} (${(position.market.options as string[])[outcome as number]})`
            : `${position.market.title} (${outcome === 1 ? "YES" : "NO"})`,
        },
      }),
    ]);

    await logApiRequest(partner.partnerId, "/api/v1/positions/redeem", "POST", 200, Date.now() - startTime, req);
    return apiSuccess({
      positionId,
      externalId,
      marketId: position.marketId,
      marketTitle: position.market.title,
      winningShares,
      grossPayout,
      settlementFee,
      payoutTzs,
      ntzsTransferId,
    });

  } catch (err) {
    console.error("Partner redeem error:", err);
    return apiError("Redeem failed", 500);
  }
}
