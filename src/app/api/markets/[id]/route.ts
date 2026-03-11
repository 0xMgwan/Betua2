import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrice, getMultiOptionPrices } from "@/lib/amm";

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

  // Aggregate total shares per side for proportional payout calculation
  const positions = await prisma.position.findMany({
    where: { marketId: id },
  });
  let totalYesShares = 0;
  let totalNoShares = 0;
  const totalOptionShares: Record<string, number> = {};
  for (const pos of positions) {
    totalYesShares += pos.yesShares;
    totalNoShares += pos.noShares;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const optShares = (pos as any).optionShares as Record<string, number> | null;
    if (optShares) {
      for (const [idx, shares] of Object.entries(optShares)) {
        totalOptionShares[idx] = (totalOptionShares[idx] || 0) + shares;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = market as any;
  return NextResponse.json({
    market: {
      ...market,
      price: getPrice(market.yesPool, market.noPool),
      optionPrices: m.options && m.optionPools
        ? getMultiOptionPrices(m.optionPools as number[])
        : null,
      totalYesShares,
      totalNoShares,
      totalOptionShares,
    },
  });
}
