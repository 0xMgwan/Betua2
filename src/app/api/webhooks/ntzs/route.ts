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
        // Primary match: by the nTZS withdrawal id we stored.
        let wtx = await prisma.transaction.findFirst({
          where: { ntzsWithdrawId: event.data.id },
        });
        // Fallback: an AMBIGUOUS held withdrawal (the create call timed out, so we
        // never stored an id) — match the pending row by phone + amount so a
        // real payout gets marked COMPLETED (not double-refunded).
        if (!wtx) {
          const phone = event.data.phone || event.data.phoneNumber;
          const amt = event.data.amountTzs;
          if (phone && amt) {
            wtx = await prisma.transaction.findFirst({
              where: { type: "WITHDRAWAL", status: "PENDING", ntzsWithdrawId: null, phone: String(phone), amountTzs: Number(amt) },
              orderBy: { createdAt: "desc" },
            });
          }
        }
        if (wtx) {
          await prisma.transaction.update({ where: { id: wtx.id }, data: { status: "COMPLETED", ntzsWithdrawId: event.data.id } });
          await notifyUserPartners(wtx.userId, "withdrawal.completed", { amountTzs: wtx.amountTzs, transactionId: wtx.id });
        }
        break;
      }

      case "withdrawal.failed": {
        // Reverse the balance deduction made at withdrawal initiation.
        let wtx = await prisma.transaction.findFirst({
          where: { ntzsWithdrawId: event.data.id, status: "PENDING" },
        });
        // Fallback: ambiguous held withdrawal (no id stored) — match by phone+amount.
        if (!wtx) {
          const phone = event.data.phone || event.data.phoneNumber;
          const amt = event.data.amountTzs;
          if (phone && amt) {
            wtx = await prisma.transaction.findFirst({
              where: { type: "WITHDRAWAL", status: "PENDING", ntzsWithdrawId: null, phone: String(phone), amountTzs: Number(amt) },
              orderBy: { createdAt: "desc" },
            });
          }
        }
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
