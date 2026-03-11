import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processReferralReward } from "@/lib/referral";

export async function POST(req: NextRequest) {
  const event = await req.json();

  try {
    switch (event.type) {
      case "deposit.completed": {
        // Find the transaction first so we have userId + amount for referral
        const tx = await prisma.transaction.findFirst({
          where: { ntzsDepositId: event.data.id },
        });
        await prisma.transaction.updateMany({
          where: { ntzsDepositId: event.data.id },
          data: { status: "COMPLETED" },
        });
        // Process referral reward
        if (tx) {
          processReferralReward(tx.userId, tx.id, tx.amountTzs).catch(() => {});
        }
        break;
      }
      case "withdrawal.completed": {
        await prisma.transaction.updateMany({
          where: { ntzsWithdrawId: event.data.id },
          data: { status: "COMPLETED" },
        });
        break;
      }
      case "withdrawal.failed":
      case "deposit.failed": {
        const field = event.type.startsWith("deposit")
          ? { ntzsDepositId: event.data.id }
          : { ntzsWithdrawId: event.data.id };
        await prisma.transaction.updateMany({
          where: field,
          data: { status: "FAILED" },
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ received: true });
}
