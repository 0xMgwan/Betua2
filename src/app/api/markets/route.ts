import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPrice } from "@/lib/amm";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

// Fee configuration
const CREATION_FEE_TZS = parseInt(process.env.MARKET_CREATION_FEE_TZS || "2000", 10);
const CREATION_FEE_NTZS_USER_ID = process.env.CREATION_FEE_NTZS_USER_ID || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status") || "OPEN";
  const search = searchParams.get("q");
  const sort = searchParams.get("sort") || "volume";

  const markets = await prisma.market.findMany({
    where: {
      status: status === "all" ? undefined : status,
      category: category && category !== "all" ? category : undefined,
      title: search ? { contains: search } : undefined,
    },
    include: {
      creator: { select: { username: true, avatarUrl: true } },
      _count: { select: { trades: true, comments: true } },
    },
    orderBy: sort === "volume" ? { totalVolume: "desc" } : { createdAt: "desc" },
    take: 50,
  });

  const enriched = markets.map((m) => ({
    ...m,
    price: getPrice(m.yesPool, m.noPool),
  }));

  return NextResponse.json({ markets: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, category, resolvesAt, imageUrl, pythSymbol, pythTargetPrice, pythOperator } = body;

    // For crypto markets with Pyth config, title can be auto-generated
    const effectiveTitle = title ||
      (pythSymbol && pythTargetPrice
        ? `Will ${pythSymbol} be ${pythOperator === "above" ? "≥" : "≤"} $${Number(pythTargetPrice).toLocaleString()} USD by resolution?`
        : null);

    if (!effectiveTitle || !description || !category || !resolvesAt) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Load user to check balance and get nTZS user ID
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (!user.ntzsUserId) {
      return NextResponse.json(
        { error: "Wallet not provisioned. Please deposit first to create markets." },
        { status: 400 }
      );
    }

    // ── Check & deduct 2,000 TZS market creation fee ──────────────────────
    try {
      const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
      if (balanceTzs < CREATION_FEE_TZS) {
        return NextResponse.json(
          {
            error: `Insufficient balance. Creating a market costs ${CREATION_FEE_TZS.toLocaleString()} TZS. Your balance: ${balanceTzs.toLocaleString()} TZS.`,
          },
          { status: 400 }
        );
      }
    } catch (balErr) {
      if (balErr instanceof NtzsApiError) {
        return NextResponse.json(
          { error: "Could not verify balance. Please try again." },
          { status: 503 }
        );
      }
      throw balErr;
    }

    // Transfer creation fee to fee wallet if configured
    if (CREATION_FEE_NTZS_USER_ID) {
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: CREATION_FEE_NTZS_USER_ID,
          amountTzs: CREATION_FEE_TZS,
        });
      } catch (err) {
        if (err instanceof NtzsApiError) {
          return NextResponse.json(
            { error: err.message || "Fee transfer failed. Please try again." },
            { status: 400 }
          );
        }
        throw err;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // For Crypto markets with Pyth, store config as metadata in description
    const finalDescription = pythSymbol && pythTargetPrice
      ? `${description}\n\n[PYTH:${pythSymbol}:${pythTargetPrice}:${pythOperator || "above"}]`
      : description;

    const market = await prisma.market.create({
      data: {
        title: effectiveTitle,
        description: finalDescription,
        category,
        imageUrl,
        resolvesAt: new Date(resolvesAt),
        creatorId: session.userId,
        yesPool: 100000,
        noPool: 100000,
        liquidity: 200000,
      },
    });

    return NextResponse.json({ market });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
