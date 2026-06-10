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
    select: { id: true, balanceTzs: true, ntzsUserId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Determine the funding source for this withdrawal:
  //  - "pool":   custodial users — DB balance backed by settlement pool
  //  - "wallet": legacy users whose funds still sit in their personal nTZS wallet
  //              (DB balance shows lower than what the wallet holds)
  let dbBalance = user.balanceTzs || 0;
  let source: "pool" | "wallet" = "pool";

  if (dbBalance < amountTzs && user.ntzsUserId) {
    // Check their personal nTZS wallet — they may have legacy funds there
    try {
      const { balanceTzs: walletTzs } = await ntzs.users.getBalance(user.ntzsUserId);
      if ((walletTzs || 0) >= amountTzs) {
        source = "wallet";
        // Sync DB to reflect the personal wallet balance so accounting is consistent
        dbBalance = Math.max(dbBalance, walletTzs || 0);
        await prisma.user.update({
          where: { id: session.userId },
          data: { balanceTzs: dbBalance },
        });
      }
    } catch { /* nTZS API down — fall through to insufficient check below */ }
  }

  if (dbBalance < amountTzs) {
    return NextResponse.json({
      error: `Insufficient balance. Available: ${dbBalance.toLocaleString()} TZS`,
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

    // Send nTZS → user's phone from the correct source:
    //  - legacy "wallet": from the user's own personal nTZS wallet
    //  - custodial "pool": from the settlement pool
    // Mark COMPLETED immediately on successful API call — if nTZS accepted it, it will be sent.
    // webhook withdrawal.failed will reverse if something goes wrong on nTZS side.
    const fromUserId = source === "wallet" && user.ntzsUserId ? user.ntzsUserId : PLATFORM_NTZS_USER_ID;
    let withdrawalId: string | undefined;
    try {
      const withdrawal = await ntzs.withdrawals.create({
        userId: fromUserId,
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
