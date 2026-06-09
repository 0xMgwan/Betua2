import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";

// All deposits go to the settlement pool wallet. The user's DB balance is
// credited when the deposit is confirmed via webhook or sync polling.
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
    console.log("[Deposit] Creating deposit to settlement pool:", {
      settlementPool: PLATFORM_NTZS_USER_ID,
      amountTzs,
      phone,
    });

    // STK push — nTZS minted directly into the settlement pool wallet
    const deposit = await ntzs.deposits.create({
      userId: PLATFORM_NTZS_USER_ID,
      amountTzs,
      phone,
    });

    await prisma.transaction.create({
      data: {
        userId: session.userId,
        type: "DEPOSIT",
        amountTzs,
        status: "PENDING",
        ntzsDepositId: deposit.id,
        phone,
      },
    });

    createNotification({
      userId: session.userId,
      type: "DEPOSIT",
      title: "Deposit Initiated",
      message: `Deposit of ${amountTzs.toLocaleString()} TZS initiated. Check your phone for the STK push.`,
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
