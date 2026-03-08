import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const event = await req.json();

  try {
    switch (event.type) {
      case "deposit.completed": {
        await prisma.transaction.updateMany({
          where: { ntzsDepositId: event.data.id },
          data: { status: "COMPLETED" },
        });
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
