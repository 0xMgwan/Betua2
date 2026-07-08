import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPayoutForShares, getMultiOptionPayoutForShares } from "@/lib/amm";
import { createNotification } from "@/lib/notify";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";

// Early-exit fee on sells (default 50%): sellers receive half the AMM value;
// the haircut stays in the settlement pool. Override via SELL_FEE_PERCENT env.
const SELL_FEE_PERCENT = parseFloat(process.env.SELL_FEE_PERCENT || "50") / 100;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { marketId, side, sharesToSell, optionIndex } = await req.json();

    if (!marketId || !sharesToSell || sharesToSell < 1) {
      return NextResponse.json({ error: "Invalid sell request" }, { status: 400 });
    }

    const [market, user, position] = await Promise.all([
      prisma.market.findUnique({ where: { id: marketId } }),
      prisma.user.findUnique({ where: { id: session.userId } }),
      prisma.position.findUnique({
        where: { userId_marketId: { userId: session.userId, marketId } },
      }),
    ]);

    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
    if (market.status !== "OPEN") return NextResponse.json({ error: "Market is not open" }, { status: 400 });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!position) return NextResponse.json({ error: "You have no position in this market" }, { status: 400 });

    // Determine user's preferred currency for payout
    // USDC rate: 1 USDC = 2630 TZS, stored as micro-USDC (1 USDC = 1,000,000 micro-USDC)
    const USDC_TO_TZS_RATE = 2630;
    const preferredCurrency = (user.preferredCurrency as Currency) || getUserCurrency(user.country);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mkt = market as any;
    const isMultiOption = Array.isArray(mkt.options) && mkt.options.length >= 2;

    // Validate user has enough shares to sell
    let availableShares: number;
    let tradeSide: string;

    if (isMultiOption) {
      if (optionIndex === undefined || optionIndex < 0 || optionIndex >= mkt.options.length) {
        return NextResponse.json({ error: "Invalid option selected" }, { status: 400 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optionShares = (position as any).optionShares as Record<string, number> || {};
      availableShares = optionShares[String(optionIndex)] || 0;
      tradeSide = (mkt.options as string[])[optionIndex];
    } else {
      if (!side || (side !== "YES" && side !== "NO")) {
        return NextResponse.json({ error: "Invalid side" }, { status: 400 });
      }
      availableShares = side === "YES" ? position.yesShares : position.noShares;
      tradeSide = side;
    }

    if (sharesToSell > availableShares) {
      return NextResponse.json({
        error: `You only have ${availableShares} ${tradeSide} shares`,
      }, { status: 400 });
    }

    // Calculate payout via AMM
    let grossPayout: number;
    let avgPrice: number;
    let newPoolData: Record<string, number | number[]>;

    if (isMultiOption) {
      const pools = mkt.optionPools as number[];
      const result = getMultiOptionPayoutForShares(sharesToSell, optionIndex, pools);
      grossPayout = result.payout;
      avgPrice = result.avgPrice;
      newPoolData = { optionPools: result.newPools };
    } else {
      // For selling YES shares: poolIn = yesPool (shares go back), poolOut = noPool (TZS come out)
      // For selling NO shares: poolIn = noPool, poolOut = yesPool
      const result = side === "YES"
        ? getPayoutForShares(sharesToSell, market.yesPool, market.noPool)
        : getPayoutForShares(sharesToSell, market.noPool, market.yesPool);
      grossPayout = Math.round(result.payout);
      avgPrice = result.avgPrice;

      if (side === "YES") {
        newPoolData = { yesPool: result.newPoolIn, noPool: result.newPoolOut };
      } else {
        newPoolData = { noPool: result.newPoolIn, yesPool: result.newPoolOut };
      }
    }

    if (grossPayout <= 0) {
      return NextResponse.json({ error: "Shares have no value at current price" }, { status: 400 });
    }

    // Early-exit (sell) fee — users receive SELL_FEE-complement of the AMM value;
    // the haircut stays in the settlement pool backing user balances. Deliberately
    // steep to discourage buy→sell flips that extract value from thin markets
    // (stale-odds sniping); holding to resolution pays the normal 5% fee instead.
    const feeAmount = Math.round(grossPayout * SELL_FEE_PERCENT);
    const netPayout = grossPayout - feeAmount;

    // Pooled custodial model: sell proceeds are credited to the user's DB balance
    // only (in the atomic transaction below). Funds stay in the platform wallet and
    // leave it exclusively on withdrawal to mobile money. We deliberately do NOT
    // push nTZS to personal wallets here — that double-paid legacy users who still
    // had a personal nTZS wallet (once as real nTZS, once as DB balance).
    // The sell haircut also stays in the pool (no on-chain fee transfer) so it
    // strengthens solvency rather than draining the pool.
    const ntzsTransferId: string | undefined = undefined;

    // Build position update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let positionUpdate: any;
    if (isMultiOption) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingShares = (position as any).optionShares as Record<string, number> || {};
      const updatedShares = { ...existingShares };
      updatedShares[String(optionIndex)] = Math.max(0, (updatedShares[String(optionIndex)] || 0) - sharesToSell);
      positionUpdate = { optionShares: updatedShares };
    } else {
      positionUpdate = side === "YES"
        ? { yesShares: { decrement: sharesToSell } }
        : { noShares: { decrement: sharesToSell } };
    }

    // Calculate payout in user's preferred currency
    // USDC is now stored as float (e.g., 1.50), not micro-USDC
    const payoutUsdc = preferredCurrency === 'USDC' 
      ? netPayout / USDC_TO_TZS_RATE
      : 0;
    const payoutKes = preferredCurrency === 'KES' 
      ? convertCurrency(netPayout, 'TZS', 'KES') 
      : 0;

    // Atomic DB transaction: update pools, position, record trade, credit user
    const [updatedMarket, , trade] = await prisma.$transaction([
      prisma.market.update({
        where: { id: marketId },
        data: {
          ...newPoolData,
          totalVolume: { decrement: netPayout }, // Volume decreases when shares are sold back
        },
      }),
      prisma.position.update({
        where: { userId_marketId: { userId: session.userId, marketId } },
        data: positionUpdate,
      }),
      prisma.trade.create({
        data: {
          userId: session.userId,
          marketId,
          side: `SELL_${tradeSide}`,
          amountTzs: -netPayout, // Negative amount = sell
          shares: -sharesToSell, // Negative shares = sold
          price: avgPrice,
          ntzsTransferId,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "SELL_SHARES",
          amountTzs: preferredCurrency === 'TZS' ? netPayout : 0,
          amountKes: payoutKes,
          amountUsdc: payoutUsdc,
          currency: preferredCurrency,
          status: "COMPLETED",
          recipientUsername: `${market.title} (${tradeSide})`,
        },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: preferredCurrency === 'USDC'
          ? { balanceUsdc: { increment: payoutUsdc } }
          : preferredCurrency === 'KES'
            ? { balanceKes: { increment: payoutKes } }
            : { balanceTzs: { increment: netPayout } },
      }),
    ]);

    // Calculate payout in user's currency for response/notification
    // payoutUsdc is now a float (e.g., 1.50), not micro-USDC
    const payoutInUserCurrency = preferredCurrency === 'USDC' 
      ? payoutUsdc
      : preferredCurrency === 'KES' 
        ? payoutKes 
        : netPayout;
    const payoutDisplay = preferredCurrency === 'USDC'
      ? `$${payoutUsdc.toFixed(2)}`
      : `${payoutInUserCurrency.toLocaleString()} ${preferredCurrency}`;

    // Notification
    createNotification({
      userId: session.userId,
      type: "TRADE",
      title: "Shares Sold",
      message: `Sold ${sharesToSell} ${tradeSide} shares in "${market.title}" for ${payoutDisplay}`,
      link: `/markets/${marketId}`,
    });

    return NextResponse.json({
      trade,
      sharesToSell,
      grossPayout,
      fee: feeAmount,
      netPayout,
      price: avgPrice,
      market: updatedMarket,
    });
  } catch (err) {
    console.error("Sell error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Sell failed. Please try again.", debug: msg }, { status: 500 });
  }
}
