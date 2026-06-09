import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";

// Withdrawals come from the settlement pool wallet. DB balance debited
// immediately; reversed by webhook if withdrawal.failed fires.
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";

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
  if (!PLATFORM_NTZS_USER_ID) {
    return NextResponse.json({ error: "Settlement wallet not configured." }, { status: 500 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, balanceTzs: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if ((user.balanceTzs || 0) < amountTzs) {
    return NextResponse.json({
      error: `Insufficient balance. Available: ${(user.balanceTzs || 0).toLocaleString()} TZS`,
    }, { status: 400 });
  }

  try {
    // Debit DB balance immediately + create PENDING record atomically
    const [, tx] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceTzs: { decrement: amountTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "WITHDRAWAL",
          amountTzs,
          status: "PENDING",
          phone,
        },
      }),
    ]);

    // Settlement pool sends nTZS → user's phone
    // Mark COMPLETED immediately on successful API call — if nTZS accepted it, it will be sent.
    // webhook withdrawal.failed will reverse if something goes wrong on nTZS side.
    let withdrawalId: string | undefined;
    try {
      const withdrawal = await ntzs.withdrawals.create({
        userId: PLATFORM_NTZS_USER_ID,
        amountTzs,
        phone,
      });
      withdrawalId = withdrawal.id;
      // Mark COMPLETED right away — no GET /withdrawals/:id polling needed
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { ntzsWithdrawId: withdrawal.id, status: "COMPLETED" },
      });
    } catch (wErr) {
      // Withdrawal API failed — reverse the deduction and mark FAILED
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { balanceTzs: { increment: amountTzs } },
        }),
        prisma.transaction.update({
          where: { id: tx.id },
          data: { status: "FAILED" },
        }),
      ]);
      console.error("Withdrawal API failed, reversed deduction:", wErr);
      throw wErr;
    }

    createNotification({
      userId: session.userId,
      type: "WITHDRAW",
      title: "Withdrawal Sent",
      message: `TSh ${amountTzs.toLocaleString()} is being sent to ${phone}. You will receive it shortly.`,
      link: `/wallet`,
    });

    return NextResponse.json({ success: true, withdrawalId });
  } catch (err) {
    console.error("Withdrawal error:", err);
    if (err instanceof NtzsApiError) {
      return NextResponse.json({ error: err.message || err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Withdrawal failed. Please try again." }, { status: 500 });
  }
}
