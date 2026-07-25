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

  // `expectedBurnTzs` is the total the user was shown on the confirmation card.
  // If the fresh quote comes back dearer we stop and re-confirm rather than
  // silently charging more than they agreed to.
  const { amountTzs, phone, expectedBurnTzs } = await req.json();

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

  // Pooled custodial model: DB balance is the single source of truth and is fully
  // backed by the platform wallet. Withdrawals are always paid from the platform
  // wallet against the DB balance. We no longer read or pay from personal nTZS
  // wallets, and we never sync the DB balance up to a personal wallet (that
  // legitimised leaked/legacy personal-wallet funds).
  const dbBalance = user.balanceTzs || 0;

  if (dbBalance < amountTzs) {
    return NextResponse.json({
      error: `Insufficient balance. Available: ${dbBalance.toLocaleString()} TZS`,
    }, { status: 400 });
  }

  // nTZS enforces quotes on all cash-outs: POST /withdrawals without a quoteId
  // is rejected with `quote_required`. Quote here (not on the client) so the
  // price we charge is always one we just fetched — quotes live 5 minutes and
  // the confirmation card's may already be stale.
  let quote;
  try {
    quote = await ntzs.withdrawals.quote({
      userId: PLATFORM_NTZS_USER_ID,
      amountTzs,
      phone,
    });
  } catch (qErr) {
    console.error("Withdrawal quote failed:", qErr);
    return NextResponse.json({
      error: "We couldn't price that withdrawal right now. Your balance is unchanged — please try again.",
    }, { status: 400 });
  }

  if (!quote.quoteId || !quote.balance?.sufficient) {
    // The pool can't cover it. Never leak pool state to the user.
    console.error("Withdrawal quote unfunded:", { amountTzs, quoted: quote.burnAmountTzs, pool: quote.balance });
    return NextResponse.json({
      error: "Withdrawals are temporarily unavailable. Your balance is unchanged — please try again shortly.",
    }, { status: 400 });
  }

  // Fees are charged on top of what lands on the phone, and the user pays them,
  // so the amount debited is the full burn amount.
  const burnTzs = quote.burnAmountTzs;

  if (dbBalance < burnTzs) {
    return NextResponse.json({
      error: `Insufficient balance. This cash-out costs ${burnTzs.toLocaleString()} TZS including fees, but you have ${dbBalance.toLocaleString()} TZS.`,
    }, { status: 400 });
  }

  if (typeof expectedBurnTzs === "number" && burnTzs > expectedBurnTzs) {
    return NextResponse.json({
      error: "Fees changed while you were confirming. Please review the updated total.",
      code: "quote_stale",
      quote: {
        recipientName: quote.recipientName,
        receiveAmountTzs: quote.receiveAmountTzs,
        burnAmountTzs: burnTzs,
        fees: quote.fees,
      },
    }, { status: 409 });
  }

  try {
    // Debit DB balance immediately + create PENDING record atomically.
    // amountTzs on the row is the burn amount — it's what we took, and what the
    // withdrawal.failed webhook refunds.
    const [, tx] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceTzs: { decrement: burnTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "WITHDRAWAL",
          amountTzs: burnTzs,
          status: "PENDING",
          phone,
          description: `Sent ${quote.receiveAmountTzs.toLocaleString()} TZS + ${quote.fees.totalFeeTzs.toLocaleString()} TZS fees`,
        },
      }),
    ]);

    // Send nTZS → user's phone from the platform wallet (settlement pool).
    // Mark COMPLETED immediately on successful API call — if nTZS accepted it, it will be sent.
    // webhook withdrawal.failed will reverse if something goes wrong on nTZS side.
    const fromUserId = PLATFORM_NTZS_USER_ID;
    let withdrawalId: string | undefined;
    try {
      const withdrawal = await ntzs.withdrawals.create({
        userId: fromUserId,
        amountTzs, // must match the quote exactly — this is the receive amount
        phone,
        quoteId: quote.quoteId,
      });
      withdrawalId = withdrawal.id;
      // Mark COMPLETED right away — no GET /withdrawals/:id polling needed
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { ntzsWithdrawId: withdrawal.id, status: "COMPLETED" },
      });
    } catch (wErr) {
      // CRITICAL: only refund when we KNOW nTZS did not send the money.
      //  - An explicit 4xx rejection (invalid input, insufficient pool, etc.)
      //    means nTZS declined it → the payout was NOT made → safe to refund + FAIL.
      //  - A timeout / network error / 5xx is AMBIGUOUS: nTZS may have already
      //    burned + paid out. Refunding here caused a double-payout (money out
      //    AND balance restored) that drained the pool. In that case we DON'T
      //    refund — keep the balance debited and leave the row PENDING for the
      //    withdrawal.completed/failed webhook (or admin reconcile) to resolve.
      const isExplicitReject = wErr instanceof NtzsApiError && wErr.status >= 400 && wErr.status < 500;
      if (isExplicitReject) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: session.userId },
            data: { balanceTzs: { increment: burnTzs } },
          }),
          prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } }),
        ]);
        console.error("Withdrawal explicitly rejected by nTZS, refunded:", wErr);
        throw wErr;
      }
      // Ambiguous failure — do NOT refund. Leave PENDING (balance stays debited).
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: "PENDING", description: "nTZS call errored — awaiting reconcile (no auto-refund to avoid double-payout)" },
      });
      console.error("Withdrawal AMBIGUOUS (timeout/5xx) — held PENDING, NOT refunded:", wErr);
      return NextResponse.json({
        error: "Your withdrawal is being verified. If it doesn't arrive shortly it will be reversed — please don't retry yet.",
      }, { status: 202 });
    }

    createNotification({
      userId: session.userId,
      type: "WITHDRAW",
      title: "Withdrawal Sent",
      message: `TSh ${quote.receiveAmountTzs.toLocaleString()} is being sent to ${phone}. You will receive it shortly.`,
      link: `/wallet`,
    });

    return NextResponse.json({
      success: true,
      withdrawalId,
      receiveAmountTzs: quote.receiveAmountTzs,
      burnAmountTzs: burnTzs,
      feeTzs: quote.fees.totalFeeTzs,
    });
  } catch (err) {
    console.error("Withdrawal error:", err);
    // Reaches here only for explicit rejections (balance already reversed above)
    // or pre-nTZS validation errors. Friendly, retry-able, no pool-state leak.
    const raw = (err instanceof NtzsApiError ? (err.message || err.code) : String(err || "")).toLowerCase();
    const friendly = /insufficient|balance|liquidity|funds/.test(raw)
      ? "Withdrawal is temporarily unavailable. Your balance is unchanged — please try again in a little while."
      : "We couldn't process that withdrawal right now. Your balance is unchanged — please try again.";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }
}
