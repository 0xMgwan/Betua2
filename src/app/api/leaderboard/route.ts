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
    take: 50,
  });

  const ranked = users
    .map((u: typeof users[number]) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      totalVolume: u.trades.reduce((sum: number, t: { amountTzs: number }) => sum + t.amountTzs, 0),
      totalTrades: u._count.trades,
      marketsCreated: u._count.marketsCreated,
    }))
    .sort((a: { totalVolume: number }, b: { totalVolume: number }) => b.totalVolume - a.totalVolume)
    .map((u: typeof ranked[number], i: number) => ({ ...u, rank: i + 1 }));

  return NextResponse.json({ leaderboard: ranked });
}
