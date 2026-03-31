import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { positionId } = await req.json();

    if (!positionId) {
      return NextResponse.json({ error: "Position ID required" }, { status: 400 });
    }

    // Get position with market details
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { market: true },
    });

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    if (position.userId !== session.userId) {
      return NextResponse.json({ error: "Not your position" }, { status: 403 });
    }

    if (position.market.status !== "RESOLVED") {
      return NextResponse.json({ error: "Market not resolved yet" }, { status: 400 });
    }

    if (position.redeemed) {
      return NextResponse.json({ error: "Already redeemed" }, { status: 400 });
    }

    // Atomically mark as redeemed FIRST to prevent race conditions
    // Only update if redeemed is still false (prevents double-click exploit)
    const lockResult = await prisma.position.updateMany({
      where: { 
        id: positionId, 
        redeemed: false  // Only update if not already redeemed
      },
      data: { redeemed: true }
    });

    // If no rows were updated, someone else already redeemed it
    if (lockResult.count === 0) {
      return NextResponse.json({ error: "Already redeemed (concurrent request)" }, { status: 400 });
    }

    // Calculate payout using proportional pot distribution
    const outcome = position.market.outcome;
    const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;
    const isMultiOption = !!(position.market.options && (position.market.options as string[]).length >= 2);
    let winningShares = 0;

    if (isMultiOption) {
      // Multi-option market: outcome is the index of the winning option
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optShares = (position.optionShares as any) || {};
      winningShares = optShares[String(outcome)] || 0;
    } else {
      // Binary market: outcome is 0 (NO) or 1 (YES)
      if (outcome === 1) {
        winningShares = position.yesShares;
      } else if (outcome === 0) {
        winningShares = position.noShares;
      } else {
        return NextResponse.json({ error: "Invalid market outcome" }, { status: 400 });
      }
    }

    if (winningShares === 0) {
      return NextResponse.json({ error: "No winning shares to redeem" }, { status: 400 });
    }

    // Fetch all positions to calculate total winning shares
    const allPositions = await prisma.position.findMany({
      where: { marketId: position.marketId },
    });

    let totalWinningShares = 0;
    for (const pos of allPositions) {
      if (isMultiOption) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const optShares = (pos.optionShares as any) || {};
        totalWinningShares += optShares[String(outcome)] || 0;
      } else {
        totalWinningShares += outcome === 1 ? pos.yesShares : pos.noShares;
      }
    }

    // Pot = totalVolume minus entry fees already taken
    const pot = Math.round(position.market.totalVolume * (1 - FEE_PERCENT));
    // This user's proportional payout
    const grossPayout = totalWinningShares > 0
      ? Math.round((winningShares / totalWinningShares) * pot)
      : 0;
    // Settlement fee
    const settlementFee = Math.round(grossPayout * FEE_PERCENT);
    const payoutTzs = grossPayout - settlementFee;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.ntzsUserId) {
      return NextResponse.json({ error: "User wallet not found" }, { status: 404 });
    }

    // Transfer payout from platform escrow → user via nTZS
    let ntzsTransferId: string | undefined;
    if (PLATFORM_NTZS_USER_ID) {
      try {
        const transfer = await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: user.ntzsUserId,
          amountTzs: payoutTzs,
        });
        ntzsTransferId = transfer.id;
      } catch (err) {
        console.error("Redeem transfer failed:", err);
        return NextResponse.json({ error: "Transfer failed" }, { status: 500 });
      }
    }

    // Transfer settlement fee from platform escrow → settlement fee wallet (non-blocking)
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && settlementFee > 0) {
      ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
        amountTzs: settlementFee,
      }).catch((feeErr) => {
        console.error("Settlement fee transfer failed (non-fatal):", feeErr);
      });
    }

    // Determine user's currency and calculate payout
    const userCurrency: Currency = getUserCurrency(user.country);
    const payoutInUserCurrency = userCurrency === 'KES' 
      ? convertCurrency(payoutTzs, 'TZS', 'KES') 
      : payoutTzs;

    // Add balance and create transaction record (position already marked as redeemed above)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: userCurrency === 'KES'
          ? { balanceKes: { increment: payoutInUserCurrency } }
          : { balanceTzs: { increment: payoutTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "REDEEM",
          amountTzs: userCurrency === 'TZS' ? payoutTzs : 0,
          amountKes: userCurrency === 'KES' ? payoutInUserCurrency : 0,
          currency: userCurrency,
          status: "COMPLETED",
          recipientUsername: isMultiOption
            ? `${position.market.title} (${(position.market.options as string[])[outcome as number]})`
            : `${position.market.title} (${outcome === 1 ? "YES" : "NO"})`,
        },
      }),
    ]);

    // Notification: redemption successful
    createNotification({
      userId: session.userId,
      type: "REDEEM",
      title: "Winnings Redeemed!",
      message: `Redeemed ${payoutInUserCurrency.toLocaleString()} ${userCurrency} from "${position.market.title}"`,
      link: `/wallet`,
    });

    return NextResponse.json({
      success: true,
      payout: payoutInUserCurrency,
      payoutTzs,
      currency: userCurrency,
      winningShares,
      positionId,
      ntzsTransferId,
    });
  } catch (err) {
    console.error("Redeem error:", err);
    return NextResponse.json({ error: "Redeem failed. Please try again." }, { status: 500 });
  }
}
