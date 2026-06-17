import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// User trading behavior analytics over the last 30 days (buys only, no LP seeds).
export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const DAYS = 30;
  const since = new Date(Date.now() - DAYS * 86_400_000);

  const trades = await prisma.trade.findMany({
    where: { isLpSeed: false, createdAt: { gte: since }, NOT: { side: { startsWith: "SELL_" } } },
    select: { amountTzs: true, createdAt: true, userId: true, market: { select: { category: true, title: true } } },
  });

  let totalVolume = 0;
  const byCategory: Record<string, { count: number; volume: number }> = {};
  const byHour = Array.from({ length: 24 }, () => ({ count: 0, volume: 0 }));
  const byDay: Record<string, { count: number; volume: number }> = {};
  const byMarket: Record<string, { count: number; volume: number }> = {};
  const traders = new Set<string>();

  for (const t of trades) {
    const amt = t.amountTzs || 0;
    totalVolume += amt;
    traders.add(t.userId);

    const cat = t.market?.category || "Other";
    (byCategory[cat] ||= { count: 0, volume: 0 });
    byCategory[cat].count++; byCategory[cat].volume += amt;

    // Hour-of-day in East Africa Time (UTC+3)
    const h = (new Date(t.createdAt).getUTCHours() + 3) % 24;
    byHour[h].count++; byHour[h].volume += amt;

    // Day bucket (EAT date)
    const d = new Date(new Date(t.createdAt).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
    (byDay[d] ||= { count: 0, volume: 0 });
    byDay[d].count++; byDay[d].volume += amt;

    const title = t.market?.title || "—";
    (byMarket[title] ||= { count: 0, volume: 0 });
    byMarket[title].count++; byMarket[title].volume += amt;
  }

  const totalTrades = trades.length;

  // Last 14 days as an ordered series
  const days: { date: string; count: number; volume: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() + 3 * 3_600_000 - i * 86_400_000).toISOString().slice(0, 10);
    const v = byDay[d] || { count: 0, volume: 0 };
    days.push({ date: d.slice(5), count: v.count, volume: v.volume });
  }

  const categories = Object.entries(byCategory)
    .map(([category, v]) => ({ category, ...v, pct: totalVolume > 0 ? Math.round((v.volume / totalVolume) * 100) : 0 }))
    .sort((a, b) => b.volume - a.volume);

  const topMarkets = Object.entries(byMarket)
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  return NextResponse.json({
    windowDays: DAYS,
    totalTrades,
    totalVolume,
    avgTrade: totalTrades > 0 ? Math.round(totalVolume / totalTrades) : 0,
    uniqueTraders: traders.size,
    categories,
    byHour,
    days,
    topMarkets,
  });
}
