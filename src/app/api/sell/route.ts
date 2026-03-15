import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { getPayoutForShares, getMultiOptionPayoutForShares } from "@/lib/amm";
import { createNotification } from "@/lib/notify";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

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
      prisma.user.findUnique({ 
        where: { id: session.userId },
        select: { id: true, ntzsUserId: true, balanceTzs: true }
      }),
      prisma.position.findUnique({
        where: { userId_marketId: { userId: session.userId, marketId } },
      }),
    ]);

    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
    if (market.status !== "OPEN") return NextResponse.json({ error: "Market is not open" }, { status: 400 });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!position) return NextResponse.json({ error: "You have no position in this market" }, { status: 400 });

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

    // Apply 5% sell fee
    const feeAmount = Math.round(grossPayout * FEE_PERCENT);
    const netPayout = grossPayout - feeAmount;

    // Transfer payout: platform escrow → user via NTZS
    let ntzsTransferId: string | undefined;
    if (PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      try {
        const transfer = await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: user.ntzsUserId,
          amountTzs: netPayout,
        });
        ntzsTransferId = transfer.id;
      } catch (err) {
        if (err instanceof NtzsApiError) {
          return NextResponse.json({ error: err.message || "Payout transfer failed" }, { status: 400 });
        }
        throw err;
      }
    }

    // Transfer fee: platform escrow → settlement fee wallet (non-blocking)
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && feeAmount > 0) {
      ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
        amountTzs: feeAmount,
      }).catch((feeErr) => {
        console.error("Sell fee transfer failed (non-fatal):", feeErr);
      });
    }

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
          amountTzs: netPayout,
          status: "COMPLETED",
          recipientUsername: `${market.title} (${tradeSide})`,
        },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceTzs: { increment: netPayout } },
      }),
    ]);

    // Notification
    createNotification({
      userId: session.userId,
      type: "TRADE",
      title: "Shares Sold",
      message: `Sold ${sharesToSell} ${tradeSide} shares in "${market.title}" for ${netPayout.toLocaleString()} TZS`,
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
