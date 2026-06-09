import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { bkes } from "@/lib/bkes";
import { getSharesOut, getMultiOptionSharesOut, getPrice, getMultiOptionPrices } from "@/lib/amm";
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

    // ── Balance check against DB balance (all currencies) ────────────────
    // All user funds are held in the settlement pool; DB tracks individual balances.
    // No per-trade on-chain transfer from user — that happens only at deposit/redeem.
    if (userCurrency === 'USDC') {
      if ((user.balanceUsdc || 0) < amountUsdc) {
        return NextResponse.json({
          error: `Insufficient USDC balance. You have $${(user.balanceUsdc || 0).toFixed(2)} — deposit more to trade.`,
        }, { status: 400 });
      }
    } else if (userCurrency === 'KES') {
      const userBalanceKes = user.balanceKes || 0;
      const requiredKes = amountKes || convertCurrency(amountTzs, 'TZS', 'KES');
      if (userBalanceKes < requiredKes) {
        return NextResponse.json({
          error: `Insufficient balance. You have ${(userBalanceKes / 100).toLocaleString()} KES — deposit more to trade.`,
        }, { status: 400 });
      }
    } else {
      // TZS (default) — if insufficient balance, trigger STK push for the exact trade amount
      if ((user.balanceTzs || 0) < amountTzs) {
        if (!user.phone) {
          return NextResponse.json({ error: "Insufficient balance. Add a phone number to enable mobile payments." }, { status: 400 });
        }
        if (!PLATFORM_NTZS_USER_ID) {
          return NextResponse.json({ error: "Insufficient balance. Please deposit funds first." }, { status: 400 });
        }
        try {
          // Trigger STK push — nTZS minted directly to settlement pool
          const deposit = await ntzs.deposits.create({
            userId: PLATFORM_NTZS_USER_ID,
            amountTzs,
            phone: user.phone,
          });
          // Record as pending deposit tied to this trade
          await prisma.transaction.create({
            data: {
              userId: session.userId,
              type: "DEPOSIT",
              amountTzs,
              status: "PENDING",
              ntzsDepositId: deposit.id,
              phone: user.phone,
            },
          });
          // Credit DB balance immediately so the trade can proceed below
          await prisma.user.update({
            where: { id: session.userId },
            data: { balanceTzs: { increment: amountTzs } },
          });
          // Refresh local user balance
          user.balanceTzs = (user.balanceTzs || 0) + amountTzs;
          console.log(`[Trade] STK push initiated for ${amountTzs} TZS — user ${session.userId}, phone ${user.phone}`);
        } catch (stkErr) {
          console.error("[Trade] STK push failed:", stkErr);
          return NextResponse.json({ error: "Payment failed. Please deposit funds first or try again." }, { status: 400 });
        }
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

    // oddsPrice = implied probability (0–1) BEFORE the trade (entry price the user sees)
    let oddsPrice: number;

    if (isMultiOption) {
      const pools = mkt.optionPools as number[];
      if (!pools || !Array.isArray(pools)) {
        return NextResponse.json({ error: "Invalid market state: missing option pools" }, { status: 500 });
      }
      oddsPrice = getMultiOptionPrices(pools)[optionIndex] ?? 0.5;
      const result = getMultiOptionSharesOut(tradeAmount, optionIndex, pools);
      shares = result.shares;
      avgPrice = result.avgPrice;
      newPools = result.newPools;
    } else {
      const prices = getPrice(market.yesPool, market.noPool);
      oddsPrice = side === "YES" ? prices.yes : prices.no;
      const result =
        side === "YES"
          ? getSharesOut(tradeAmount, market.noPool, market.yesPool)
          : getSharesOut(tradeAmount, market.yesPool, market.noPool);
      shares = result.shares;
      avgPrice = result.avgPrice;
      newPoolIn = Math.round(result.newPoolIn);
      newPoolOut = Math.round(result.newPoolOut);
    }

    // Fixed-odds implied payout: what user should receive if they win.
    // Calculated now (before any transfers) so it can be stored in the position.
    // tradeAmount = net after entry fee; oddsPrice = pre-trade probability (0–1)
    // The (1 - FEE_PERCENT) factor accounts for the redemption settlement fee.
    const payoutIfWin = oddsPrice > 0
      ? Math.round((tradeAmount / oddsPrice) * (1 - FEE_PERCENT))
      : 0;

    // ── No per-trade on-chain transfer ────────────────────────────────────
    // All user funds are held in the settlement pool wallet. Trades are
    // pure DB operations. On-chain movement only happens at deposit (user→pool)
    // and redeem (pool→user). The 5% entry fee is forwarded pool→fee wallet.
    const ntzsTransferId: string | undefined = undefined;

    // Forward 5% entry fee from settlement pool → fee wallet (non-blocking)
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

      // Accumulate implied payout per option index
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingImplied = (existingPosition as any)?.optionImpliedPayouts as Record<string, number> || {};
      const updatedImplied = { ...existingImplied };
      updatedImplied[String(optionIndex)] = (updatedImplied[String(optionIndex)] || 0) + payoutIfWin;

      positionCreate = {
        userId: session.userId,
        marketId,
        optionShares: updatedShares,
        optionImpliedPayouts: updatedImplied,
      };
      positionUpdate = {
        optionShares: updatedShares,
        optionImpliedPayouts: updatedImplied,
      };
    } else {
      positionCreate = {
        userId: session.userId,
        marketId,
        yesShares: side === "YES" ? Math.round(shares) : 0,
        noShares: side === "NO" ? Math.round(shares) : 0,
        yesImpliedPayout: side === "YES" ? payoutIfWin : 0,
        noImpliedPayout: side === "NO" ? payoutIfWin : 0,
      };
      positionUpdate = {
        yesShares: side === "YES" ? { increment: Math.round(shares) } : undefined,
        noShares: side === "NO" ? { increment: Math.round(shares) } : undefined,
        // Accumulate implied payout: each new trade adds its expected payout
        yesImpliedPayout: side === "YES" ? { increment: payoutIfWin } : undefined,
        noImpliedPayout: side === "NO" ? { increment: payoutIfWin } : undefined,
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
      console.error("Database transaction failed:", dbErr);
      // No on-chain transfer to reverse — funds stay in settlement pool.
      // Balance was decremented as part of the same atomic DB transaction,
      // so if it failed the decrement also rolled back automatically.
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
      price: avgPrice,      // TZS/share (for display in trade panel)
      oddsPrice,            // probability 0–1 (for modal odds % and payoutIfWin)
      payoutIfWin,
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
