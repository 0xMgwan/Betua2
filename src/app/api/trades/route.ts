import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { bkes } from "@/lib/bkes";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";
import { notifications } from "@/lib/notifications";
import { createNotification } from "@/lib/notify";
import { notifyTradePlaced } from "@/lib/push";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { marketId, side, optionIndex } = body;
    
    // Accept amountTzs, amountKes, or amountUsdc based on user's currency preference
    let amountTzs = body.amountTzs;
    let amountKes = body.amountKes;
    let amountUsdc = body.amountUsdc; // in micro-USDC (6 decimals)
    let userCurrency: Currency = 'TZS';

    if (!marketId) {
      return NextResponse.json({ error: "Market ID required" }, { status: 400 });
    }

    const [market, userResult] = await Promise.all([
      prisma.market.findUnique({ where: { id: marketId } }),
      prisma.user.findUnique({ where: { id: session.userId } }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = userResult as any;

    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
    if (market.status !== "OPEN") return NextResponse.json({ error: "Market is not open" }, { status: 400 });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Determine payment currency and convert to TZS for AMM calculations
    // USDC rate: 1 USDC = 2630 TZS
    // Note: amountUsdc from frontend is in USDC (float, e.g., 1.50)
    // balanceUsdc from nTZS API is also a float (e.g., 1.50)
    const USDC_TO_TZS_RATE = 2630;
    
    if (amountUsdc && amountUsdc > 0) {
      // USDC payment - convert to TZS for AMM
      userCurrency = 'USDC' as Currency;
      amountTzs = Math.round(amountUsdc * USDC_TO_TZS_RATE);
      if (amountUsdc < 0.5) { // Minimum 0.5 USDC
        return NextResponse.json({ error: "Minimum trade is $0.50 USDC" }, { status: 400 });
      }
    } else if (amountKes && amountKes > 0) {
      // Kenya user paying in KES - convert to TZS for AMM
      userCurrency = 'KES';
      amountTzs = convertCurrency(amountKes, 'KES', 'TZS');
    } else if (!amountTzs || amountTzs < 100) {
      return NextResponse.json({ error: "Minimum trade is 100 TZS" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mkt = market as any;
    const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;

    // Validate side/optionIndex
    if (isMultiOption) {
      if (optionIndex === undefined || optionIndex < 0 || optionIndex >= mkt.options.length) {
        return NextResponse.json({ error: "Invalid option selected" }, { status: 400 });
      }
    } else if (!side || (side !== "YES" && side !== "NO")) {
      return NextResponse.json({ error: "Invalid side" }, { status: 400 });
    }

    // Enforce wallet balance based on user's currency
    if (userCurrency === 'USDC') {
      // USDC payment - fetch live USDC balance from nTZS API (not stored in DB)
      let userBalanceUsdc = 0;
      if (user.ntzsUserId) {
        try {
          const bal = await ntzs.users.getBalance(user.ntzsUserId);
          userBalanceUsdc = bal.balanceUsdc || 0;
        } catch (err) {
          console.error("[Trade] Failed to fetch USDC balance:", err);
        }
      }
      if (userBalanceUsdc < amountUsdc) {
        return NextResponse.json({
          error: `Insufficient USDC balance. You have $${userBalanceUsdc.toFixed(2)} — deposit more to trade.`,
        }, { status: 400 });
      }
    } else if (userCurrency === 'KES') {
      // Kenya user - check KES balance
      const userBalanceKes = user.balanceKes || 0;
      const requiredKes = amountKes || convertCurrency(amountTzs, 'TZS', 'KES');
      if (userBalanceKes < requiredKes) {
        return NextResponse.json({
          error: `Insufficient balance. You have ${(userBalanceKes / 100).toLocaleString()} KES — deposit more to trade.`,
        }, { status: 400 });
      }
    } else if (user.ntzsUserId) {
      // Tanzania user with nTZS wallet
      try {
        const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
        if (balanceTzs < amountTzs) {
          return NextResponse.json({
            error: `Insufficient balance. You have ${balanceTzs.toLocaleString()} TZS — deposit more to trade.`,
          }, { status: 400 });
        }
      } catch (balErr) {
        console.error("nTZS balance check failed, using local balance:", balErr);
        if ((user.balanceTzs || 0) < amountTzs) {
          return NextResponse.json({ error: `Insufficient balance.` }, { status: 400 });
        }
      }
    } else {
      // No nTZS wallet — check local TZS balance
      if ((user.balanceTzs || 0) < amountTzs) {
        return NextResponse.json({ error: "Insufficient balance. Deposit funds first." }, { status: 400 });
      }
    }

    // ── 5% platform fee ───────────────────────────────────────────────────
    const feeAmount = Math.round(amountTzs * FEE_PERCENT);
    const tradeAmount = amountTzs - feeAmount; // Amount used in AMM
    // ─────────────────────────────────────────────────────────────────────

    // Calculate shares via AMM using net trade amount (after fee)
    let shares: number;
    let avgPrice: number;
    let newPoolIn: number | undefined;
    let newPoolOut: number | undefined;
    let newPools: number[] | undefined;
    const tradeSide = isMultiOption ? (mkt.options as string[])[optionIndex] : side;

    if (isMultiOption) {
      const pools = mkt.optionPools as number[];
      if (!pools || !Array.isArray(pools)) {
        return NextResponse.json({ error: "Invalid market state: missing option pools" }, { status: 500 });
      }
      const result = getMultiOptionSharesOut(tradeAmount, optionIndex, pools);
      shares = result.shares;
      avgPrice = result.avgPrice;
      newPools = result.newPools;
    } else {
      const result =
        side === "YES"
          ? getSharesOut(tradeAmount, market.noPool, market.yesPool)
          : getSharesOut(tradeAmount, market.yesPool, market.noPool);
      shares = result.shares;
      avgPrice = result.avgPrice;
      newPoolIn = Math.round(result.newPoolIn);
      newPoolOut = Math.round(result.newPoolOut);
    }

    let ntzsTransferId: string | undefined;
    let bkesTransferTxHash: string | undefined;

    // Transfer tokens from user → platform escrow
    if (userCurrency === 'USDC' && user.ntzsUserId) {
      // USDC payment flow:
      // 1. Swap USDC → nTZS via nTZS swap API
      // 2. Transfer nTZS to platform escrow
      try {
        console.log(`[Trade] USDC payment: swapping $${amountUsdc} USDC → ${amountTzs} TZS for user ${user.ntzsUserId}`);
        
        // Step 1: Swap USDC to nTZS
        const swapResult = await ntzs.swap.executeAndWait({
          userId: user.ntzsUserId,
          fromToken: 'USDC',
          toToken: 'NTZS',
          amount: amountUsdc,
          slippageBps: 100, // 1% slippage
        });
        console.log(`[Trade] Swap completed: ${swapResult.txHash}`);

        // Step 2: Get actual nTZS balance after swap (may differ due to slippage)
        const { balanceTzs: actualBalance } = await ntzs.users.getBalance(user.ntzsUserId);
        const transferAmount = Math.min(actualBalance, amountTzs); // Transfer what we have, up to expected
        console.log(`[Trade] Post-swap balance: ${actualBalance} TZS, transferring: ${transferAmount} TZS`);

        // Step 3: Transfer nTZS to platform escrow
        if (PLATFORM_NTZS_USER_ID && transferAmount > 0) {
          const transfer = await ntzs.transfers.create({
            fromUserId: user.ntzsUserId,
            toUserId: PLATFORM_NTZS_USER_ID,
            amountTzs: transferAmount,
          });
          ntzsTransferId = transfer.id;
          console.log(`[Trade] nTZS transfer to escrow: ${ntzsTransferId}`);
          // Update amountTzs to actual transferred amount for share calculation
          amountTzs = transferAmount;
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error("[Trade] USDC swap/transfer failed:", detail);
        return NextResponse.json({
          error: `USDC payment failed: ${detail}`,
        }, { status: 500 });
      }
    } else if (userCurrency === 'KES' && user.ntzsUserId) {
      // Kenya user: bKES payment flow (same as USDC)
      // 1. Swap bKES → nTZS via nTZS swap API
      // 2. Transfer nTZS to platform escrow
      const kesAmount = amountKes || convertCurrency(amountTzs, 'TZS', 'KES');
      try {
        console.log(`[Trade] bKES payment: swapping ${kesAmount} bKES → ${amountTzs} TZS for user ${user.ntzsUserId}`);
        
        // Step 1: Swap bKES to nTZS
        const swapResult = await ntzs.swap.executeAndWait({
          userId: user.ntzsUserId,
          fromToken: 'BKES',
          toToken: 'NTZS',
          amount: kesAmount,
          slippageBps: 100, // 1% slippage
        });
        console.log(`[Trade] bKES→nTZS swap completed: ${swapResult.txHash}`);

        // Step 2: Get actual nTZS balance after swap (may differ due to slippage)
        const { balanceTzs: actualBalanceKes } = await ntzs.users.getBalance(user.ntzsUserId);
        const transferAmountKes = Math.min(actualBalanceKes, amountTzs);
        console.log(`[Trade] Post-swap balance: ${actualBalanceKes} TZS, transferring: ${transferAmountKes} TZS`);

        // Step 3: Transfer nTZS to platform escrow
        if (PLATFORM_NTZS_USER_ID && transferAmountKes > 0) {
          const transfer = await ntzs.transfers.create({
            fromUserId: user.ntzsUserId,
            toUserId: PLATFORM_NTZS_USER_ID,
            amountTzs: transferAmountKes,
          });
          ntzsTransferId = transfer.id;
          console.log(`[Trade] nTZS transfer to escrow: ${ntzsTransferId}`);
          // Update amountTzs to actual transferred amount for share calculation
          amountTzs = transferAmountKes;
        }
      } catch (err) {
        console.error("[Trade] bKES swap/transfer failed:", err);
        return NextResponse.json({
          error: "bKES payment failed. Please try again.",
        }, { status: 500 });
      }
    } else if (userCurrency === 'TZS' && PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      // Tanzania user: Transfer nTZS tokens via nTZS API
      try {
        const transfer = await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs,
        });
        ntzsTransferId = transfer.id;
      } catch (err) {
        console.error("nTZS transfer failed:", err);
        // Continue without nTZS transfer - use local balance instead
      }
    }

    // Transfer 5% fee from platform escrow → settlement fee wallet (non-blocking)
    // Fees are always in nTZS (USDC is swapped to nTZS before escrow)
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && feeAmount > 0) {
      ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
        amountTzs: feeAmount,
      }).catch((feeErr) => {
        console.error("Fee transfer failed (non-fatal):", feeErr);
      });
    }

    // Build market update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marketUpdateData: any = { totalVolume: { increment: amountTzs } };
    if (isMultiOption && newPools) {
      marketUpdateData.optionPools = newPools;
    } else {
      marketUpdateData.yesPool = side === "YES" ? newPoolOut : newPoolIn;
      marketUpdateData.noPool = side === "NO" ? newPoolOut : newPoolIn;
    }

    // Build position upsert data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let positionCreate: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let positionUpdate: any;

    if (isMultiOption) {
      // For multi-option, store shares in optionShares JSON: { "0": 50, "1": 30 }
      const existingPosition = await prisma.position.findUnique({
        where: { userId_marketId: { userId: session.userId, marketId } },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingShares = (existingPosition as any)?.optionShares as Record<string, number> || {};
      const updatedShares = { ...existingShares };
      updatedShares[String(optionIndex)] = (updatedShares[String(optionIndex)] || 0) + Math.round(shares);

      positionCreate = {
        userId: session.userId,
        marketId,
        optionShares: updatedShares,
      };
      positionUpdate = {
        optionShares: updatedShares,
      };
    } else {
      positionCreate = {
        userId: session.userId,
        marketId,
        yesShares: side === "YES" ? Math.round(shares) : 0,
        noShares: side === "NO" ? Math.round(shares) : 0,
      };
      positionUpdate = {
        yesShares: side === "YES" ? { increment: Math.round(shares) } : undefined,
        noShares: side === "NO" ? { increment: Math.round(shares) } : undefined,
      };
    }

    // Update market pools + position + record trade + transaction + deduct balance atomically
    let updatedMarket, trade;
    try {
      [updatedMarket, , trade] = await prisma.$transaction([
        prisma.market.update({
          where: { id: marketId },
          data: marketUpdateData,
        }),
        prisma.position.upsert({
          where: { userId_marketId: { userId: session.userId, marketId } },
          create: positionCreate,
          update: positionUpdate,
        }),
        prisma.trade.create({
          data: {
            userId: session.userId,
            marketId,
            side: tradeSide,
            amountTzs,
            shares: Math.round(shares),
            price: avgPrice,
            ntzsTransferId,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: session.userId,
            type: "BUY_SHARES",
            amountTzs: userCurrency === 'TZS' ? amountTzs : 0,
            amountKes: userCurrency === 'KES' ? (amountKes || convertCurrency(amountTzs, 'TZS', 'KES')) : 0,
            // amountUsdc is stored as micro-USDC (integer), so multiply by 1,000,000
            amountUsdc: userCurrency === 'USDC' ? Math.round(amountUsdc * 1_000_000) : 0,
            currency: userCurrency,
            status: "COMPLETED",
            recipientUsername: `${market.title} (${tradeSide})`,
          },
        }),
        prisma.user.update({
          where: { id: session.userId },
          data: userCurrency === 'USDC'
            ? { balanceUsdc: { decrement: amountUsdc }, preferredCurrency: 'USDC' }
            : userCurrency === 'KES'
              ? { balanceKes: { decrement: amountKes || convertCurrency(amountTzs, 'TZS', 'KES') }, preferredCurrency: 'KES' }
              : { balanceTzs: { decrement: amountTzs }, preferredCurrency: 'TZS' },
        }),
      ]);
    } catch (dbErr) {
      console.error("Database transaction failed, refunding user:", dbErr);
      if (PLATFORM_NTZS_USER_ID && ntzsTransferId && user.ntzsUserId) {
        try {
          await ntzs.transfers.create({
            fromUserId: PLATFORM_NTZS_USER_ID,
            toUserId: user.ntzsUserId,
            amountTzs,
          });
          console.log(`Refunded ${amountTzs} TZS to user ${user.ntzsUserId}`);
        } catch (refundErr) {
          console.error("CRITICAL: Refund failed after DB error:", refundErr);
        }
      }
      throw dbErr;
    }

    // Notification: trade completed
    const userLocale = user.locale || 'en';
    const notifTitle = userLocale === 'sw' ? 'Biashara Imefanikiwa' : 'Trade Successful';
    // Format amount based on currency
    const amountDisplay = userCurrency === 'USDC' 
      ? `$${amountUsdc.toFixed(2)}` 
      : userCurrency === 'KES'
        ? `${(amountKes || convertCurrency(amountTzs, 'TZS', 'KES')).toLocaleString()} KES`
        : `${amountTzs.toLocaleString()} TZS`;
    const notifMessage = userLocale === 'sw'
      ? `Umenunua hisa za ${tradeSide} katika "${market.title}" kwa ${amountDisplay}`
      : `Bought ${tradeSide} shares in "${market.title}" for ${amountDisplay}`;
    
    createNotification({
      userId: session.userId,
      type: "TRADE",
      title: notifTitle,
      message: notifMessage,
      link: `/markets/${marketId}`,
    });

    // Push notification (off-app)
    notifyTradePlaced(session.userId, market.title, tradeSide, amountTzs, marketId, userLocale).catch(console.error);

    return NextResponse.json({
      trade,
      shares: Math.round(shares),
      price: avgPrice,
      market: updatedMarket,
      fee: feeAmount,
      feePercent: Math.round(FEE_PERCENT * 100),
    });
  } catch (err) {
    console.error("Trade error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Trade error stack:", stack);
    return NextResponse.json({ error: msg || "Trade failed. Please try again." }, { status: 500 });
  }
}
