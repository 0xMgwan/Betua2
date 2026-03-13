import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [marketVolumeResult, depositsResult, openMarkets, totalTraders, totalTrades, resolvedMarkets] = await Promise.all([
      prisma.market.aggregate({ _sum: { totalVolume: true } }),
      prisma.transaction.aggregate({
        _sum: { amountTzs: true },
        where: { type: "DEPOSIT", status: "COMPLETED" },
      }),
      prisma.market.count({ where: { status: "OPEN" } }),
      prisma.user.count(),
      prisma.trade.count(),
      prisma.market.count({ where: { status: "RESOLVED" } }),
    ]);

    // Total volume = market volumes (active positions) + all deposits
    const marketVolume = marketVolumeResult._sum.totalVolume || 0;
    const totalDeposits = depositsResult._sum.amountTzs || 0;
    const totalVolume = marketVolume + totalDeposits;

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
