import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs } from "@/lib/ntzs";
import { bkes } from "@/lib/bkes";
import { createNotification } from "@/lib/notify";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { positionId } = await req.json();

    if (!positionId) {
      return NextResponse.json({ error: "Position ID required" }, { status: 400 });
    }

    // Get position with market details
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { market: true },
    });

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    if (position.userId !== session.userId) {
      return NextResponse.json({ error: "Not your position" }, { status: 403 });
    }

    if (position.market.status !== "RESOLVED") {
      return NextResponse.json({ error: "Market not resolved yet" }, { status: 400 });
    }

    if (position.redeemed) {
      return NextResponse.json({ error: "Already redeemed" }, { status: 400 });
    }

    // Atomically mark as redeemed FIRST to prevent race conditions
    // Only update if redeemed is still false (prevents double-click exploit)
    const lockResult = await prisma.position.updateMany({
      where: { 
        id: positionId, 
        redeemed: false  // Only update if not already redeemed
      },
      data: { redeemed: true }
    });

    // If no rows were updated, someone else already redeemed it
    if (lockResult.count === 0) {
      return NextResponse.json({ error: "Already redeemed (concurrent request)" }, { status: 400 });
    }

    // Calculate payout using proportional pot distribution
    const outcome = position.market.outcome;
    const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;
    const isMultiOption = !!(position.market.options && (position.market.options as string[]).length >= 2);
    let winningShares = 0;

    if (isMultiOption) {
      // Multi-option market: outcome is the index of the winning option
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optShares = (position.optionShares as any) || {};
      winningShares = optShares[String(outcome)] || 0;
    } else {
      // Binary market: outcome is 0 (NO) or 1 (YES)
      if (outcome === 1) {
        winningShares = position.yesShares;
      } else if (outcome === 0) {
        winningShares = position.noShares;
      } else {
        return NextResponse.json({ error: "Invalid market outcome" }, { status: 400 });
      }
    }

    if (winningShares === 0) {
      return NextResponse.json({ error: "No winning shares to redeem" }, { status: 400 });
    }

    // ── Fixed-odds payout (primary) ───────────────────────────────────────────
    // If impliedPayout was stored at trade time, use it directly.
    // This guarantees the user gets what the odds showed when they traded —
    // regardless of how many other bettors are on the winning side.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pos = position as any;
    let storedImpliedPayout = 0;
    if (isMultiOption) {
      const implied = (pos.optionImpliedPayouts as Record<string, number>) || {};
      storedImpliedPayout = implied[String(outcome)] || 0;
    } else {
      storedImpliedPayout = outcome === 1 ? (pos.yesImpliedPayout || 0) : (pos.noImpliedPayout || 0);
    }

    let payoutTzs: number;
    // settlementFee is only used in parimutuel fallback; in fixed-odds it was
    // already baked into payoutIfWin at trade time, so no separate fee transfer needed.
    let settlementFee = 0;

    if (storedImpliedPayout > 0) {
      // ── Fixed-odds path: pay the stored guaranteed amount ────────────────
      // payoutIfWin was already net of both fees when stored, so pay it directly.
      payoutTzs = Math.round(storedImpliedPayout);
      // Derive the settlement fee that was baked in at trade time so it can be
      // forwarded to the fee wallet below.
      settlementFee = Math.round(payoutTzs * FEE_PERCENT / (1 - FEE_PERCENT));
    } else {
      // ── Share-based fallback for positions with no stored payout ─────────
      // Each winning share redeems for 1 TZS (CPMM convention). Pay shares × 1,
      // net of the 5% settlement fee. This matches the fixed-odds value the user
      // saw and avoids the parimutuel dilution that previously underpaid winners
      // (e.g. 4,770 winning shares → 4,531 net, not a pot-split fraction).
      const grossPayout = Math.round(winningShares); // 1 TZS per winning share
      settlementFee = Math.round(grossPayout * FEE_PERCENT);
      payoutTzs = grossPayout - settlementFee;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine user's preferred currency for payout
    // USDC rate: 1 USDC = 2630 TZS
    // USDC is now stored as float (e.g., 1.50), not micro-USDC
    const USDC_TO_TZS_RATE = 2630;
    const preferredCurrency = (user.preferredCurrency as Currency) || getUserCurrency(user.country);
    
    let payoutInUserCurrency: number;
    let payoutUsdc = 0;
    
    if (preferredCurrency === 'USDC') {
      // Convert TZS payout to USDC (float)
      payoutUsdc = payoutTzs / USDC_TO_TZS_RATE;
      payoutInUserCurrency = payoutUsdc; // Already in USDC
    } else if (preferredCurrency === 'KES') {
      payoutInUserCurrency = convertCurrency(payoutTzs, 'TZS', 'KES');
    } else {
      payoutInUserCurrency = payoutTzs;
    }

    // ── Credit DB balance only — unified custodial model ─────────────────
    // Winnings stay in the settlement pool; the DB balance is the claim on it.
    // Users cash out via Wallet → Withdraw (pool → phone). This applies to
    // EVERYONE including legacy users — no direct pool→personal-wallet transfer,
    // which previously double-credited (DB + wallet) and let funds be withdrawn twice.
    const ntzsTransferId: string | undefined = undefined;
    const ntzsTransferUncertain = false;
    const swapFailed = false;

    // Effective currency
    const effectiveCurrency = preferredCurrency;

    // Transfer settlement fee — delayed 1.5s to avoid nonce collision with main transfer
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && settlementFee > 0) {
      setTimeout(() => {
        ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
          amountTzs: settlementFee,
        }).catch((feeErr) => {
          console.error("Settlement fee transfer failed (non-fatal):", feeErr);
        });
      }, 1500);
    }

    // Credit local balance + create transaction record
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: effectiveCurrency === 'USDC'
          ? { balanceUsdc: { increment: payoutUsdc } }
          : effectiveCurrency === 'KES'
            ? { balanceKes: { increment: payoutInUserCurrency } }
            : { balanceTzs: { increment: payoutTzs } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "REDEEM",
          amountTzs: effectiveCurrency === 'TZS' ? payoutTzs : 0,
          amountKes: effectiveCurrency === 'KES' ? payoutInUserCurrency : 0,
          amountUsdc: effectiveCurrency === 'USDC' ? payoutUsdc : 0,
          currency: effectiveCurrency,
          status: "COMPLETED",
          recipientUsername: isMultiOption
            ? `${position.market.title} (${(position.market.options as string[])[outcome as number]})`
            : `${position.market.title} (${outcome === 1 ? "YES" : "NO"})`,
        },
      }),
    ]);

    // Notification: redemption successful
    const payoutDisplay = effectiveCurrency === 'USDC'
      ? `$${payoutUsdc.toFixed(2)}`
      : `${payoutInUserCurrency.toLocaleString()} ${effectiveCurrency}`;
    createNotification({
      userId: session.userId,
      type: "REDEEM",
      title: "Winnings Redeemed!",
      message: `${payoutDisplay} added to your wallet from "${position.market.title}". Withdraw anytime from the Wallet page.`,
      link: `/wallet`,
    });

    return NextResponse.json({
      success: true,
      payout: payoutInUserCurrency,
      payoutTzs,
      payoutUsdc: effectiveCurrency === 'USDC' ? payoutUsdc : undefined,
      currency: effectiveCurrency,
      winningShares,
      positionId,
      ntzsTransferId,
      ntzsTransferUncertain: ntzsTransferUncertain || undefined,
      swapFailed: swapFailed || undefined,
    });
  } catch (err) {
    console.error("Redeem error:", err);
    return NextResponse.json({ error: "Redeem failed. Please try again." }, { status: 500 });
  }
}
