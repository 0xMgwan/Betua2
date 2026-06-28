import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

const CREDIT_TYPES = ["DEPOSIT", "REDEEM", "SELL_SHARES", "RECEIVE", "REFERRAL_REWARD", "CREATOR_FEE", "LP_REDEEM"];
const DEBIT_TYPES = ["BUY_SHARES", "CREATE_MARKET", "SEED_LIQUIDITY", "WITHDRAWAL", "SEND"];

// Audit a single user's TZS balance against their transaction ledger.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (new URL(req.url).searchParams.get("username") || "").trim().replace(/^@/, "");
  if (!q) return NextResponse.json({ error: "username required" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: q }, { email: q }] },
    select: { id: true, username: true, email: true, balanceTzs: true, balanceUsdc: true, balanceKes: true, ntzsUserId: true },
  });
  if (!user) return NextResponse.json({ error: `No user '${q}'` }, { status: 404 });

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, status: "COMPLETED", currency: "TZS" },
    select: { type: true, amountTzs: true },
  });

  const byType: Record<string, { count: number; total: number; direction: string }> = {};
  let computed = 0;
  for (const tx of txs) {
    const dir = CREDIT_TYPES.includes(tx.type) ? "credit" : DEBIT_TYPES.includes(tx.type) ? "debit" : "ignored";
    (byType[tx.type] ||= { count: 0, total: 0, direction: dir });
    byType[tx.type].count++;
    byType[tx.type].total += tx.amountTzs || 0;
    if (dir === "credit") computed += tx.amountTzs || 0;
    else if (dir === "debit") computed -= tx.amountTzs || 0;
  }
  const computedClamped = Math.max(0, computed);

  return NextResponse.json({
    username: user.username,
    email: user.email,
    storedTzs: user.balanceTzs || 0,
    computedTzs: computedClamped,
    rawComputed: computed, // before clamping to 0 — negative means they spent phantom money
    match: (user.balanceTzs || 0) === computedClamped,
    balanceUsdc: user.balanceUsdc || 0,
    balanceKes: user.balanceKes || 0,
    txCount: txs.length,
    breakdown: Object.entries(byType)
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
  });
}
