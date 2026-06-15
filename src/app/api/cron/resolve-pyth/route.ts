import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLatestPrice, PYTH_FEED_IDS } from "@/lib/pyth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";
const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// Markets created via the Pyth flow embed a tag in their description:
//   [PYTH:<symbol>:<target>:<operator>]   e.g. [PYTH:XAU/USD:2700:above]
const PYTH_TAG = /\[PYTH:([^:\]]+):([^:\]]+):([^:\]]+)\]/;

async function handler(req: NextRequest) {
  // Allow either the scheduled cron (CRON_SECRET bearer) OR a logged-in admin
  // (used by the "Resolve due Pyth now" button on the admin page).
  const authHeader = req.headers.get("authorization");
  let allowed = !CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;
  if (!allowed) {
    const session = await getSession();
    allowed = !!session && ADMIN_USER_IDS.includes(session.userId);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Dry run (?dry=1): compute and report what WOULD resolve, without settling.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

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

    if (dry) {
      results.push({
        id: m.id,
        title: m.title,
        symbol,
        target,
        operator,
        price: priceData.price,
        wouldResolve: outcome ? "YES" : "NO",
      });
      continue;
    }

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

  return NextResponse.json({
    ok: true,
    dry,
    checked: due.length,
    resolved: dry ? 0 : results.filter((r) => r.resolved).length,
    results,
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
