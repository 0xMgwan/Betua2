import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

/**
 * POST /api/wallet/withdraw/quote
 *
 * Prices a cash-out before the user confirms it. nTZS charges fees ON TOP of
 * the amount the recipient gets, so the user is shown — and charged — the full
 * burn amount. The quoteId returned here is display-only: /api/wallet/withdraw
 * fetches its own fresh quote at send time so a stale price can never be used.
 */
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
    select: { balanceTzs: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const quote = await ntzs.withdrawals.quote({
      userId: PLATFORM_NTZS_USER_ID,
      amountTzs,
      phone,
    });

    // The user pays the fees, so their DB balance must cover the burn amount,
    // not just what lands on their phone.
    const dbBalance = user.balanceTzs || 0;
    const sufficient = dbBalance >= quote.burnAmountTzs;

    return NextResponse.json({
      // Deliberately not exposing quote.balance — that's the platform pool.
      quoteId: quote.quoteId,
      expiresAt: quote.expiresAt,
      recipientName: quote.recipientName,
      receiveAmountTzs: quote.receiveAmountTzs,
      burnAmountTzs: quote.burnAmountTzs,
      fees: quote.fees,
      balanceTzs: dbBalance,
      sufficient,
      error: sufficient
        ? null
        : `Insufficient balance. This cash-out costs ${quote.burnAmountTzs.toLocaleString()} TZS including fees, but you have ${dbBalance.toLocaleString()} TZS.`,
    });
  } catch (err) {
    console.error("Withdrawal quote error:", err);
    const msg =
      err instanceof NtzsApiError && /phone|number|msisdn|recipient/i.test(err.message || err.code)
        ? "We couldn't verify that phone number. Please check it and try again."
        : "We couldn't price that withdrawal right now. Please try again in a moment.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
