import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [seedTxs, redeemTxs, seededMarkets] = await Promise.all([
    // All seed deposits
    prisma.transaction.findMany({
      where: { userId: session.userId, type: "SEED_LIQUIDITY" },
      orderBy: { createdAt: "desc" },
    }),
    // All LP payouts returned
    prisma.transaction.findMany({
      where: { userId: session.userId, type: "LP_REDEEM" },
      orderBy: { createdAt: "desc" },
    }),
    // Markets where this user seeded (has seedAmount > 0 and is creator)
    prisma.market.findMany({
      where: { creatorId: session.userId, seedAmount: { gt: 0 } },
      select: {
        id: true,
        title: true,
        status: true,
        outcome: true,
        outcomeLabel: true,
        totalVolume: true,
        seedAmount: true,
        category: true,
        createdAt: true,
        resolvesAt: true,
        resolvedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalSeeded = seedTxs.reduce((s, tx) => s + (tx.amountTzs || 0), 0);
  const totalReturned = redeemTxs.reduce((s, tx) => s + (tx.amountTzs || 0), 0);
  const netPnl = totalReturned - totalSeeded; // negative = cost of providing LP, positive = profit

  // Match redeem txs to markets for per-market breakdown
  const marketsWithLp = seededMarkets.map((m) => {
    const seedTx = seedTxs.find((tx) =>
      tx.recipientUsername === m.title || tx.recipientUsername?.includes(m.title.slice(0, 30))
    );
    const redeemTx = redeemTxs.find((tx) =>
      tx.recipientUsername?.includes(m.title.slice(0, 30))
    );
    const seeded = seedTx?.amountTzs ?? m.seedAmount;
    const returned = redeemTx?.amountTzs ?? null;
    const pnl = returned !== null ? returned - seeded : null;
    return {
      ...m,
      seeded,
      returned,
      pnl,
      returnedAt: redeemTx?.createdAt ?? null,
    };
  });

  return NextResponse.json({
    totalSeeded,
    totalReturned,
    netPnl,
    marketsSeeded: seededMarkets.length,
    marketsResolved: seededMarkets.filter((m) => m.status === "RESOLVED").length,
    markets: marketsWithLp,
  });
}
