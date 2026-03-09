import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

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

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.ntzsUserId) {
    return NextResponse.json({ error: "Wallet not yet provisioned. Please contact support." }, { status: 400 });
  }

  try {
    console.log("[Deposit] Creating nTZS deposit:", {
      userId: user.ntzsUserId,
      amountTzs,
      phone,
    });
    
    const deposit = await ntzs.deposits.create({
      userId: user.ntzsUserId,
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

    return NextResponse.json({ deposit });
  } catch (err) {
    console.error("Deposit error:", err);
    if (err instanceof NtzsApiError) {
      return NextResponse.json({ error: err.message || err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Deposit failed. Please try again." }, { status: 500 });
  }
}
