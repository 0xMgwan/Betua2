import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [feeTransactions, createdMarkets] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.userId, type: "CREATOR_FEE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.market.findMany({
      where: { creatorId: session.userId },
      select: {
        id: true,
        title: true,
        status: true,
        totalVolume: true,
        createdAt: true,
        resolvesAt: true,
        category: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalEarned = feeTransactions.reduce((s, tx) => s + (tx.amountTzs || 0), 0);
  const marketsResolved = createdMarkets.filter((m) => m.status === "RESOLVED").length;

  // Attach fee amount to each market for display
  const marketsWithFees = createdMarkets.map((m) => {
    const feeTx = feeTransactions.find(
      (tx) => tx.recipientUsername === `Creator reward: ${m.title}`
    );
    return {
      ...m,
      creatorFeeEarned: feeTx?.amountTzs ?? null,
      feeEarnedAt: feeTx?.createdAt ?? null,
    };
  });

  return NextResponse.json({
    totalEarned,
    marketsCreated: createdMarkets.length,
    marketsResolved,
    rewardCount: feeTransactions.length,
    markets: marketsWithFees,
    transactions: feeTransactions,
  });
}
