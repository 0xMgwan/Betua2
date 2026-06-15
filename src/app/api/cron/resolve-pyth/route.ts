import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLatestPrice, PYTH_FEED_IDS } from "@/lib/pyth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

// Markets created via the Pyth flow embed a tag in their description:
//   [PYTH:<symbol>:<target>:<operator>]   e.g. [PYTH:XAU/USD:2700:above]
const PYTH_TAG = /\[PYTH:([^:\]]+):([^:\]]+):([^:\]]+)\]/;

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Due Pyth markets: still OPEN, past their resolve time, carrying a PYTH tag.
  const due = await prisma.market.findMany({
    where: {
      status: "OPEN",
      resolvesAt: { lte: new Date() },
      description: { contains: "[PYTH:" },
    },
    select: { id: true, title: true, description: true },
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const results: Array<Record<string, unknown>> = [];

  for (const m of due) {
    const match = m.description?.match(PYTH_TAG);
    if (!match) {
      results.push({ id: m.id, skipped: "no PYTH tag parsed" });
      continue;
    }
    const symbol = match[1].trim();
    const target = parseFloat(match[2]);
    const operator = match[3].trim().toLowerCase(); // "above" | "below"
    const feedId = PYTH_FEED_IDS[symbol];

    if (!feedId || !Number.isFinite(target)) {
      results.push({ id: m.id, symbol, skipped: "unknown symbol or bad target" });
      continue;
    }

    const priceData = await getLatestPrice(feedId);
    if (!priceData) {
      results.push({ id: m.id, symbol, skipped: "no price from Pyth" });
      continue;
    }

    // operator "above" → YES if price ≥ target; otherwise YES if price ≤ target.
    const outcome = operator === "above" ? priceData.price >= target : priceData.price <= target;

    try {
      const res = await fetch(`${origin}/api/markets/${m.id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({ outcome }),
      });
      const json = await res.json().catch(() => ({}));
      results.push({
        id: m.id,
        symbol,
        target,
        operator,
        price: priceData.price,
        outcome: outcome ? "YES" : "NO",
        resolved: res.ok,
        status: res.status,
        ...(res.ok ? {} : { error: json?.error }),
      });
    } catch (err) {
      results.push({ id: m.id, symbol, resolved: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, checked: due.length, resolved: results.filter((r) => r.resolved).length, results });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
