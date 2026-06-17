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
    // Only show positions where the user has trade shares beyond their LP seed.
    // lpYesShares/lpNoShares/lpOptionShares track the seed portion so creators who
    // also trade on their own market still see their trade position here.
    const tradeYes = (p.yesShares || 0) - (p.lpYesShares || 0);
    const tradeNo  = (p.noShares  || 0) - (p.lpNoShares  || 0);
    if (tradeYes > 0 || tradeNo > 0) return true;

    // Multi-option: check if any option has trade shares beyond the LP seed
    if (p.optionShares && typeof p.optionShares === "object") {
      const lpOpt = (p.lpOptionShares as Record<string, number>) || {};
      return Object.entries(p.optionShares as Record<string, number>).some(
        ([idx, shares]) => (shares - (lpOpt[idx] || 0)) > 0
      );
    }
    return false;
  });

  const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

  // Fetch all positions for markets this user is in, to calculate total shares per side
  const marketIds = positions.map((p) => p.marketId);
  const allMarketPositions = await prisma.position.findMany({
    where: { marketId: { in: marketIds } },
  });

  // Build map: marketId → { totalYesShares, totalNoShares, totalOptionShares }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marketShareTotals: Record<string, { yes: number; no: number; options: Record<string, number> }> = {};
  for (const pos of allMarketPositions) {
    if (!marketShareTotals[pos.marketId]) {
      marketShareTotals[pos.marketId] = { yes: 0, no: 0, options: {} };
    }
    const totals = marketShareTotals[pos.marketId];
    totals.yes += pos.yesShares;
    totals.no += pos.noShares;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const optShares = (pos as any).optionShares as Record<string, number> | null;
    if (optShares) {
      for (const [idx, shares] of Object.entries(optShares)) {
        totals.options[idx] = (totals.options[idx] || 0) + shares;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = positions.map((p: any) => {
    const mkt = p.market;
    const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;
    const pot = Math.round(mkt.totalVolume * (1 - FEE_PERCENT));
    const totals = marketShareTotals[mkt.id] || { yes: 0, no: 0, options: {} };

    // For resolved markets, use actual outcome — losers get 0, winners get their payout.
    // Prefer the fixed-odds payout locked in at trade time (matches the redeem API,
    // backed by the platform pool, never diluted by the market seed). Fall back to
    // parimutuel only for legacy positions that never stored an implied payout.
    if (mkt.status === "RESOLVED" && mkt.outcome !== null) {
      if (isMultiOption) {
        const optShares = (p.optionShares as Record<string, number>) || {};
        const winningShares = optShares[String(mkt.outcome)] || 0;
        const storedImplied = ((p.optionImpliedPayouts as Record<string, number>) || {})[String(mkt.outcome)] || 0;
        let currentValue: number;
        if (storedImplied > 0) {
          currentValue = Math.round(storedImplied);
        } else {
          const totalWinShares = totals.options[String(mkt.outcome)] || 1;
          const grossPayout = totalWinShares > 0 ? Math.round((winningShares / totalWinShares) * pot) : 0;
          currentValue = grossPayout - Math.round(grossPayout * FEE_PERCENT);
        }
        const prices = mkt.optionPools ? getMultiOptionPrices(mkt.optionPools as number[]) : [];
        return { ...p, currentValue, price: getPrice(mkt.yesPool, mkt.noPool), optionPrices: prices };
      }

      const winningShares = mkt.outcome === 1 ? p.yesShares : p.noShares;
      const storedImplied = mkt.outcome === 1 ? (p.yesImpliedPayout || 0) : (p.noImpliedPayout || 0);
      let currentValue: number;
      if (storedImplied > 0) {
        currentValue = Math.round(storedImplied);
      } else {
        const totalWinShares = mkt.outcome === 1 ? totals.yes : totals.no;
        const grossPayout = totalWinShares > 0 ? Math.round((winningShares / totalWinShares) * pot) : 0;
        currentValue = grossPayout - Math.round(grossPayout * FEE_PERCENT);
      }
      return { ...p, currentValue, price: getPrice(mkt.yesPool, mkt.noPool) };
    }

    // OPEN markets — mark-to-market: fixed-odds payout × current probability.
    if (isMultiOption && mkt.optionPools) {
      const prices = getMultiOptionPrices(mkt.optionPools as number[]);
      const optShares = (p.optionShares as Record<string, number>) || {};
      const implied = (p.optionImpliedPayouts as Record<string, number>) || {};
      let totalValue = 0;
      for (const [idx, shares] of Object.entries(optShares)) {
        const storedImplied = implied[idx] || 0;
        const payoutIfWin = storedImplied > 0
          ? storedImplied
          : (totals.options[idx] || 1) > 0 ? (shares / (totals.options[idx] || 1)) * pot * (1 - FEE_PERCENT) : 0;
        totalValue += payoutIfWin * (prices[Number(idx)] || 0);
      }
      return { ...p, currentValue: Math.round(totalValue), price: getPrice(mkt.yesPool, mkt.noPool), optionPrices: prices };
    }

    const price = getPrice(mkt.yesPool, mkt.noPool);
    // Expected value: P(yes) × payoutIfYesWins + P(no) × payoutIfNoWins
    const yesPayoutIfWin = (p.yesImpliedPayout || 0) > 0
      ? p.yesImpliedPayout
      : (totals.yes > 0 ? (p.yesShares / totals.yes) * pot * (1 - FEE_PERCENT) : 0);
    const noPayoutIfWin = (p.noImpliedPayout || 0) > 0
      ? p.noImpliedPayout
      : (totals.no > 0 ? (p.noShares / totals.no) * pot * (1 - FEE_PERCENT) : 0);
    const currentValue = yesPayoutIfWin * price.yes + noPayoutIfWin * price.no;
    return { ...p, currentValue: Math.round(currentValue), price };
  });

  // Calculate total invested per market for this user
  const userTradesForPositions = await prisma.trade.findMany({
    where: { userId: session.userId, marketId: { in: marketIds } },
    select: { marketId: true, amountTzs: true },
  });
  const investedByMarket: Record<string, number> = {};
  for (const t of userTradesForPositions) {
    investedByMarket[t.marketId] = (investedByMarket[t.marketId] || 0) + t.amountTzs;
  }

  // Attach totalInvested to each position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedWithInvested = enriched.map((p: any) => ({
    ...p,
    totalInvested: investedByMarket[p.marketId] || 0,
  }));

  const trades = await prisma.trade.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      market: { select: { id: true, title: true, status: true } },
    },
  });

  // Fetch markets created by this user
  const createdMarkets = await prisma.market.findMany({
    where: { creatorId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      imageUrl: true,
      resolvesAt: true,
      totalVolume: true,
      createdAt: true,
      yesPool: true,
      noPool: true,
      options: true,
      optionPools: true,
      _count: {
        select: { trades: true },
      },
    },
  });

  return NextResponse.json({ positions: enrichedWithInvested, trades, createdMarkets });
}
