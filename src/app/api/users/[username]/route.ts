import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { trades: true, marketsCreated: true, comments: true } },
      trades: {
        select: { amountTzs: true, side: true, createdAt: true, market: { select: { title: true, id: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const totalVolume = await prisma.trade.aggregate({
    where: { userId: user.id },
    _sum: { amountTzs: true },
  });

  const marketsTraded = await prisma.trade.findMany({
    where: { userId: user.id },
    select: { marketId: true },
    distinct: ["marketId"],
  });

  return NextResponse.json({
    user: {
      ...user,
      totalVolume: totalVolume._sum.amountTzs || 0,
      marketsTraded: marketsTraded.length,
    },
  });
}
