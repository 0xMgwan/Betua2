import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs } from "@/lib/ntzs";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";

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

    // Calculate payout
    const outcome = position.market.outcome;
    let winningShares = 0;

    if (outcome === 1) {
      winningShares = position.yesShares;
    } else if (outcome === 0) {
      winningShares = position.noShares;
    } else {
      return NextResponse.json({ error: "Invalid market outcome" }, { status: 400 });
    }

    if (winningShares === 0) {
      return NextResponse.json({ error: "No winning shares to redeem" }, { status: 400 });
    }

    // Each winning share is worth 1 TZS
    const payoutTzs = Math.round(winningShares);

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

    // Mark position as redeemed, add balance, create transaction record
    const [updatedPosition] = await prisma.$transaction([
      prisma.position.update({
        where: { id: positionId },
        data: { redeemed: true },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceTzs: { increment: payoutTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "REDEEM",
          amountTzs: payoutTzs,
          status: "COMPLETED",
          recipientUsername: `${position.market.title} (${outcome === 1 ? "YES" : "NO"})`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      payout: payoutTzs,
      winningShares,
      position: updatedPosition,
      ntzsTransferId,
    });
  } catch (err) {
    console.error("Redeem error:", err);
    return NextResponse.json({ error: "Redeem failed. Please try again." }, { status: 500 });
  }
}
