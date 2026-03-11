import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createNotification, createNotifications } from "@/lib/notify";

const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  // Support both binary (outcome: true/false) and multi-option (optionIndex: number)
  const { outcome, optionIndex } = body;

  const market = await prisma.market.findUnique({
    where: { id },
    include: { positions: { include: { user: true } } },
  });

  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (market.creatorId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (market.status !== "OPEN") {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mkt = market as any;
  const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;

  if (isMultiOption) {
    // optionIndex === -1 means "None" — no winner
    if (optionIndex === undefined || optionIndex < -1 || optionIndex >= mkt.options.length) {
      return NextResponse.json({ error: "Invalid winning option" }, { status: 400 });
    }
  }

  const isNoneOutcome = isMultiOption && optionIndex === -1;
  const winningOutcome = isNoneOutcome ? -1 : (isMultiOption ? optionIndex : (outcome ? 1 : 0));
  const winningLabel = isNoneOutcome ? "None" : (isMultiOption ? (mkt.options as string[])[optionIndex] : (outcome ? "YES" : "NO"));

  await prisma.market.update({
    where: { id },
    data: {
      status: "RESOLVED",
      outcome: winningOutcome,
      outcomeLabel: winningLabel,
      resolvedAt: new Date(),
    },
  });

  // ── Payout calculation (for response info only — actual transfers happen in /api/redeem) ──
  // Winners split the totalVolume proportionally based on their winning shares.
  // payout_i = (shares_i / totalWinningShares) × pot × (1 - settlementFee)
  // This guarantees solvency: total payouts ≤ total money deposited.
  const pot = Math.round(market.totalVolume * (1 - FEE_PERCENT));

  // Calculate total winning shares
  let totalWinningShares = 0;
  for (const pos of market.positions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    if (isMultiOption) {
      const optShares = (p.optionShares as Record<string, number>) || {};
      totalWinningShares += optShares[String(winningOutcome)] || 0;
    } else {
      totalWinningShares += outcome ? pos.yesShares : pos.noShares;
    }
  }

  // Calculate expected payouts for response (no transfers here — redeem handles that)
  const payoutSummary = market.positions
    .map((pos) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = pos as any;
      let winningShares = 0;
      if (isMultiOption) {
        const optShares = (p.optionShares as Record<string, number>) || {};
        winningShares = optShares[String(winningOutcome)] || 0;
      } else {
        winningShares = outcome ? pos.yesShares : pos.noShares;
      }
      if (winningShares <= 0) return null;
      const grossPayout = totalWinningShares > 0
        ? Math.round((winningShares / totalWinningShares) * pot)
        : 0;
      const feeAmount = Math.round(grossPayout * FEE_PERCENT);
      const netPayout = grossPayout - feeAmount;
      return { username: pos.user.username, winningShares, grossPayout, fee: feeAmount, netPayout };
    })
    .filter(Boolean);

  // Notify all position holders about resolution
  const notificationBatch = market.positions.map((pos) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    let winningShares = 0;
    if (isMultiOption) {
      const optShares = (p.optionShares as Record<string, number>) || {};
      winningShares = optShares[String(winningOutcome)] || 0;
    } else {
      winningShares = outcome ? pos.yesShares : pos.noShares;
    }
    const isWinner = winningShares > 0;
    return {
      userId: pos.userId,
      type: isWinner ? "WINNINGS" as const : "MARKET_RESOLVED" as const,
      title: isWinner ? "You Won!" : "Market Resolved",
      message: isWinner
        ? `You won in "${market.title}" — outcome: ${winningLabel}. Redeem your winnings from your portfolio!`
        : `"${market.title}" resolved: ${winningLabel}`,
      link: isWinner ? `/portfolio` : `/markets/${id}`,
    };
  });

  if (notificationBatch.length > 0) {
    createNotifications(notificationBatch);
  }

  // Notify market creator
  createNotification({
    userId: session.userId,
    type: "MARKET_RESOLVED",
    title: "Market Resolved",
    message: `Your market "${market.title}" has been resolved: ${winningLabel}`,
    link: `/markets/${id}`,
  });

  return NextResponse.json({
    ok: true,
    outcome: winningLabel,
    winnersCount: payoutSummary.length,
    pot,
    totalWinningShares,
    feePercent: Math.round(FEE_PERCENT * 100),
    payouts: payoutSummary,
  });
}
