import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createNotification, createNotifications } from "@/lib/notify";
import { notifyMarketResolved } from "@/lib/push";
import { ntzs } from "@/lib/ntzs";

const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;
const CREATOR_FEE_PERCENT = 0.01; // 1% of total volume goes to non-admin creators
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  // Support both binary (outcome: true/false) and multi-option (optionIndex: number)
  const { outcome, optionIndex } = body;

  const market = await prisma.market.findUnique({
    where: { id },
    include: { positions: { include: { user: true } } },
  });

  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (market.creatorId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (market.status !== "OPEN") {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mkt = market as any;
  const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;

  if (isMultiOption) {
    // optionIndex === -1 means "None" — no winner
    if (optionIndex === undefined || optionIndex < -1 || optionIndex >= mkt.options.length) {
      return NextResponse.json({ error: "Invalid winning option" }, { status: 400 });
    }
  }

  const isNoneOutcome = isMultiOption && optionIndex === -1;
  const winningOutcome = isNoneOutcome ? -1 : (isMultiOption ? optionIndex : (outcome ? 1 : 0));
  const winningLabel = isNoneOutcome ? "None" : (isMultiOption ? (mkt.options as string[])[optionIndex] : (outcome ? "YES" : "NO"));

  await prisma.market.update({
    where: { id },
    data: {
      status: "RESOLVED",
      outcome: winningOutcome,
      outcomeLabel: winningLabel,
      resolvedAt: new Date(),
    },
  });

  // ── Calculate total winning shares first (needed for no-winner check) ──
  let totalWinningSharesPreCheck = 0;
  for (const pos of market.positions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    if (isMultiOption) {
      const optShares = (p.optionShares as Record<string, number>) || {};
      totalWinningSharesPreCheck += optShares[String(winningOutcome)] || 0;
    } else {
      totalWinningSharesPreCheck += outcome ? pos.yesShares : pos.noShares;
    }
  }

  // ── No winners: Transfer pot to settlement fee wallet as revenue ──
  // This handles both "None" outcome AND when a valid option wins but nobody picked it
  let noWinnerRevenue = 0;
  let noWinnerTransferred = false;
  const hasNoWinners = isNoneOutcome || totalWinningSharesPreCheck === 0;
  
  if (hasNoWinners && market.totalVolume > 0 && PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID) {
    // The pot (minus entry fees already taken) goes to settlement fee wallet
    noWinnerRevenue = Math.round(market.totalVolume * (1 - FEE_PERCENT));
    try {
      await ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
        amountTzs: noWinnerRevenue,
      });
      noWinnerTransferred = true;
      const reason = isNoneOutcome ? "None outcome" : `No one picked ${winningLabel}`;
      console.log(`${reason}: Transferred ${noWinnerRevenue} TZS to settlement fee wallet for market ${id}`);
    } catch (err) {
      console.error("No winner revenue transfer failed:", err);
    }
  }

  // ── Payout calculation (for response info only — actual transfers happen in /api/redeem) ──
  // Winners split the totalVolume proportionally based on their winning shares.
  // payout_i = (shares_i / totalWinningShares) × pot × (1 - settlementFee)
  // This guarantees solvency: total payouts ≤ total money deposited.
  const pot = Math.round(market.totalVolume * (1 - FEE_PERCENT));

  // Calculate total winning shares
  let totalWinningShares = 0;
  for (const pos of market.positions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    if (isMultiOption) {
      const optShares = (p.optionShares as Record<string, number>) || {};
      totalWinningShares += optShares[String(winningOutcome)] || 0;
    } else {
      totalWinningShares += outcome ? pos.yesShares : pos.noShares;
    }
  }

  // Calculate expected payouts for response (no transfers here — redeem handles that)
  const payoutSummary = market.positions
    .map((pos) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = pos as any;
      let winningShares = 0;
      if (isMultiOption) {
        const optShares = (p.optionShares as Record<string, number>) || {};
        winningShares = optShares[String(winningOutcome)] || 0;
      } else {
        winningShares = outcome ? pos.yesShares : pos.noShares;
      }
      if (winningShares <= 0) return null;
      const grossPayout = totalWinningShares > 0
        ? Math.round((winningShares / totalWinningShares) * pot)
        : 0;
      const feeAmount = Math.round(grossPayout * FEE_PERCENT);
      const netPayout = grossPayout - feeAmount;
      return { username: pos.user.username, winningShares, grossPayout, fee: feeAmount, netPayout };
    })
    .filter(Boolean);

  // ── Creator Fee: Pay 1% of volume to non-admin market creators ──
  const isAdminCreator = ADMIN_USER_IDS.includes(market.creatorId);
  let creatorFeeAmount = 0;
  let creatorFeePaid = false;
  
  if (!isAdminCreator && market.totalVolume > 0) {
    creatorFeeAmount = Math.round(market.totalVolume * CREATOR_FEE_PERCENT);
    
    if (creatorFeeAmount > 0 && SETTLEMENT_FEE_NTZS_USER_ID) {
      // Get creator's nTZS user ID
      const creator = await prisma.user.findUnique({
        where: { id: market.creatorId },
        select: { ntzsUserId: true, username: true },
      });
      
      if (creator?.ntzsUserId) {
        try {
          // Creator fee comes from SETTLEMENT_FEE wallet (collected fees), NOT platform escrow
          // This ensures solvency: winners get full pot, creator fee comes from platform's fee revenue
          await ntzs.transfers.create({
            fromUserId: SETTLEMENT_FEE_NTZS_USER_ID,
            toUserId: creator.ntzsUserId,
            amountTzs: creatorFeeAmount,
          });
          creatorFeePaid = true;
          
          // Update creator's local balance too
          await prisma.user.update({
            where: { id: market.creatorId },
            data: { balanceTzs: { increment: creatorFeeAmount } },
          });
          
          // Create transaction record for creator
          await prisma.transaction.create({
            data: {
              userId: market.creatorId,
              type: "CREATOR_FEE",
              amountTzs: creatorFeeAmount,
              status: "COMPLETED",
              recipientUsername: `Creator reward: ${market.title}`,
            },
          });
          
          // Notify creator about their reward
          createNotification({
            userId: market.creatorId,
            type: "CREATOR_FEE",
            title: "Creator Reward!",
            message: `You earned ${creatorFeeAmount.toLocaleString()} TZS for creating "${market.title}"`,
            link: `/wallet`,
          });
        } catch (err) {
          console.error("Creator fee transfer failed:", err);
        }
      }
    }
  }

  // Notify all position holders about resolution
  const notificationBatch = market.positions.map((pos) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    let winningShares = 0;
    if (isMultiOption) {
      const optShares = (p.optionShares as Record<string, number>) || {};
      winningShares = optShares[String(winningOutcome)] || 0;
    } else {
      winningShares = outcome ? pos.yesShares : pos.noShares;
    }
    const isWinner = winningShares > 0;
    return {
      userId: pos.userId,
      type: isWinner ? "WINNINGS" as const : "MARKET_RESOLVED" as const,
      title: isWinner ? "You Won!" : "Market Resolved",
      message: isWinner
        ? `You won in "${market.title}" — outcome: ${winningLabel}. Redeem your winnings from your portfolio!`
        : `"${market.title}" resolved: ${winningLabel}`,
      link: isWinner ? `/portfolio` : `/markets/${id}`,
    };
  });

  if (notificationBatch.length > 0) {
    createNotifications(notificationBatch);

    // Push notifications (off-app)
    for (const n of notificationBatch) {
      const payoutInfo = payoutSummary.find(p => p !== null);
      const payout = payoutInfo?.netPayout || 0;
      notifyMarketResolved(n.userId, market.title, winningLabel, n.type === "WINNINGS", payout, id, "en").catch(console.error);
    }
  }

  // ── Auto-redeem LP seed position (creator only, if they seeded) ──────────
  // Regular users still redeem manually. Only the creator's seeded position
  // is auto-paid — they seeded both sides so manual redeem would be confusing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mktAny = market as any;
  if (mktAny.seedAmount > 0) {
    const creatorPosition = market.positions.find(p => p.userId === market.creatorId);
    // Always mark creator's LP position as redeemed (even if no winning shares — losing side gets nothing)
    if (creatorPosition && !creatorPosition.redeemed && (hasNoWinners || totalWinningShares === 0)) {
      prisma.position.update({ where: { id: creatorPosition.id }, data: { redeemed: true } })
        .catch(e => console.error('[LP] failed to mark losing position redeemed:', e));
    }
    if (creatorPosition && !creatorPosition.redeemed && !hasNoWinners) {
      // LP auto-redeem: pay creator based on their seed proportion of the pot,
      // NOT based on winning-side shares. This prevents seed shares from diluting
      // regular bettors' payouts (which caused winners to get far less than AMM-implied odds).
      //
      // LP payout = (seedAmount / totalVolume) * pot × (1 - settlementFee)
      // This is the creator's fair proportional return on their seed capital.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mktAny2 = market as any;
      const seedAmt = mktAny2.seedAmount as number ?? 0;

      if (seedAmt > 0) {
        // Fire-and-forget: auto-redeem creator's LP position
        (async () => {
          try {
            // Lock position atomically
            const lock = await prisma.position.updateMany({
              where: { id: creatorPosition.id, redeemed: false },
              data: { redeemed: true },
            });
            if (lock.count === 0) return; // already redeemed

            // Seed-proportional payout: creator gets (seed / totalVolume) of the pot
            const grossPayout = market.totalVolume > 0
              ? Math.round((seedAmt / market.totalVolume) * pot)
              : 0;
            const settlementFee = Math.round(grossPayout * FEE_PERCENT);
            const payoutTzs = grossPayout - settlementFee;

            // Get creator wallet details
            const creator = await prisma.user.findUnique({
              where: { id: market.creatorId },
              select: { ntzsUserId: true, preferredCurrency: true, country: true, phone: true },
            });

            const { getUserCurrency } = await import('@/lib/currency');
            const creatorCurrency = creator
              ? ((creator.preferredCurrency as string) || getUserCurrency(creator.country, creator.phone))
              : 'TZS';

            // nTZS transfer MUST succeed — if it fails, unmark position so creator can retry
            if (!creator?.ntzsUserId || !PLATFORM_NTZS_USER_ID) {
              // No nTZS config — release lock and bail
              await prisma.position.update({ where: { id: creatorPosition.id }, data: { redeemed: false } });
              console.error('[LP auto-redeem] Missing ntzsUserId or PLATFORM_NTZS_USER_ID — position reset for retry');
              return;
            }

            try {
              await ntzs.transfers.create({
                fromUserId: PLATFORM_NTZS_USER_ID,
                toUserId: creator.ntzsUserId,
                amountTzs: payoutTzs,
              });
            } catch (transferErr) {
              // IMPORTANT: Do NOT reset redeemed to false here.
              // nTZS can return HTTP 500 even when the blockchain transfer actually succeeded.
              // Resetting the lock would allow duplicate transfers if this auto-redeem fires again.
              // Position stays locked. Use /api/admin/lp-repair to diagnose and manually
              // credit the balance if the transfer genuinely failed on-chain.
              console.error('[LP auto-redeem] nTZS transfer error — position stays locked, use admin lp-repair if needed:', transferErr);
              return;
            }

            // Transfer succeeded — now credit local balance + record transaction
            if (creatorCurrency === 'USDC') {
              await ntzs.swap.executeAndWait({
                userId: creator.ntzsUserId,
                fromToken: 'NTZS',
                toToken: 'USDC',
                amount: payoutTzs,
                slippageBps: 100,
              }).catch(e => console.error('[LP auto-redeem] USDC swap failed:', e));
            }

            // Settlement fee (delayed 1.5s to avoid nonce collision)
            if (SETTLEMENT_FEE_NTZS_USER_ID && settlementFee > 0) {
              setTimeout(() => {
                ntzs.transfers.create({
                  fromUserId: PLATFORM_NTZS_USER_ID,
                  toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
                  amountTzs: settlementFee,
                }).catch(e => console.error('[LP auto-redeem] fee transfer failed:', e));
              }, 1500);
            }

            await prisma.$transaction([
              prisma.user.update({
                where: { id: market.creatorId },
                data: creatorCurrency === 'USDC'
                  ? { balanceUsdc: { increment: payoutTzs / 2630 } }
                  : { balanceTzs: { increment: payoutTzs } },
              }),
              prisma.transaction.create({
                data: {
                  userId: market.creatorId,
                  type: 'LP_REDEEM',
                  amountTzs: creatorCurrency === 'TZS' ? payoutTzs : 0,
                  amountUsdc: creatorCurrency === 'USDC' ? payoutTzs / 2630 : 0,
                  currency: creatorCurrency,
                  status: 'COMPLETED',
                  recipientUsername: `LP seed return: ${market.title}`,
                },
              }),
            ]);

            const lpPnl = payoutTzs - seedAmt;
            const pnlStr = lpPnl >= 0
              ? `+${lpPnl.toLocaleString()} TZS profit`
              : `${lpPnl.toLocaleString()} TZS (${Math.abs(Math.round((lpPnl / seedAmt) * 100))}% LP cost)`;
            createNotification({
              userId: market.creatorId,
              type: 'REDEEM',
              title: '💧 LP Seed Returned!',
              message: `"${market.title}" resolved ${winningLabel}. Seeded: ${seedAmt.toLocaleString()} TZS → Got back: ${payoutTzs.toLocaleString()} TZS (${pnlStr})`,
              link: '/profile',
            });
            console.log(`[LP auto-redeem] Creator ${market.creatorId} paid ${payoutTzs} TZS for market ${id}`);
          } catch (e) {
            console.error('[LP auto-redeem] failed (non-fatal):', e);
          }
        })();
      }
    }
  }

  // Notify market creator
  createNotification({
    userId: session.userId,
    type: "MARKET_RESOLVED",
    title: "Market Resolved",
    message: `Your market "${market.title}" has been resolved: ${winningLabel}`,
    link: `/markets/${id}`,
  });

  return NextResponse.json({
    ok: true,
    outcome: winningLabel,
    winnersCount: payoutSummary.length,
    pot,
    totalWinningShares,
    feePercent: Math.round(FEE_PERCENT * 100),
    payouts: payoutSummary,
    creatorFee: {
      amount: creatorFeeAmount,
      paid: creatorFeePaid,
      isAdmin: isAdminCreator,
    },
    noWinners: {
      hasNoWinners,
      isNoneOutcome,
      revenue: noWinnerRevenue,
      transferred: noWinnerTransferred,
    },
  });
}
