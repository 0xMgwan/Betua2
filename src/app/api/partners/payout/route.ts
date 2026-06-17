import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "partner-secret");
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const MIN_PAYOUT_TZS = 1000;

// Pay out a partner's accrued markup earnings to a mobile-money phone.
// Earnings sit in the settlement pool as a liability; this sends pool → phone
// and debits earningsTzs atomically (reversed if the nTZS API rejects it).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("partner_token")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const partnerId = payload.partnerId as string;

    const { amountTzs, phone } = await req.json();
    const amt = Math.round(Number(amountTzs));

    if (!amt || amt < MIN_PAYOUT_TZS) {
      return NextResponse.json({ error: `Minimum payout is ${MIN_PAYOUT_TZS.toLocaleString()} TZS` }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    if (!PLATFORM_NTZS_USER_ID) {
      return NextResponse.json({ error: "Settlement wallet not configured." }, { status: 500 });
    }

    // Atomic guarded debit — only succeeds if earnings cover the amount.
    const debit = await prisma.partner.updateMany({
      where: { id: partnerId, earningsTzs: { gte: amt } },
      data: { earningsTzs: { decrement: amt } },
    });
    if (debit.count === 0) {
      const p = await prisma.partner.findUnique({ where: { id: partnerId }, select: { earningsTzs: true } });
      return NextResponse.json(
        { error: `Insufficient earnings. Available: ${(p?.earningsTzs ?? 0).toLocaleString()} TZS` },
        { status: 400 },
      );
    }

    // Send from the settlement pool to the partner's phone.
    try {
      const withdrawal = await ntzs.withdrawals.create({
        userId: PLATFORM_NTZS_USER_ID,
        amountTzs: amt,
        phone,
      });
      await prisma.partnerEarning.create({
        data: {
          partnerId,
          type: "PAYOUT",
          amountTzs: -amt,
          description: `Payout to ${phone}`,
        },
      });
      return NextResponse.json({ ok: true, withdrawalId: withdrawal.id, amountTzs: amt, phone });
    } catch (err) {
      // Reverse the debit on failure.
      await prisma.partner.update({ where: { id: partnerId }, data: { earningsTzs: { increment: amt } } });
      console.error("Partner payout failed, reversed earnings debit:", err);
      if (err instanceof NtzsApiError) return NextResponse.json({ error: err.message || "Payout failed" }, { status: 400 });
      return NextResponse.json({ error: "Payout failed" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Payout failed" }, { status: 500 });
  }
}
