import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/amm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      creator: { select: { username: true, avatarUrl: true, displayName: true } },
      _count: { select: { trades: true, comments: true } },
      trades: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { username: true, avatarUrl: true } } },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { username: true, avatarUrl: true } } },
      },
    },
  });

  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    market: { ...market, price: getPrice(market.yesPool, market.noPool) },
  });
}
