import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrice, getSharesOut, getMultiOptionPrices, getMultiOptionSharesOut, getPayoutForShares, getMultiOptionPayoutForShares } from "@/lib/amm";

const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;
const INIT_POOL = 100000;

// Derives accurate price history by replaying trades through the AMM.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const market = await prisma.market.findUnique({
    where: { id },
    select: {
      yesPool: true,
      noPool: true,
      options: true,
      optionPools: true,
      createdAt: true,
      status: true,
    },
  });

  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mkt = market as any;
  const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;

  const trades = await prisma.trade.findMany({
    where: { marketId: id },
    orderBy: { createdAt: "asc" },
    select: { side: true, amountTzs: true, shares: true, createdAt: true },
  });

  const points: Array<{ t: number; prices: Record<string, number> }> = [];

  if (isMultiOption) {
    const optionNames = mkt.options as string[];
    const POOL_PER_OPTION = 5000;
    let pools = optionNames.map(() => POOL_PER_OPTION);

    // Initial prices
    const initPrices = getMultiOptionPrices(pools);
    const initMap: Record<string, number> = {};
    optionNames.forEach((opt: string, i: number) => { initMap[opt] = initPrices[i]; });
    points.push({ t: market.createdAt.getTime(), prices: initMap });

    // Replay each trade
    for (const trade of trades) {
      const isSell = trade.side.startsWith("SELL_");
      const actualSide = isSell ? trade.side.slice(5) : trade.side;
      const optIdx = optionNames.indexOf(actualSide);
      if (optIdx === -1) continue;
      try {
        if (isSell) {
          const sharesToSell = Math.abs(trade.shares);
          const result = getMultiOptionPayoutForShares(sharesToSell, optIdx, pools);
          pools = result.newPools;
        } else {
          const feeAmt = Math.round(trade.amountTzs * FEE_PERCENT);
          const tradeAmt = trade.amountTzs - feeAmt;
          const result = getMultiOptionSharesOut(tradeAmt, optIdx, pools);
          pools = result.newPools;
        }
      } catch { continue; }
      const prices = getMultiOptionPrices(pools);
      const priceMap: Record<string, number> = {};
      optionNames.forEach((opt: string, i: number) => { priceMap[opt] = prices[i]; });
      points.push({ t: trade.createdAt.getTime(), prices: priceMap });
    }

    // Current live state
    if (mkt.optionPools) {
      const livePrices = getMultiOptionPrices(mkt.optionPools as number[]);
      const liveMap: Record<string, number> = {};
      optionNames.forEach((opt: string, i: number) => { liveMap[opt] = livePrices[i]; });
      points.push({ t: Date.now(), prices: liveMap });
    }
  } else {
    // Binary: replay pool state
    let yesPool = INIT_POOL;
    let noPool = INIT_POOL;

    // Initial 50/50
    points.push({ t: market.createdAt.getTime(), prices: { YES: 0.5, NO: 0.5 } });

    for (const trade of trades) {
      const isSell = trade.side.startsWith("SELL_");
      const actualSide = isSell ? trade.side.slice(5) : trade.side;
      const isYes = actualSide === "YES";
      try {
        if (isSell) {
          const sharesToSell = Math.abs(trade.shares);
          if (isYes) {
            const r = getPayoutForShares(sharesToSell, yesPool, noPool);
            yesPool = r.newPoolIn;
            noPool = r.newPoolOut;
          } else {
            const r = getPayoutForShares(sharesToSell, noPool, yesPool);
            noPool = r.newPoolIn;
            yesPool = r.newPoolOut;
          }
        } else {
          const feeAmt = Math.round(trade.amountTzs * FEE_PERCENT);
          const tradeAmt = trade.amountTzs - feeAmt;
          if (isYes) {
            const r = getSharesOut(tradeAmt, noPool, yesPool);
            noPool = r.newPoolIn;
            yesPool = r.newPoolOut;
          } else {
            const r = getSharesOut(tradeAmt, yesPool, noPool);
            yesPool = r.newPoolIn;
            noPool = r.newPoolOut;
          }
        }
      } catch { continue; }
      const p = getPrice(yesPool, noPool);
      points.push({ t: trade.createdAt.getTime(), prices: { YES: p.yes, NO: p.no } });
    }

    // Current live
    const liveP = getPrice(market.yesPool, market.noPool);
    points.push({ t: Date.now(), prices: { YES: liveP.yes, NO: liveP.no } });
  }

  // Deduplicate close timestamps (within 1 second)
  const dedupedPoints = points.filter((p, i) => {
    if (i === 0) return true;
    return p.t - points[i - 1].t > 1000;
  });

  return NextResponse.json(
    {
      points: dedupedPoints,
      isMultiOption,
      options: isMultiOption ? mkt.options : ["YES", "NO"],
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    }
  );
}
