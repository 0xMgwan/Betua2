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
      // forwarded to the fee wallet below (same as the parimutuel path does).
      // gross = payoutTzs / (1 - FEE_PERCENT), fee = gross × FEE_PERCENT
      settlementFee = Math.round(payoutTzs * FEE_PERCENT / (1 - FEE_PERCENT));
    } else {
      // ── Parimutuel fallback for positions created before this fix ────────
      // Fetch all positions to calculate total winning shares.
      // Exclude the market creator's seeded LP position to avoid dilution.
      const allPositions = await prisma.position.findMany({
        where: { marketId: position.marketId },
        include: { market: { select: { creatorId: true, seedAmount: true } } },
      });

      let totalWinningShares = 0;
      for (const p2 of allPositions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p2a = p2 as any;
        let posShares = 0;
        if (isMultiOption) {
          const optShares = (p2a.optionShares as Record<string, number>) || {};
          posShares = optShares[String(outcome)] || 0;
        } else {
          posShares = outcome === 1 ? p2.yesShares : p2.noShares;
        }
        // Exclude creator LP seed position from bettor pool
        if (!(p2a.market?.seedAmount > 0 && p2.userId === p2a.market.creatorId)) {
          totalWinningShares += posShares;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seedAmount = (position.market as any).seedAmount ?? 0;
      const pot = Math.round(position.market.totalVolume * (1 - FEE_PERCENT));
      const lpPotClaim = seedAmount > 0 && position.market.totalVolume > 0
        ? Math.round((seedAmount / position.market.totalVolume) * pot)
        : 0;
      const regularPot = Math.max(0, pot - lpPotClaim);

      const grossPayout = totalWinningShares > 0
        ? Math.round((winningShares / totalWinningShares) * regularPot)
        : 0;
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

    // ── Withdraw payout from settlement pool → user's phone (or wallet) ────
    // Position is locked (redeemed=true). Settlement pool sends nTZS to the
    // user's phone number via nTZS withdrawal API.
    // If the user has a personal ntzsUserId (legacy), send there instead.
    // On any on-chain error we still credit DB balance — position is already locked.
    let ntzsTransferId: string | undefined;
    let ntzsTransferUncertain = false;
    const swapFailed = false;

    if (PLATFORM_NTZS_USER_ID) {
      try {
        if (user.ntzsUserId) {
          // Legacy: user has own wallet — transfer directly
          const transfer = await ntzs.transfers.create({
            fromUserId: PLATFORM_NTZS_USER_ID,
            toUserId: user.ntzsUserId,
            amountTzs: payoutTzs,
          });
          ntzsTransferId = transfer.id;
        } else if (user.phone) {
          // New model: withdraw from settlement pool → user's mobile number
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const withdrawal = await (ntzs as any).withdrawals.create({
            userId: PLATFORM_NTZS_USER_ID,
            amountTzs: payoutTzs,
            phone: user.phone,
          });
          ntzsTransferId = withdrawal.id;
        }
        // If no phone and no wallet, just credit DB balance (fallthrough)
      } catch (err) {
        ntzsTransferUncertain = true;
        console.error("[Redeem] payout transfer error (position locked, proceeding):", err);
      }
    }

    // Effective currency — no swaps in the new pool model, TZS only on-chain
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
      message: `Redeemed ${payoutDisplay} from "${position.market.title}"`,
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
