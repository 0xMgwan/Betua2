/**
 * Syncs PENDING deposit/withdrawal statuses by polling the NTZS API.
 * Call this after initiating a transaction to get live updates without
 * relying solely on webhooks (which may not fire in dev/staging).
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all PENDING transactions for this user
  const pending = await prisma.transaction.findMany({
    where: { userId: session.userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  let updated = 0;

  for (const tx of pending) {
    try {
      if (tx.type === "DEPOSIT" && tx.ntzsDepositId) {
        const deposit = await ntzs.deposits.get(tx.ntzsDepositId);
        // NTZS uses "minted" to mean successfully completed
        const newStatus = deposit.status === "minted"
          ? "COMPLETED"
          : deposit.status === "failed"
          ? "FAILED"
          : null;

        if (newStatus) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { status: newStatus },
          });
          updated++;
        }
      }
      // Could add withdrawal polling here too if NTZS exposes GET /withdrawals/:id
    } catch {
      // Don't fail whole sync if one check errors
    }
  }

  // Return all transactions fresh
  const transactions = await prisma.transaction.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ transactions, updated });
}
