import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { getSharesOut } from "@/lib/amm";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { marketId, side, amountTzs } = await req.json();

    if (!marketId || !side || !amountTzs || amountTzs < 100) {
      return NextResponse.json({ error: "Minimum trade is 100 TZS" }, { status: 400 });
    }

    const [market, user] = await Promise.all([
      prisma.market.findUnique({ where: { id: marketId } }),
      prisma.user.findUnique({ where: { id: session.userId } }),
    ]);

    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
    if (market.status !== "OPEN") return NextResponse.json({ error: "Market is not open" }, { status: 400 });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Enforce wallet balance
    if (user.ntzsUserId) {
      try {
        const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
        if (balanceTzs < amountTzs) {
          return NextResponse.json({
            error: `Insufficient balance. You have ${balanceTzs.toLocaleString()} TZS — deposit more to trade.`,
          }, { status: 400 });
        }
      } catch (balErr) {
        // If NTZS is unreachable, fall back to local balance check
        if (balErr instanceof NtzsApiError) {
          if ((user.balanceTzs || 0) < amountTzs) {
            return NextResponse.json({ error: `Insufficient balance.` }, { status: 400 });
          }
        }
      }
    } else {
      // No nTZS wallet — check local balance
      if ((user.balanceTzs || 0) < amountTzs) {
        return NextResponse.json({ error: "Insufficient balance. Deposit funds first." }, { status: 400 });
      }
    }

    // ── 5% platform fee ───────────────────────────────────────────────────
    const feeAmount = Math.round(amountTzs * FEE_PERCENT);
    const tradeAmount = amountTzs - feeAmount; // Amount used in AMM
    // ─────────────────────────────────────────────────────────────────────

    // Calculate shares via AMM using net trade amount (after fee)
    const { shares, newPoolIn, newPoolOut, avgPrice } =
      side === "YES"
        ? getSharesOut(tradeAmount, market.noPool, market.yesPool)
        : getSharesOut(tradeAmount, market.yesPool, market.noPool);

    let ntzsTransferId: string | undefined;

    // Transfer full amount from user → platform escrow via NTZS
    if (PLATFORM_NTZS_USER_ID) {
      try {
        const transfer = await ntzs.transfers.create({
          fromUserId: user.ntzsUserId!,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs,
        });
        ntzsTransferId = transfer.id;
      } catch (err) {
        if (err instanceof NtzsApiError) {
          return NextResponse.json({ error: err.message || "Transfer failed" }, { status: 400 });
        }
        throw err;
      }
    }

    // Transfer 5% fee from platform escrow → settlement fee wallet
    if (PLATFORM_NTZS_USER_ID && SETTLEMENT_FEE_NTZS_USER_ID && feeAmount > 0) {
      try {
        await ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: SETTLEMENT_FEE_NTZS_USER_ID,
          amountTzs: feeAmount,
        });
      } catch (feeErr) {
        // Non-fatal: log but don't fail the trade
        console.error("Fee transfer failed (non-fatal):", feeErr);
      }
    }

    // Update market pools + position + record trade + deduct balance atomically
    const [updatedMarket, , trade] = await prisma.$transaction([
      prisma.market.update({
        where: { id: marketId },
        data: {
          yesPool: side === "YES" ? Math.round(newPoolOut) : Math.round(newPoolIn),
          noPool: side === "NO" ? Math.round(newPoolOut) : Math.round(newPoolIn),
          totalVolume: { increment: amountTzs },
        },
      }),
      prisma.position.upsert({
        where: { userId_marketId: { userId: session.userId, marketId } },
        create: {
          userId: session.userId,
          marketId,
          yesShares: side === "YES" ? Math.round(shares) : 0,
          noShares: side === "NO" ? Math.round(shares) : 0,
        },
        update: {
          yesShares: side === "YES" ? { increment: Math.round(shares) } : undefined,
          noShares: side === "NO" ? { increment: Math.round(shares) } : undefined,
        },
      }),
      prisma.trade.create({
        data: {
          userId: session.userId,
          marketId,
          side,
          amountTzs,
          shares: Math.round(shares),
          price: avgPrice,
          ntzsTransferId,
        },
      }),
    ]);

    // Deduct balance from local user record
    await prisma.user.update({
      where: { id: session.userId },
      data: { balanceTzs: { decrement: amountTzs } },
    });

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
    return NextResponse.json({ error: "Trade failed. Please try again." }, { status: 500 });
  }
}
