import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPrice, getMultiOptionPrices } from "@/lib/amm";
import { ntzs, NtzsApiError } from "@/lib/ntzs";

// Fee configuration
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const CREATION_FEE_NTZS_USER_ID = process.env.CREATION_FEE_NTZS_USER_ID || "";
const CREATION_FEE_TZS = parseInt(process.env.MARKET_CREATION_FEE_TZS || "2000", 10);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = markets.map((m: any) => ({
    ...m,
    price: getPrice(m.yesPool, m.noPool),
    optionPrices: m.options && m.optionPools
      ? getMultiOptionPrices(m.optionPools as number[])
      : null,
  }));

  return NextResponse.json({ markets: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, category, resolvesAt, imageUrl, pythSymbol, pythTargetPrice, pythOperator, options } = body;

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

    // ── Check balance & transfer 2,000 TZS creation fee ──────────────────────
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

    // ── Transfer 2,000 TZS creation fee: user → platform → fee wallet ────
    // ENFORCED: Market creation will fail if fee transfer fails
    if (PLATFORM_NTZS_USER_ID) {
      console.log(`Market creation fee transfer: ${user.ntzsUserId} (${user.walletAddress}) → ${PLATFORM_NTZS_USER_ID} (${CREATION_FEE_TZS} TZS)`);
      
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs: CREATION_FEE_TZS,
        });

        // Step 2: platform escrow → creation fee wallet (non-blocking, non-fatal)
        if (CREATION_FEE_NTZS_USER_ID) {
          ntzs.transfers
            .create({
              fromUserId: PLATFORM_NTZS_USER_ID,
              toUserId: CREATION_FEE_NTZS_USER_ID,
              amountTzs: CREATION_FEE_TZS,
            })
            .catch((err) =>
              console.error("Creation fee forward transfer failed (non-fatal):", err)
            );
        }
      } catch (err) {
        // FATAL: Block market creation if fee transfer fails
        if (err instanceof NtzsApiError) {
          console.error(
            `Market creation fee transfer failed [${err.status}/${err.code}]: ${err.message}`,
            `User: ${user.ntzsUserId} (${user.walletAddress})`
          );
          return NextResponse.json(
            {
              error: `Failed to process market creation fee. ${err.message || 'Please try again or contact support.'}`,
            },
            { status: 500 }
          );
        }
        throw err;
      }
    }

    // Note: Balance is managed by nTZS, not local DB
    // ─────────────────────────────────────────────────────────────────────

    // For Crypto markets with Pyth, store config as metadata in description
    const finalDescription = pythSymbol && pythTargetPrice
      ? `${description}\n\n[PYTH:${pythSymbol}:${pythTargetPrice}:${pythOperator || "above"}]`
      : description;

    // Validate custom options if provided
    const isMultiOption = Array.isArray(options) && options.length >= 2;
    if (isMultiOption && options.length > 10) {
      return NextResponse.json({ error: "Maximum 10 options allowed" }, { status: 400 });
    }

    // For multi-option: create equal pools per option
    const POOL_PER_OPTION = 5000;
    const optionPools = isMultiOption
      ? options.map(() => POOL_PER_OPTION)
      : null;

    const [market] = await prisma.$transaction([
      prisma.market.create({
        data: {
          title: effectiveTitle,
          description: finalDescription,
          category,
          imageUrl,
          resolvesAt: new Date(resolvesAt),
          creatorId: session.userId,
          yesPool: isMultiOption ? 0 : 100000,
          noPool: isMultiOption ? 0 : 100000,
          liquidity: isMultiOption ? POOL_PER_OPTION * options.length : 200000,
          options: isMultiOption ? options : undefined,
          optionPools: optionPools || undefined,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "CREATE_MARKET",
          amountTzs: CREATION_FEE_TZS,
          status: "COMPLETED",
          recipientUsername: effectiveTitle,
        },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { balanceTzs: { decrement: CREATION_FEE_TZS } },
      }),
    ]);

    return NextResponse.json({ market });
  } catch (err) {
    console.error("Market creation error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
