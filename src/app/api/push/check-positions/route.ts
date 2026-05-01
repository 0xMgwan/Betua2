import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPositionExpiring, notifyPositionChange } from "@/lib/push";
import { sendPushToUser } from "@/lib/push";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let expiringNotified = 0;
    let priceChangeNotified = 0;
    let volumeSpikeNotified = 0;

    // ── 1. Expiring markets — 24h, 6h, 1h windows ──────────────────────────
    const expiryWindows = [
      { maxMs: 24 * 60 * 60 * 1000, minMs: 6 * 60 * 60 * 1000,  label: "24 hours",  cooldownMs: 12 * 60 * 60 * 1000 },
      { maxMs:  6 * 60 * 60 * 1000, minMs: 1 * 60 * 60 * 1000,  label: "6 hours",   cooldownMs:  4 * 60 * 60 * 1000 },
      { maxMs:  1 * 60 * 60 * 1000, minMs: 0,                    label: "1 hour",    cooldownMs:  1 * 60 * 60 * 1000 },
    ];

    for (const window of expiryWindows) {
      const expiringMarkets = await prisma.market.findMany({
        where: {
          status: "OPEN",
          resolvesAt: {
            gte: now,
            lte: new Date(now.getTime() + window.maxMs),
            ...(window.minMs > 0 ? { gt: new Date(now.getTime() + window.minMs) } : {}),
          },
        },
        include: {
          positions: {
            where: { OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }] },
            include: { user: { select: { id: true, locale: true } } },
          },
        },
      });

      for (const market of expiringMarkets) {
        const hoursLeft = Math.max(1, Math.round((market.resolvesAt.getTime() - now.getTime()) / (60 * 60 * 1000)));

        for (const position of market.positions) {
          const prefs = await prisma.notificationPreference.findUnique({ where: { userId: position.userId } });
          if (prefs?.positionExpiring === false || prefs?.pushEnabled === false) continue;

          const recent = await prisma.notification.findFirst({
            where: {
              userId: position.userId,
              type: "EXPIRING",
              link: `/markets/${market.id}`,
              createdAt: { gte: new Date(now.getTime() - window.cooldownMs) },
            },
          });
          if (recent) continue;

          await notifyPositionExpiring(position.userId, market.title, hoursLeft, market.id, position.user.locale || "en");
          await prisma.notification.create({
            data: {
              userId: position.userId,
              type: "EXPIRING",
              title: `⏰ Market closing in ${window.label}`,
              message: `"${market.title}" resolves in ~${hoursLeft}h — check your position!`,
              link: `/markets/${market.id}`,
            },
          });
          expiringNotified++;
        }
      }
    }

    // ── 2. Price / odds movement ≥ threshold ────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marketsWithPositions = await (prisma.market as any).findMany({
      where: { status: "OPEN" },
      include: {
        positions: {
          include: { user: { select: { id: true, locale: true } } },
        },
        trades: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    });

    for (const market of marketsWithPositions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mkt = market as any;
      const isMulti = Array.isArray(mkt.options) && mkt.options.length >= 2;

      // Current prices
      let yesPrice: number = mkt.yesPool / (mkt.yesPool + mkt.noPool);
      let optionPrices: number[] = [];
      if (isMulti && Array.isArray(mkt.optionPools)) {
        const pools: number[] = mkt.optionPools;
        const invSum = pools.reduce((s: number, p: number) => s + 1 / Math.max(p, 1), 0);
        optionPrices = pools.map((p: number) => (1 / Math.max(p, 1)) / invSum);
      }

      // Reference price from ~6 hours ago
      const refTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const oldTrades: { price: number; side: string; createdAt: Date }[] = mkt.trades.filter(
        (t: { createdAt: Date }) => t.createdAt < refTime
      );

      for (const position of mkt.positions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pos = position as any;

        const prefs = await prisma.notificationPreference.findUnique({ where: { userId: pos.userId } });
        if (prefs?.positionPriceChange === false || prefs?.pushEnabled === false) continue;
        const threshold = prefs?.priceChangeThreshold || 10;

        // Determine which side(s) the user holds
        const sides: { label: string; current: number; optIdx?: number }[] = [];
        if (isMulti) {
          const optShares = (pos.optionShares as Record<string, number>) || {};
          for (const [idxStr, shares] of Object.entries(optShares)) {
            if ((shares as number) > 0 && optionPrices[Number(idxStr)] !== undefined) {
              sides.push({ label: mkt.options[Number(idxStr)], current: optionPrices[Number(idxStr)], optIdx: Number(idxStr) });
            }
          }
        } else {
          if (pos.yesShares > 0) sides.push({ label: "YES", current: yesPrice });
          if (pos.noShares > 0) sides.push({ label: "NO", current: 1 - yesPrice });
        }

        for (const side of sides) {
          // Find old price for this side
          const relatedOldTrades = oldTrades.filter(t => {
            if (isMulti) return true; // use market-level
            return t.side === side.label;
          });
          if (relatedOldTrades.length === 0) continue;

          const oldPrice = isMulti
            ? (relatedOldTrades[0].price ?? side.current)
            : (side.label === "YES" ? relatedOldTrades[0].price : 1 - relatedOldTrades[0].price);

          const pctChange = ((side.current - oldPrice) / Math.max(oldPrice, 0.01)) * 100;
          if (Math.abs(pctChange) < threshold) continue;

          const recent = await prisma.notification.findFirst({
            where: {
              userId: pos.userId,
              type: "PRICE_CHANGE",
              link: `/markets/${market.id}`,
              createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
            },
          });
          if (recent) continue;

          await notifyPositionChange(pos.userId, market.title, side.label, pctChange, side.current, market.id, pos.user.locale || "en");
          await prisma.notification.create({
            data: {
              userId: pos.userId,
              type: "PRICE_CHANGE",
              title: `${pctChange > 0 ? "📈 Odds rising" : "📉 Odds falling"} — ${side.label}`,
              message: `${side.label} in "${market.title}" moved ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(0)}% (now ${Math.round(side.current * 100)}%)`,
              link: `/markets/${market.id}`,
            },
          });
          priceChangeNotified++;
        }
      }

      // ── 3. Volume spike: >20% of total volume in last 4h ──────────────────
      const recentVolumeMs = 4 * 60 * 60 * 1000;
      const recentTrades: { amountTzs: number; createdAt: Date }[] = mkt.trades.filter(
        (t: { createdAt: Date }) => t.createdAt >= new Date(now.getTime() - recentVolumeMs)
      );
      const recentVol = recentTrades.reduce((s: number, t: { amountTzs: number }) => s + (t.amountTzs || 0), 0);
      const totalVol = mkt.totalVolume || 0;

      if (totalVol > 5000 && recentVol / totalVol >= 0.2) {
        for (const position of mkt.positions) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pos = position as any;

          const recent = await prisma.notification.findFirst({
            where: {
              userId: pos.userId,
              type: "MARKET_HOT",
              link: `/markets/${market.id}`,
              createdAt: { gte: new Date(now.getTime() - 8 * 60 * 60 * 1000) },
            },
          });
          if (recent) continue;

          await sendPushToUser(pos.userId, {
            title: "🔥 Market heating up",
            body: `Heavy trading on "${market.title}" — ${Math.round(recentVol / 1000)}K TZS in last 4h`,
            url: `/markets/${market.id}`,
            tag: "market-hot",
          });
          await prisma.notification.create({
            data: {
              userId: pos.userId,
              type: "MARKET_HOT",
              title: "🔥 Market heating up",
              message: `Heavy trading on "${market.title}" — ${Math.round(recentVol / 1000)}K TZS bet in the last 4 hours`,
              link: `/markets/${market.id}`,
            },
          });
          volumeSpikeNotified++;
        }
      }
    }

    return NextResponse.json({ success: true, expiringNotified, priceChangeNotified, volumeSpikeNotified });
  } catch (error) {
    console.error("Check positions error:", error);
    return NextResponse.json({ error: "Failed to check positions" }, { status: 500 });
  }
}
