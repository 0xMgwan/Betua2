import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always compute fresh — never serve a cached snapshot
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [marketVolumeResult, depositsResult, openMarkets, totalTrades, resolvedMarkets, activeTraderGroups] = await Promise.all([
      prisma.market.aggregate({ _sum: { totalVolume: true } }),
      prisma.transaction.aggregate({
        _sum: { amountTzs: true },
        where: { type: "DEPOSIT", status: "COMPLETED" },
      }),
      prisma.market.count({ where: { status: "OPEN" } }),
      // Total real trades — exclude LP seed trades
      prisma.trade.count({ where: { isLpSeed: false } }),
      prisma.market.count({ where: { status: "RESOLVED" } }),
      // Active traders = distinct users who placed at least one real (non-seed) trade
      prisma.trade.groupBy({ by: ["userId"], where: { isLpSeed: false } }),
    ]);

    const marketVolume = marketVolumeResult._sum.totalVolume || 0;
    const totalDeposits = depositsResult._sum.amountTzs || 0;
    const totalVolume = marketVolume + totalDeposits;
    const totalTraders = activeTraderGroups.length;

    return NextResponse.json({
      totalVolume,
      openMarkets,
      totalTraders,
      totalTrades,
      resolvedMarkets,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json({ totalVolume: 0, openMarkets: 0, totalTraders: 0, totalTrades: 0, resolvedMarkets: 0 });
  }
}
