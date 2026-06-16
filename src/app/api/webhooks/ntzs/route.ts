import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processReferralReward } from "@/lib/referral";
import { notifyUserPartners } from "@/lib/partnerWebhooks";

export async function POST(req: NextRequest) {
  const event = await req.json();

  try {
    switch (event.type) {
      case "deposit.completed": {
        const tx = await prisma.transaction.findFirst({
          where: { ntzsDepositId: event.data.id, status: "PENDING" },
        });
        if (!tx) break; // already processed or not found

        // Credit balance + mark COMPLETED atomically
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED" } }),
          prisma.user.update({
            where: { id: tx.userId },
            data: { balanceTzs: { increment: tx.amountTzs } },
          }),
        ]);

        processReferralReward(tx.userId, tx.id, tx.amountTzs).catch(() => {});
        await notifyUserPartners(tx.userId, "deposit.completed", { amountTzs: tx.amountTzs, transactionId: tx.id });
        break;
      }

      case "deposit.failed": {
        const tx = await prisma.transaction.findFirst({
          where: { ntzsDepositId: event.data.id, status: "PENDING" },
        });
        if (!tx) break;

        // Mark FAILED — no balance credit was made so nothing to reverse
        await prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } });
        await notifyUserPartners(tx.userId, "deposit.failed", { amountTzs: tx.amountTzs, transactionId: tx.id });
        break;
      }

      case "withdrawal.completed": {
        const wtx = await prisma.transaction.findFirst({
          where: { ntzsWithdrawId: event.data.id },
        });
        await prisma.transaction.updateMany({
          where: { ntzsWithdrawId: event.data.id },
          data: { status: "COMPLETED" },
        });
        if (wtx) await notifyUserPartners(wtx.userId, "withdrawal.completed", { amountTzs: wtx.amountTzs, transactionId: wtx.id });
        break;
      }

      case "withdrawal.failed": {
        // Reverse the balance deduction made at withdrawal initiation
        const wtx = await prisma.transaction.findFirst({
          where: { ntzsWithdrawId: event.data.id, status: "PENDING" },
        });
        if (!wtx) break;

        await prisma.$transaction([
          prisma.transaction.update({ where: { id: wtx.id }, data: { status: "FAILED" } }),
          prisma.user.update({
            where: { id: wtx.userId },
            data: { balanceTzs: { increment: wtx.amountTzs } },
          }),
        ]);
        await notifyUserPartners(wtx.userId, "withdrawal.failed", { amountTzs: wtx.amountTzs, transactionId: wtx.id });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ received: true });
}
