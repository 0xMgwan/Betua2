import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
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
    if (optionIndex === undefined || optionIndex < 0 || optionIndex >= mkt.options.length) {
      return NextResponse.json({ error: "Invalid winning option" }, { status: 400 });
    }
  }

  const winningOutcome = isMultiOption ? optionIndex : (outcome ? 1 : 0);
  const winningLabel = isMultiOption ? (mkt.options as string[])[optionIndex] : (outcome ? "YES" : "NO");

  await prisma.market.update({
    where: { id },
    data: {
      status: "RESOLVED",
      outcome: winningOutcome,
      outcomeLabel: winningLabel,
      resolvedAt: new Date(),
    },
  });

  // Determine winners
  const payoutResults: Array<{
    username: string;
    grossPayout: number;
    fee: number;
    netPayout: number;
    status: "paid" | "failed";
    error?: string;
  }> = [];

  for (const pos of market.positions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    let winningShares = 0;

    if (isMultiOption) {
      const optShares = (p.optionShares as Record<string, number>) || {};
      winningShares = optShares[String(optionIndex)] || 0;
    } else {
      winningShares = outcome ? pos.yesShares : pos.noShares;
    }

    if (winningShares <= 0) continue;

    const grossPayout = winningShares;
    const feeAmount = Math.round(grossPayout * FEE_PERCENT);
    const netPayout = grossPayout - feeAmount;

    if (!pos.user.ntzsUserId || !PLATFORM_NTZS_USER_ID) {
      await prisma.user.update({
        where: { id: pos.user.id },
        data: { balanceTzs: { increment: netPayout } },
      });
      payoutResults.push({ username: pos.user.username, grossPayout, fee: feeAmount, netPayout, status: "paid" });
      continue;
    }

    try {
      await ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: pos.user.ntzsUserId,
        amountTzs: netPayout,
      });

      if (SETTLEMENT_FEE_NTZS_USER_ID && feeAmount > 0) {
        await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
          amountTzs: feeAmount,
        }).catch((err) => console.error("Settlement fee transfer failed (non-fatal):", err));
      }

      await prisma.user.update({
        where: { id: pos.user.id },
        data: { balanceTzs: { increment: netPayout } },
      });

      payoutResults.push({ username: pos.user.username, grossPayout, fee: feeAmount, netPayout, status: "paid" });
    } catch (err) {
      const errMsg = err instanceof NtzsApiError ? err.message : "Transfer failed";
      console.error(`Payout failed for ${pos.user.username}:`, err);
      payoutResults.push({ username: pos.user.username, grossPayout, fee: feeAmount, netPayout, status: "failed", error: errMsg });
    }
  }

  const totalPaid = payoutResults.reduce((sum, r) => r.status === "paid" ? sum + r.netPayout : sum, 0);
  const totalFees = payoutResults.reduce((sum, r) => r.status === "paid" ? sum + r.fee : sum, 0);

  return NextResponse.json({
    ok: true,
    outcome: winningLabel,
    winnersCount: payoutResults.filter(r => r.status === "paid").length,
    totalPaid,
    totalFees,
    feePercent: Math.round(FEE_PERCENT * 100),
    payouts: payoutResults,
  });
}
