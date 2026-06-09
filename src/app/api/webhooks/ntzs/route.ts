import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processReferralReward } from "@/lib/referral";

export async function POST(req: NextRequest) {
  const event = await req.json();

  try {
    switch (event.type) {
      case "deposit.completed": {
        // Balance was already credited optimistically at deposit initiation.
        // Just mark the transaction as COMPLETED and process referral reward.
        const tx = await prisma.transaction.findFirst({
          where: { ntzsDepositId: event.data.id },
        });
        if (!tx) break;

        await prisma.transaction.updateMany({
          where: { ntzsDepositId: event.data.id, status: "PENDING" },
          data: { status: "COMPLETED" },
        });

        processReferralReward(tx.userId, tx.id, tx.amountTzs).catch(() => {});
        break;
      }

      case "deposit.failed": {
        // Reverse the optimistic credit that was applied at initiation
        const tx = await prisma.transaction.findFirst({
          where: { ntzsDepositId: event.data.id },
        });
        if (!tx || tx.status === "FAILED") break; // already reversed

        await prisma.$transaction([
          prisma.transaction.updateMany({
            where: { ntzsDepositId: event.data.id },
            data: { status: "FAILED" },
          }),
          // Reverse the optimistic credit — clamp to 0 to avoid negative
          prisma.user.update({
            where: { id: tx.userId },
            data: { balanceTzs: { decrement: tx.amountTzs } },
          }),
        ]);
        break;
      }

      case "withdrawal.completed": {
        await prisma.transaction.updateMany({
          where: { ntzsWithdrawId: event.data.id },
          data: { status: "COMPLETED" },
        });
        break;
      }

      case "withdrawal.failed": {
        // Reverse the balance deduction if withdrawal failed
        const wtx = await prisma.transaction.findFirst({
          where: { ntzsWithdrawId: event.data.id },
        });
        if (wtx && wtx.status !== "FAILED") {
          await prisma.$transaction([
            prisma.transaction.updateMany({
              where: { ntzsWithdrawId: event.data.id },
              data: { status: "FAILED" },
            }),
            prisma.user.update({
              where: { id: wtx.userId },
              data: { balanceTzs: { increment: wtx.amountTzs } },
            }),
          ]);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ received: true });
}
