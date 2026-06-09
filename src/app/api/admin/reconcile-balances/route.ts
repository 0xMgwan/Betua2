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

  const CREDIT_TYPES = ["DEPOSIT", "REDEEM", "SELL"];
  const DEBIT_TYPES  = ["BUY_SHARES", "CREATE_MARKET", "SEED_LIQUIDITY", "WITHDRAWAL", "SEND"];

  // Fetch all completed TZS transactions grouped by user
  const txs = await prisma.transaction.findMany({
    where: { status: "COMPLETED", currency: { in: ["TZS", null as unknown as string] } },
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

  // Update each user's balance — clamp to 0 minimum
  let updated = 0;
  for (const [userId, calculatedBalance] of balanceMap.entries()) {
    const corrected = Math.max(0, calculatedBalance);
    await prisma.user.update({
      where: { id: userId },
      data: { balanceTzs: corrected },
    });
    updated++;
  }

  return NextResponse.json({ success: true, usersReconciled: updated });
}

// GET: preview without writing
export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const CREDIT_TYPES = ["DEPOSIT", "REDEEM", "SELL"];
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
