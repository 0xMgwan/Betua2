/**
 * Syncs PENDING deposit/withdrawal statuses by polling the nTZS API.
 * Called automatically by the wallet page while any transaction is PENDING.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { processReferralReward } from "@/lib/referral";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = await prisma.transaction.findMany({
    where: { userId: session.userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  let updated = 0;

  for (const tx of pending) {
    try {
      if (tx.type === "DEPOSIT" && tx.ntzsDepositId) {
        const deposit = await ntzs.deposits.get(tx.ntzsDepositId);
        const isConfirmed = deposit.status === "minted";
        const isFailed = deposit.status === "failed";

        if (isConfirmed) {
          // Credit DB balance and mark COMPLETED atomically
          await prisma.$transaction([
            prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } }),
            prisma.user.update({
              where: { id: session.userId },
              data: { balanceTzs: { increment: tx.amountTzs } },
            }),
          ]);
          processReferralReward(session.userId, tx.id, tx.amountTzs).catch(() => {});
          updated++;
        } else if (isFailed) {
          await prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } });
          updated++;
        }
      }
    } catch {
      // Don't fail whole sync if one check errors
    }
  }

  // Return refreshed transactions + updated balance
  const transactions = await prisma.transaction.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Return updated user balance so client can update immediately
  const user = updated > 0
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { balanceTzs: true, balanceUsdc: true, balanceKes: true },
      })
    : null;

  return NextResponse.json({ transactions, updated, balance: user });
}
