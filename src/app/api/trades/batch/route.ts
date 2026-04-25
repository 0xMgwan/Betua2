import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const USDC_TO_TZS_RATE = 2630;

interface BatchTradeItem {
  marketId: string;
  side: string;
  amountTzs?: number;
  amountKes?: number;
  amountUsdc?: number;
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

    // Get user with all currency fields
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        balanceTzs: true,
        balanceKes: true,
        balanceUsdc: true,
        ntzsUserId: true,
        preferredCurrency: true,
        country: true,
        phone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine user currency: preferredCurrency takes priority, then country/phone
    const userCurrency: Currency =
      (user.preferredCurrency as Currency) ||
      getUserCurrency(user.country, user.phone);

    // Normalize all trade amounts to TZS for AMM processing
    // and compute per-trade TZS amounts
    const normalizedTrades = trades.map((trade) => {
      let amountTzs: number;
      if (trade.amountUsdc) {
        amountTzs = Math.round(trade.amountUsdc * USDC_TO_TZS_RATE);
      } else if (trade.amountKes) {
        amountTzs = Math.round(convertCurrency(trade.amountKes, "KES", "TZS"));
      } else {
        amountTzs = trade.amountTzs || 0;
      }
      return { ...trade, amountTzs };
    });

    const totalAmountTzs = normalizedTrades.reduce((s, t) => s + t.amountTzs, 0);
    const totalAmountUsdc = totalAmountTzs / USDC_TO_TZS_RATE;
    const totalAmountKes = convertCurrency(totalAmountTzs, "TZS", "KES");

    // ── Balance check ─────────────────────────────────────────────────────
    if (userCurrency === "USDC") {
      if (!user.ntzsUserId) {
        return NextResponse.json(
          { error: "Wallet not provisioned. Please deposit first." },
          { status: 400 }
        );
      }
      try {
        const balances = await ntzs.users.getBalance(user.ntzsUserId);
        const availableUsdc = balances.balanceUsdc || 0;
        if (availableUsdc < totalAmountUsdc) {
          return NextResponse.json(
            {
              error: `Insufficient USDC balance. Need $${totalAmountUsdc.toFixed(2)}, have $${availableUsdc.toFixed(2)}`,
            },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error("[BatchTrade] USDC balance check failed:", err);
        return NextResponse.json(
          { error: "Could not verify USDC balance. Please try again." },
          { status: 503 }
        );
      }
    } else if (userCurrency === "KES") {
      const availableKes = user.balanceKes || 0;
      if (availableKes < totalAmountKes) {
        return NextResponse.json(
          {
            error: `Insufficient KES balance. Need ${Math.round(totalAmountKes).toLocaleString()} KES, have ${availableKes.toLocaleString()} KES`,
          },
          { status: 400 }
        );
      }
    } else {
      // TZS — check nTZS API balance if available, else local
      let availableTzs = user.balanceTzs;
      if (user.ntzsUserId) {
        try {
          const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
          availableTzs = balanceTzs;
        } catch (err) {
          console.error("[BatchTrade] nTZS balance check failed, using local:", err);
        }
      }
      if (availableTzs < totalAmountTzs) {
        return NextResponse.json(
          {
            error: `Insufficient balance. Need ${totalAmountTzs.toLocaleString()} TZS, have ${availableTzs.toLocaleString()} TZS`,
          },
          { status: 400 }
        );
      }
    }

    // ── USDC: swap USDC → nTZS before escrow transfer ─────────────────────
    if (userCurrency === "USDC" && PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      try {
        console.log(`[BatchTrade] Swapping $${totalAmountUsdc.toFixed(4)} USDC → ${totalAmountTzs} TZS for user ${user.ntzsUserId}`);
        const swapResult = await ntzs.swap.executeAndWait({
          userId: user.ntzsUserId,
          fromToken: "USDC",
          toToken: "NTZS",
          amount: totalAmountUsdc,
          slippageBps: 100,
        });
        console.log(`[BatchTrade] USDC swap completed: ${swapResult.txHash}`);
      } catch (err) {
        console.error("[BatchTrade] USDC swap failed:", err);
        const msg = err instanceof NtzsApiError ? err.message : "USDC payment failed. Please try again.";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;
    const results: Array<{
      marketId: string;
      marketTitle: string;
      side: string;
      shares: number;
      amount: number;
    }> = [];

    // ── Process each trade in a DB transaction ────────────────────────────
    await prisma.$transaction(async (tx) => {
      for (const trade of normalizedTrades) {
        const market = await tx.market.findUnique({ where: { id: trade.marketId } });

        if (!market) throw new Error(`Market ${trade.marketId} not found`);
        if (market.status !== "OPEN") throw new Error(`Market ${market.title} is not open for trading`);
        if (new Date(market.resolvesAt) < new Date()) throw new Error(`Market ${market.title} has expired`);

        const isMultiOption = !!(market.options && (market.options as string[]).length >= 2);
        const feeAmount = Math.round(trade.amountTzs * FEE_PERCENT);
        const netAmount = trade.amountTzs - feeAmount;

        let sharesOut = 0;
        let newYesPool = market.yesPool;
        let newNoPool = market.noPool;
        let newOptionPools = market.optionPools as number[] | null;

        if (isMultiOption && trade.optionIndex !== undefined) {
          if (!newOptionPools) throw new Error("Invalid market state: missing option pools");
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
        const marketUpdateData: Record<string, unknown> = {
          totalVolume: { increment: trade.amountTzs },
        };
        if (isMultiOption && newOptionPools) {
          marketUpdateData.optionPools = newOptionPools;
        } else {
          marketUpdateData.yesPool = Math.round(newYesPool);
          marketUpdateData.noPool = Math.round(newNoPool);
        }
        await tx.market.update({ where: { id: trade.marketId }, data: marketUpdateData });

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
          const updateData: Record<string, unknown> = {};
          if (isMultiOption && trade.optionIndex !== undefined) {
            const optShares = (existingPosition.optionShares as Record<string, number>) || {};
            optShares[String(trade.optionIndex)] = (optShares[String(trade.optionIndex)] || 0) + Math.round(sharesOut);
            updateData.optionShares = optShares;
          } else {
            if (trade.side === "YES") updateData.yesShares = { increment: Math.round(sharesOut) };
            else updateData.noShares = { increment: Math.round(sharesOut) };
          }
          await tx.position.update({ where: { id: existingPosition.id }, data: updateData });
        } else {
          const createData: Record<string, unknown> = {
            userId: user.id,
            marketId: trade.marketId,
            yesShares: 0,
            noShares: 0,
          };
          if (isMultiOption && trade.optionIndex !== undefined) {
            createData.optionShares = { [String(trade.optionIndex)]: Math.round(sharesOut) };
          } else {
            if (trade.side === "YES") createData.yesShares = Math.round(sharesOut);
            else createData.noShares = Math.round(sharesOut);
          }
          await tx.position.create({ data: createData });
        }

        results.push({
          marketId: trade.marketId,
          marketTitle: market.title,
          side: trade.side,
          shares: sharesOut,
          amount: trade.amountTzs,
        });
      }

      // Deduct balance and save preferredCurrency
      const userUpdate: Record<string, unknown> = { preferredCurrency: userCurrency };
      if (userCurrency === "USDC") {
        userUpdate.balanceUsdc = { decrement: totalAmountUsdc };
      } else if (userCurrency === "KES") {
        userUpdate.balanceKes = { decrement: Math.round(totalAmountKes) };
      } else {
        userUpdate.balanceTzs = { decrement: totalAmountTzs };
      }
      await tx.user.update({ where: { id: user.id }, data: userUpdate });

      // Transaction records
      for (const result of results) {
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "BUY_SHARES",
            amountTzs: userCurrency === "TZS" ? result.amount : 0,
            amountKes: userCurrency === "KES" ? Math.round(convertCurrency(result.amount, "TZS", "KES")) : 0,
            amountUsdc: userCurrency === "USDC" ? result.amount / USDC_TO_TZS_RATE : 0,
            currency: userCurrency,
            status: "COMPLETED",
            recipientUsername: `${result.marketTitle} (${result.side})`,
          },
        });
      }
    });

    // ── Transfer to platform escrow via nTZS ──────────────────────────────
    if (PLATFORM_NTZS_USER_ID && user.ntzsUserId) {
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs: totalAmountTzs,
        });
      } catch (err) {
        console.error("[BatchTrade] nTZS escrow transfer failed:", err);
      }
    }

    // Transfer fees from platform escrow → settlement fee wallet (non-blocking)
    const totalFees = Math.round(totalAmountTzs * FEE_PERCENT);
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && totalFees > 0) {
      ntzs.transfers.create({
        fromUserId: PLATFORM_NTZS_USER_ID,
        toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
        amountTzs: totalFees,
      }).catch((err) => console.error("[BatchTrade] Fee transfer failed (non-fatal):", err));
    }

    // Notification
    const amountDisplay = userCurrency === "USDC"
      ? `$${totalAmountUsdc.toFixed(2)} USDC`
      : userCurrency === "KES"
        ? `${Math.round(totalAmountKes).toLocaleString()} KES`
        : `${totalAmountTzs.toLocaleString()} TZS`;

    createNotification({
      userId: user.id,
      type: "TRADE",
      title: "Trades Successful!",
      message: `Bought ${trades.length} position${trades.length > 1 ? "s" : ""} for ${amountDisplay} total`,
      link: "/portfolio",
    });

    return NextResponse.json({
      success: true,
      trades: results,
      totalAmount: totalAmountTzs,
      totalTrades: trades.length,
      currency: userCurrency,
    });
  } catch (err: unknown) {
    console.error("[BatchTrade] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process batch trades" },
      { status: 500 }
    );
  }
}
