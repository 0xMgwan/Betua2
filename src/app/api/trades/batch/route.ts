import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";
import { ntzs } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";

interface BatchTradeItem {
  marketId: string;
  side: string;
  amountTzs: number;
  optionIndex?: number;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { trades } = await req.json() as { trades: BatchTradeItem[] };

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: "No trades provided" }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, balanceTzs: true, ntzsUserId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate total amount needed
    const totalAmount = trades.reduce((sum, trade) => sum + trade.amountTzs, 0);

    // Check balance - use nTZS balance if available, otherwise local balance
    let availableBalance = user.balanceTzs;
    if (user.ntzsUserId) {
      try {
        const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
        availableBalance = balanceTzs;
      } catch (err) {
        console.error("nTZS balance check failed, using local balance:", err);
      }
    }

    if (availableBalance < totalAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. Need ${totalAmount} TZS, have ${availableBalance} TZS` },
        { status: 400 }
      );
    }

    const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;
    const results: Array<{
      marketId: string;
      marketTitle: string;
      side: string;
      shares: number;
      amount: number;
    }> = [];

    // Process each trade in a transaction
    await prisma.$transaction(async (tx) => {
      let totalDeducted = 0;

      for (const trade of trades) {
        // Fetch market
        const market = await tx.market.findUnique({
          where: { id: trade.marketId },
        });

        if (!market) {
          throw new Error(`Market ${trade.marketId} not found`);
        }

        if (market.status !== "OPEN") {
          throw new Error(`Market ${market.title} is not open for trading`);
        }

        const isExpired = new Date(market.resolvesAt) < new Date();
        if (isExpired) {
          throw new Error(`Market ${market.title} has expired`);
        }

        // Calculate shares and fees
        const isMultiOption = !!(market.options && (market.options as string[]).length >= 2);
        const feeAmount = Math.round(trade.amountTzs * FEE_PERCENT);
        const netAmount = trade.amountTzs - feeAmount;

        let sharesOut = 0;
        let newYesPool = market.yesPool;
        let newNoPool = market.noPool;
        let newOptionPools = market.optionPools as number[] | null;

        if (isMultiOption && trade.optionIndex !== undefined) {
          if (!newOptionPools) {
            throw new Error("Invalid market state: missing option pools");
          }
          const result = getMultiOptionSharesOut(netAmount, trade.optionIndex, newOptionPools);
          sharesOut = result.shares;
          newOptionPools = result.newPools;
        } else {
          const result = trade.side === "YES"
            ? getSharesOut(netAmount, market.noPool, market.yesPool)
            : getSharesOut(netAmount, market.yesPool, market.noPool);
          sharesOut = result.shares;
          newYesPool = trade.side === "YES" ? result.newPoolOut : result.newPoolIn;
          newNoPool = trade.side === "NO" ? result.newPoolOut : result.newPoolIn;
        }

        // Update market pools
        const marketUpdateData: any = {
          totalVolume: { increment: trade.amountTzs },
        };
        if (isMultiOption && newOptionPools) {
          marketUpdateData.optionPools = newOptionPools;
        } else {
          marketUpdateData.yesPool = Math.round(newYesPool);
          marketUpdateData.noPool = Math.round(newNoPool);
        }
        await tx.market.update({
          where: { id: trade.marketId },
          data: marketUpdateData,
        });

        // Create trade record
        const tradeSide = isMultiOption && trade.optionIndex !== undefined
          ? (market.options as string[])[trade.optionIndex]
          : trade.side;
        await tx.trade.create({
          data: {
            userId: user.id,
            marketId: trade.marketId,
            side: tradeSide,
            amountTzs: trade.amountTzs,
            shares: Math.round(sharesOut),
            price: trade.amountTzs / sharesOut,
          },
        });

        // Update or create position
        const existingPosition = await tx.position.findFirst({
          where: { userId: user.id, marketId: trade.marketId },
        });

        if (existingPosition) {
          const updateData: any = {};
          if (isMultiOption && trade.optionIndex !== undefined) {
            const optShares = (existingPosition.optionShares as Record<string, number>) || {};
            optShares[String(trade.optionIndex)] = (optShares[String(trade.optionIndex)] || 0) + Math.round(sharesOut);
            updateData.optionShares = optShares;
          } else {
            if (trade.side === "YES") {
              updateData.yesShares = { increment: Math.round(sharesOut) };
            } else {
              updateData.noShares = { increment: Math.round(sharesOut) };
            }
          }

          await tx.position.update({
            where: { id: existingPosition.id },
            data: updateData,
          });
        } else {
          const createData: any = {
            userId: user.id,
            marketId: trade.marketId,
            yesShares: 0,
            noShares: 0,
          };

          if (isMultiOption && trade.optionIndex !== undefined) {
            createData.optionShares = { [String(trade.optionIndex)]: Math.round(sharesOut) };
          } else {
            if (trade.side === "YES") {
              createData.yesShares = Math.round(sharesOut);
            } else {
              createData.noShares = Math.round(sharesOut);
            }
          }

          await tx.position.create({ data: createData });
        }

        totalDeducted += trade.amountTzs;
        results.push({
          marketId: trade.marketId,
          marketTitle: market.title,
          side: trade.side,
          shares: sharesOut,
          amount: trade.amountTzs,
        });
      }

      // Deduct total from user balance
      await tx.user.update({
        where: { id: user.id },
        data: { balanceTzs: { decrement: totalDeducted } },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "TRADE",
          amountTzs: -totalDeducted,
          status: "COMPLETED",
          recipientUsername: `Batch trade: ${trades.length} positions`,
        },
      });
    });

    // Transfer to platform escrow via nTZS
    if (PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs: totalAmount,
        });
      } catch (err) {
        console.error("nTZS transfer failed:", err);
      }
    }

    // Send notification
    createNotification({
      userId: user.id,
      type: "TRADE",
      title: "Trades Successful!",
      message: `Bought ${trades.length} positions for ${totalAmount.toLocaleString()} TZS total`,
      link: "/portfolio",
    });

    return NextResponse.json({
      success: true,
      trades: results,
      totalAmount,
      totalTrades: trades.length,
    });
  } catch (err: any) {
    console.error("Batch trade error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process batch trades" },
      { status: 500 }
    );
  }
}
