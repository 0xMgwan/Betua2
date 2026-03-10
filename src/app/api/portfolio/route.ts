import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrice, getMultiOptionPrices } from "@/lib/amm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all positions for user — filter in JS to avoid Prisma type issues with new JSON fields
  const allPositions = await prisma.position.findMany({
    where: { userId: session.userId },
    include: { market: true },
    orderBy: { updatedAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positions = allPositions.filter((p: any) => {
    if (p.yesShares > 0 || p.noShares > 0) return true;
    if (p.optionShares && typeof p.optionShares === "object") {
      return Object.values(p.optionShares as Record<string, number>).some((v) => v > 0);
    }
    return false;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = positions.map((p: any) => {
    const mkt = p.market;
    const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;

    if (isMultiOption && mkt.optionPools) {
      const prices = getMultiOptionPrices(mkt.optionPools as number[]);
      const optShares = (p.optionShares as Record<string, number>) || {};
      let totalValue = 0;
      for (const [idx, shares] of Object.entries(optShares)) {
        totalValue += shares * (prices[Number(idx)] || 0);
      }
      return { ...p, currentValue: totalValue, price: getPrice(mkt.yesPool, mkt.noPool), optionPrices: prices };
    }

    const price = getPrice(mkt.yesPool, mkt.noPool);
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
