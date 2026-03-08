import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amountTzs, phone } = await req.json();

  if (!amountTzs || amountTzs < 1000) {
    return NextResponse.json({ error: "Minimum withdrawal is 1,000 TZS" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.ntzsUserId) {
    return NextResponse.json({ error: "Wallet not yet provisioned. Please contact support." }, { status: 400 });
  }

  // Check on-chain balance before attempting withdrawal
  try {
    const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
    if (balanceTzs < amountTzs) {
      return NextResponse.json({
        error: `Insufficient balance. Available: ${balanceTzs.toLocaleString()} TZS`,
      }, { status: 400 });
    }
  } catch {
    // If balance check fails, let NTZS handle it
  }

  try {
    const withdrawal = await ntzs.withdrawals.create({
      userId: user.ntzsUserId,
      amountTzs,
      phoneNumber: phone, // NTZS API uses 'phoneNumber'
    });

    await prisma.transaction.create({
      data: {
        userId: session.userId,
        type: "WITHDRAWAL",
        amountTzs,
        status: "PENDING",
        ntzsWithdrawId: withdrawal.id,
        phone,
      },
    });

    return NextResponse.json({ withdrawal });
  } catch (err) {
    console.error("Withdrawal error:", err);
    if (err instanceof NtzsApiError) {
      return NextResponse.json({ error: err.message || err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Withdrawal failed. Please try again." }, { status: 500 });
  }
}
