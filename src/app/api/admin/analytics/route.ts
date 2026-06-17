import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// User trading behavior analytics. ?days=7|30|90|0 (0 = all-time). Default 30.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const daysParam = parseInt(new URL(req.url).searchParams.get("days") || "30");
  const days = [7, 30, 90, 0].includes(daysParam) ? daysParam : 30;
  const since = days === 0 ? new Date(0) : new Date(Date.now() - days * 86_400_000);

  const trades = await prisma.trade.findMany({
    where: { isLpSeed: false, createdAt: { gte: since } },
    select: { amountTzs: true, createdAt: true, userId: true, side: true, market: { select: { category: true, title: true } } },
  });

  let totalVolume = 0; // buys only
  const byCategory: Record<string, { count: number; volume: number }> = {};
  const byHour = Array.from({ length: 24 }, () => ({ count: 0, volume: 0 }));
  const byDay: Record<string, { count: number; volume: number }> = {};
  const byMarket: Record<string, { count: number; volume: number }> = {};
  const buyTraders = new Set<string>();
  const buySell = { buys: { count: 0, volume: 0 }, sells: { count: 0, volume: 0 } };

  for (const t of trades) {
    const isSell = (t.side || "").startsWith("SELL_");
    const amt = Math.abs(t.amountTzs || 0);
    if (isSell) { buySell.sells.count++; buySell.sells.volume += amt; continue; }

    // ── Buys drive the behavior breakdowns ──
    buySell.buys.count++; buySell.buys.volume += amt;
    totalVolume += amt;
    buyTraders.add(t.userId);

    const cat = t.market?.category || "Other";
    (byCategory[cat] ||= { count: 0, volume: 0 });
    byCategory[cat].count++; byCategory[cat].volume += amt;

    const h = (new Date(t.createdAt).getUTCHours() + 3) % 24; // EAT
    byHour[h].count++; byHour[h].volume += amt;

    const d = new Date(new Date(t.createdAt).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
    (byDay[d] ||= { count: 0, volume: 0 });
    byDay[d].count++; byDay[d].volume += amt;

    const title = t.market?.title || "—";
    (byMarket[title] ||= { count: 0, volume: 0 });
    byMarket[title].count++; byMarket[title].volume += amt;
  }

  const totalTrades = buySell.buys.count;

  // New vs returning: of the traders who bought in-window, who had a prior trade?
  let newTraders = 0, returningTraders = 0;
  if (buyTraders.size > 0 && days !== 0) {
    const prior = await prisma.trade.findMany({
      where: { userId: { in: [...buyTraders] }, isLpSeed: false, createdAt: { lt: since } },
      select: { userId: true },
      distinct: ["userId"],
    });
    const returningSet = new Set(prior.map((p) => p.userId));
    returningTraders = returningSet.size;
    newTraders = buyTraders.size - returningTraders;
  } else {
    newTraders = buyTraders.size; // all-time: everyone counts as first-seen
  }

  // Last 14 days series
  const series: { date: string; count: number; volume: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + 3 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
    const v = byDay[d] || { count: 0, volume: 0 };
    series.push({ date: d.slice(5), count: v.count, volume: v.volume });
  }

  const categories = Object.entries(byCategory)
    .map(([category, v]) => ({
      category, ...v,
      pct: totalVolume > 0 ? Math.round((v.volume / totalVolume) * 100) : 0,
      avgTrade: v.count > 0 ? Math.round(v.volume / v.count) : 0,
    }))
    .sort((a, b) => b.volume - a.volume);

  const topMarkets = Object.entries(byMarket)
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  return NextResponse.json({
    windowDays: days,
    totalTrades,
    totalVolume,
    avgTrade: totalTrades > 0 ? Math.round(totalVolume / totalTrades) : 0,
    uniqueTraders: buyTraders.size,
    newTraders,
    returningTraders,
    buySell,
    categories,
    byHour,
    days: series,
    topMarkets,
  });
}
