import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processReferralReward } from "@/lib/referral";

export async function POST(req: NextRequest) {
  const event = await req.json();

  try {
    switch (event.type) {
      case "deposit.completed": {
        const tx = await prisma.transaction.findFirst({
          where: { ntzsDepositId: event.data.id },
        });
        if (!tx) break;

        await prisma.$transaction([
          // Mark transaction as completed
          prisma.transaction.updateMany({
            where: { ntzsDepositId: event.data.id },
            data: { status: "COMPLETED" },
          }),
          // Credit user's TZS DB balance
          prisma.user.update({
            where: { id: tx.userId },
            data: { balanceTzs: { increment: tx.amountTzs } },
          }),
        ]);

        // Process referral reward on first completed deposit
        processReferralReward(tx.userId, tx.id, tx.amountTzs).catch(() => {});
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

        // On deposit failure, reverse the balance credit if it was already applied
        if (event.type === "deposit.failed") {
          const tx = await prisma.transaction.findFirst({ where: field });
          if (tx && tx.status !== "FAILED") {
            await prisma.$transaction([
              prisma.transaction.updateMany({ where: field, data: { status: "FAILED" } }),
              // Only reverse if it was marked COMPLETED (shouldn't happen but safety net)
              ...(tx.status === "COMPLETED" ? [
                prisma.user.update({
                  where: { id: tx.userId },
                  data: { balanceTzs: { decrement: tx.amountTzs } },
                })
              ] : []),
            ]);
          }
        } else {
          await prisma.transaction.updateMany({ where: field, data: { status: "FAILED" } });
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return NextResponse.json({ received: true });
}
