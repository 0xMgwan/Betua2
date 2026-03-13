import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [volumeResult, openMarkets, totalTraders, totalTrades, resolvedMarkets] = await Promise.all([
      prisma.market.aggregate({ _sum: { totalVolume: true } }),
      prisma.market.count({ where: { status: "OPEN" } }),
      prisma.user.count(),
      prisma.trade.count(),
      prisma.market.count({ where: { status: "RESOLVED" } }),
    ]);

    const totalVolume = volumeResult._sum.totalVolume || 0;

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
