import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, displayName: true, avatarUrl: true,
      _count: { select: { trades: true, marketsCreated: true } },
      trades: {
        select: { amountTzs: true },
      },
    },
  });

  const enriched = users
    .map((u: typeof users[number]) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      totalVolume: u.trades.reduce((sum: number, t: { amountTzs: number }) => sum + t.amountTzs, 0),
      totalTrades: u._count.trades,
      marketsCreated: u._count.marketsCreated,
    }))
    .filter((u: { totalTrades: number }) => u.totalTrades > 0) // Only show users with at least 1 trade
    .sort((a: { totalVolume: number }, b: { totalVolume: number }) => b.totalVolume - a.totalVolume);

  const ranked = enriched.map((u: typeof enriched[number], i: number) => ({ ...u, rank: i + 1 }));

  return NextResponse.json({ leaderboard: ranked });
}
