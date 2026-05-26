import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs } from "@/lib/ntzs";

// Prisma user IDs of admins (same list used in resolve/route.ts)
const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

// GET: diagnose a market's LP state
// POST: repair (pay out) a stuck LP position
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const marketId = req.nextUrl.searchParams.get("marketId");
  if (!marketId) return NextResponse.json({ error: "marketId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const market = await (prisma.market as any).findUnique({
    where: { id: marketId },
    select: {
      id: true, title: true, status: true, outcome: true, outcomeLabel: true,
      totalVolume: true, seedAmount: true, creatorId: true, options: true, optionPools: true,
    },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  const creatorPos = await prisma.position.findFirst({
    where: { marketId, userId: market.creatorId },
    select: { id: true, redeemed: true, optionShares: true, yesShares: true, noShares: true },
  });

  const lpRedeemTx = await prisma.transaction.findFirst({
    where: { userId: market.creatorId, type: "LP_REDEEM", recipientUsername: { contains: market.title } },
  });

  const allPositions = await prisma.position.findMany({ where: { marketId } });
  const winningOutcome = market.outcome;
  const isMulti = Array.isArray(market.options) && market.options.length >= 2;
  let totalWinShares = 0;
  let creatorWinShares = 0;
  for (const pos of allPositions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    const ws = isMulti
      ? ((p.optionShares as Record<string, number>) || {})[String(winningOutcome)] || 0
      : (winningOutcome === 1 ? pos.yesShares : pos.noShares);
    totalWinShares += ws;
    if (pos.userId === market.creatorId) creatorWinShares = ws;
  }

  // LP payout uses seed-proportional formula (not shares-based)
  // to match the fix in redeem/route.ts and resolve/route.ts
  const pot = Math.round(market.totalVolume * (1 - FEE_PERCENT));
  const seedAmount = market.seedAmount ?? 0;
  const grossPayout = seedAmount > 0 && market.totalVolume > 0
    ? Math.round((seedAmount / market.totalVolume) * pot)
    : 0;
  const settlementFee = Math.round(grossPayout * FEE_PERCENT);
  const netPayout = grossPayout - settlementFee;

  return NextResponse.json({
    market: { id: market.id, title: market.title, status: market.status, outcomeLabel: market.outcomeLabel, seedAmount: market.seedAmount, totalVolume: market.totalVolume },
    creatorPosition: creatorPos,
    lpRedeemTransaction: lpRedeemTx,
    diagnosis: {
      hasPosition: !!creatorPos,
      positionRedeemed: creatorPos?.redeemed ?? null,
      hasLpRedeemTx: !!lpRedeemTx,
      creatorWinShares,
      totalWinShares,
      netPayout,
      stuck: creatorPos?.redeemed && !lpRedeemTx,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { marketId } = await req.json();
  if (!marketId) return NextResponse.json({ error: "marketId required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const market = await (prisma.market as any).findUnique({
    where: { id: marketId },
    include: { positions: true },
  });
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  if (market.status !== "RESOLVED") return NextResponse.json({ error: "Market not resolved" }, { status: 400 });

  const creatorPos = market.positions.find((p: { userId: string }) => p.userId === market.creatorId);
  if (!creatorPos) return NextResponse.json({ error: "No creator position found" }, { status: 404 });

  // Check if already paid
  const existingTx = await prisma.transaction.findFirst({
    where: { userId: market.creatorId, type: "LP_REDEEM", recipientUsername: { contains: market.title } },
  });
  if (existingTx) return NextResponse.json({ error: "LP already redeemed", txId: existingTx.id }, { status: 400 });

  const isMulti = Array.isArray(market.options) && market.options.length >= 2;
  const winningOutcome = market.outcome;
  let totalWinShares = 0;
  let creatorWinShares = 0;

  for (const pos of market.positions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = pos as any;
    const ws = isMulti
      ? ((p.optionShares as Record<string, number>) || {})[String(winningOutcome)] || 0
      : (winningOutcome === 1 ? pos.yesShares : pos.noShares);
    totalWinShares += ws;
    if (pos.userId === market.creatorId) creatorWinShares = ws;
  }

  // LP payout = seed-proportional share of pot (not shares-based)
  const pot = Math.round(market.totalVolume * (1 - FEE_PERCENT));
  const seedAmount = market.seedAmount ?? 0;

  if (seedAmount === 0) {
    await prisma.position.update({ where: { id: creatorPos.id }, data: { redeemed: true } });
    return NextResponse.json({ success: true, payout: 0, note: "No seed amount — position marked redeemed" });
  }

  const grossPayout = market.totalVolume > 0
    ? Math.round((seedAmount / market.totalVolume) * pot)
    : 0;
  const settlementFee = Math.round(grossPayout * FEE_PERCENT);
  const payoutTzs = grossPayout - settlementFee;

  // Get creator details
  const creator = await prisma.user.findUnique({
    where: { id: market.creatorId },
    select: { ntzsUserId: true, preferredCurrency: true },
  });

  // Mark position as redeemed first
  if (!creatorPos.redeemed) {
    await prisma.position.update({ where: { id: creatorPos.id }, data: { redeemed: true } });
  }

  // nTZS transfer must succeed first — real money, not just local balance
  if (!PLATFORM_NTZS_USER_ID || !creator?.ntzsUserId) {
    return NextResponse.json({ error: "Missing nTZS config — cannot transfer" }, { status: 500 });
  }

  try {
    await ntzs.transfers.create({
      fromUserId: PLATFORM_NTZS_USER_ID,
      toUserId: creator.ntzsUserId,
      amountTzs: payoutTzs,
    });
  } catch (e) {
    return NextResponse.json({ error: "nTZS transfer failed — position not credited. Try again.", detail: String(e) }, { status: 500 });
  }

  // Transfer confirmed — now credit local balance + record transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: market.creatorId },
      data: { balanceTzs: { increment: payoutTzs } },
    }),
    prisma.transaction.create({
      data: {
        userId: market.creatorId,
        type: "LP_REDEEM",
        amountTzs: payoutTzs,
        currency: "TZS",
        status: "COMPLETED",
        recipientUsername: `LP seed return: ${market.title}`,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    payoutTzs,
    creatorWinShares,
    totalWinShares,
    note: "nTZS transfer confirmed + balance credited",
  });
}
