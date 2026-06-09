import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";

// All deposits go to the settlement pool wallet.
// Balance is credited immediately on initiation (optimistic) and reversed
// by the webhook if the deposit.failed event fires.
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amountTzs, phone } = await req.json();

  if (!amountTzs || amountTzs < 1000) {
    return NextResponse.json({ error: "Minimum deposit is 1,000 TZS" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }
  if (!PLATFORM_NTZS_USER_ID) {
    return NextResponse.json({ error: "Settlement wallet not configured." }, { status: 500 });
  }

  try {
    // STK push — nTZS minted directly into the settlement pool wallet
    const deposit = await ntzs.deposits.create({
      userId: PLATFORM_NTZS_USER_ID,
      amountTzs,
      phone,
    });

    // Credit balance immediately (optimistic) + create PENDING transaction atomically.
    // If the deposit fails, the webhook fires deposit.failed which reverses the credit.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceTzs: { increment: amountTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "DEPOSIT",
          amountTzs,
          status: "PENDING",
          ntzsDepositId: deposit.id,
          phone,
        },
      }),
    ]);

    createNotification({
      userId: session.userId,
      type: "DEPOSIT",
      title: "Deposit Initiated",
      message: `TSh ${amountTzs.toLocaleString()} added to your balance. Complete the STK push on your phone to confirm.`,
      link: `/wallet`,
    });

    return NextResponse.json({ deposit });
  } catch (err) {
    console.error("Deposit error:", err);
    if (err instanceof NtzsApiError) {
      return NextResponse.json({ error: err.message || err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Deposit failed. Please try again." }, { status: 500 });
  }
}
