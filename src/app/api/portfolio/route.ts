import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrice } from "@/lib/amm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const positions = await prisma.position.findMany({
    where: {
      userId: session.userId,
      OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
    },
    include: {
      market: {
        select: {
          id: true, title: true, status: true, yesPool: true,
          noPool: true, resolvesAt: true, outcome: true, category: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const enriched = positions.map((p) => {
    const price = getPrice(p.market.yesPool, p.market.noPool);
    const yesValue = p.yesShares * price.yes;
    const noValue = p.noShares * price.no;
    return { ...p, currentValue: yesValue + noValue, price };
  });

  const trades = await prisma.trade.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      market: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json({ positions: enriched, trades });
}
