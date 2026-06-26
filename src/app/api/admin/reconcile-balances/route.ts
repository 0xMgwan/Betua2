/**
 * Admin: Reconcile all user balanceTzs from completed transaction history.
 * Recalculates each user's balance as:
 *   + COMPLETED DEPOSIT
 *   - BUY_SHARES
 *   + REDEEM
 *   + SELL
 *   - CREATE_MARKET (fee)
 *   - SEED_LIQUIDITY
 *   - WITHDRAWAL / SEND
 *
 * Safe to run multiple times — always sets to the correct calculated value.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

export async function POST() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const CREDIT_TYPES = ["DEPOSIT", "REDEEM", "SELL_SHARES", "RECEIVE", "REFERRAL_REWARD", "CREATOR_FEE", "LP_REDEEM"];
  const DEBIT_TYPES  = ["BUY_SHARES", "CREATE_MARKET", "SEED_LIQUIDITY", "WITHDRAWAL", "SEND"];

  try {
    // Fetch all completed TZS transactions
    const txs = await prisma.transaction.findMany({
      where: { status: "COMPLETED", currency: "TZS" },
      select: { userId: true, type: true, amountTzs: true },
    });

    // Calculate per-user balance
    const balanceMap = new Map<string, number>();
    for (const tx of txs) {
      const prev = balanceMap.get(tx.userId) ?? 0;
      if (CREDIT_TYPES.includes(tx.type)) {
        balanceMap.set(tx.userId, prev + (tx.amountTzs || 0));
      } else if (DEBIT_TYPES.includes(tx.type)) {
        balanceMap.set(tx.userId, prev - (tx.amountTzs || 0));
      }
    }

    // Only touch users that still EXIST and whose balance actually changed, and
    // write in parallel batches so it doesn't time out with many users.
    const ids = [...balanceMap.keys()];
    const current = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, balanceTzs: true } });
    const currentMap = new Map(current.map((u) => [u.id, u.balanceTzs || 0]));

    const toUpdate = [...balanceMap.entries()]
      .map(([userId, calc]) => ({ userId, corrected: Math.max(0, calc) }))
      .filter(({ userId, corrected }) => currentMap.has(userId) && currentMap.get(userId) !== corrected);

    let updated = 0;
    const CHUNK = 25;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      await Promise.all(chunk.map(({ userId, corrected }) =>
        prisma.user.update({ where: { id: userId }, data: { balanceTzs: corrected } })));
      updated += chunk.length;
    }

    return NextResponse.json({ success: true, usersReconciled: updated, scanned: balanceMap.size });
  } catch (err) {
    console.error("[reconcile-balances] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reconcile failed" }, { status: 500 });
  }
}

// GET: preview without writing
export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const CREDIT_TYPES = ["DEPOSIT", "REDEEM", "SELL_SHARES", "RECEIVE", "REFERRAL_REWARD", "CREATOR_FEE", "LP_REDEEM"];
  const DEBIT_TYPES  = ["BUY_SHARES", "CREATE_MARKET", "SEED_LIQUIDITY", "WITHDRAWAL", "SEND"];

  const txs = await prisma.transaction.findMany({
    where: { status: "COMPLETED" },
    select: { userId: true, type: true, amountTzs: true },
  });

  const balanceMap = new Map<string, number>();
  for (const tx of txs) {
    const prev = balanceMap.get(tx.userId) ?? 0;
    if (CREDIT_TYPES.includes(tx.type)) {
      balanceMap.set(tx.userId, prev + (tx.amountTzs || 0));
    } else if (DEBIT_TYPES.includes(tx.type)) {
      balanceMap.set(tx.userId, prev - (tx.amountTzs || 0));
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...balanceMap.keys()] } },
    select: { id: true, username: true, balanceTzs: true },
  });

  const preview = users.map(u => ({
    username: u.username,
    currentBalance: u.balanceTzs,
    calculatedBalance: Math.max(0, balanceMap.get(u.id) ?? 0),
    diff: Math.max(0, balanceMap.get(u.id) ?? 0) - (u.balanceTzs || 0),
  }));

  return NextResponse.json({ preview });
}
