import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

// Backfill fixed-odds payouts on OPEN positions that never stored one (legacy
// trades). Each winning share resolves to 1 TZS net of the 5% settlement fee,
// so payoutIfWin = shares × (1 − fee). Only fills missing values; never overwrites.
export async function POST() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const openMarkets = await prisma.market.findMany({ where: { status: "OPEN" }, select: { id: true } });
  const openMarketIds = openMarkets.map((m) => m.id);
  if (openMarketIds.length === 0) return NextResponse.json({ ok: true, scanned: 0, updated: 0 });

  const positions = await prisma.position.findMany({
    where: { marketId: { in: openMarketIds } },
    select: { id: true, yesShares: true, noShares: true, optionShares: true, optionImpliedPayouts: true, yesImpliedPayout: true, noImpliedPayout: true },
  });

  const net = (shares: number) => Math.round(shares * (1 - FEE_PERCENT));
  let updated = 0;

  for (const p of positions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    const optShares = (p.optionShares as Record<string, number> | null) || null;

    if (optShares && Object.keys(optShares).length > 0) {
      const implied = (p.optionImpliedPayouts as Record<string, number>) || {};
      const newImplied = { ...implied };
      let changed = false;
      for (const [idx, sh] of Object.entries(optShares)) {
        if (sh > 0 && !(implied[idx] > 0)) {
          newImplied[idx] = net(sh);
          changed = true;
        }
      }
      if (changed) data.optionImpliedPayouts = newImplied;
    } else {
      if (p.yesShares > 0 && !(p.yesImpliedPayout > 0)) data.yesImpliedPayout = net(p.yesShares);
      if (p.noShares > 0 && !(p.noImpliedPayout > 0)) data.noImpliedPayout = net(p.noShares);
    }

    if (Object.keys(data).length > 0) {
      await prisma.position.update({ where: { id: p.id }, data });
      updated++;
    }
  }

  return NextResponse.json({ ok: true, scanned: positions.length, updated });
}
