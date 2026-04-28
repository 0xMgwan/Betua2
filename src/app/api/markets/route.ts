import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPrice, getMultiOptionPrices } from "@/lib/amm";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification } from "@/lib/notify";
import { getUserCurrency } from "@/lib/currency";

// Fee configuration
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const CREATION_FEE_NTZS_USER_ID = process.env.CREATION_FEE_NTZS_USER_ID || "";
const CREATION_FEE_TZS = parseInt(process.env.MARKET_CREATION_FEE_TZS || "2000", 10);

// Admin users exempt from market creation fee
const ADMIN_NTZS_USER_IDS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
  "5e89781c-b8c0-4a49-a235-0bb0048ac18d",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const subCategory = searchParams.get("subCategory");
    const status = searchParams.get("status") || "OPEN";
    const search = searchParams.get("q");
    const sort = searchParams.get("sort") || "volume";

    const markets = await prisma.market.findMany({
      where: {
        status: status === "all" ? undefined : status,
        category: category && category !== "all" ? category : undefined,
        subCategory: subCategory && subCategory !== "all" ? subCategory : undefined,
        ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
        resolvesAt: { gte: new Date() },
      },
      include: {
        creator: { select: { username: true, avatarUrl: true } },
        event: { select: { id: true, title: true, imageUrl: true, category: true, subCategory: true } },
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
  } catch (error) {
    console.error("Markets API error:", error);
    return NextResponse.json({ error: "Failed to fetch markets", markets: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, category, subCategory, resolvesAt, imageUrl, pythSymbol, pythTargetPrice, pythOperator, options, initialProb, optionProbs } = body;

    // For crypto markets with Pyth config, title can be auto-generated
    const effectiveTitle = title ||
      (pythSymbol && pythTargetPrice
        ? `Will ${pythSymbol} be ${pythOperator === "above" ? "≥" : "≤"} $${Number(pythTargetPrice).toLocaleString()} USD by resolution?`
        : null);

    if (!effectiveTitle || !description || !category || !resolvesAt) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Load user to check balance and get nTZS user ID
    const user = await prisma.user.findUnique({ 
      where: { id: session.userId },
      select: { id: true, ntzsUserId: true, balanceTzs: true, balanceKes: true, walletAddress: true, country: true }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Determine market currency based on creator's country
    const marketCurrency = getUserCurrency(user.country);

    if (!user.ntzsUserId) {
      return NextResponse.json(
        { error: "Wallet not provisioned. Please deposit first to create markets." },
        { status: 400 }
      );
    }

    // ── Check balance & transfer 2,000 TZS creation fee (skip for admins) ────
    const isAdmin = ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId);
    const USDC_TO_TZS_RATE = 2630;
    const CREATION_FEE_USDC = CREATION_FEE_TZS / USDC_TO_TZS_RATE;

    if (!isAdmin) {
      // Check both nTZS and USDC balances
      let balanceTzs = 0;
      let balanceUsdc = 0;
      let useUsdc = false;

      try {
        const balances = await ntzs.users.getBalance(user.ntzsUserId);
        balanceTzs = balances.balanceTzs || 0;
        balanceUsdc = balances.balanceUsdc || 0;

        // Prefer nTZS if sufficient, otherwise try USDC
        if (balanceTzs >= CREATION_FEE_TZS) {
          useUsdc = false;
        } else if (balanceUsdc >= CREATION_FEE_USDC) {
          useUsdc = true;
        } else {
          // Neither balance is sufficient
          return NextResponse.json(
            {
              error: `Insufficient balance. Creating a market costs ${CREATION_FEE_TZS.toLocaleString()} TZS (~$${CREATION_FEE_USDC.toFixed(2)}). Your balance: ${balanceTzs.toLocaleString()} TZS / $${balanceUsdc.toFixed(2)} USDC.`,
            },
            { status: 400 }
          );
        }
      } catch (balErr) {
        console.error("Balance check failed:", balErr);
        if (balErr instanceof NtzsApiError) {
          return NextResponse.json(
            { error: `Could not verify balance: ${balErr.message}. Please try again.` },
            { status: 503 }
          );
        }
        return NextResponse.json(
          { error: "Could not verify balance. Please try again." },
          { status: 503 }
        );
      }

      // ── Transfer creation fee: user → platform → fee wallet ────
      // ENFORCED: Market creation will fail if fee transfer fails
      if (PLATFORM_NTZS_USER_ID) {
        try {
          // If using USDC, swap to nTZS first
          if (useUsdc) {
            console.log(`Market creation: swapping $${CREATION_FEE_USDC.toFixed(2)} USDC → ${CREATION_FEE_TZS} TZS for user ${user.ntzsUserId}`);
            const swapResult = await ntzs.swap.executeAndWait({
              userId: user.ntzsUserId,
              fromToken: 'USDC',
              toToken: 'NTZS',
              amount: CREATION_FEE_USDC,
              slippageBps: 100,
            });
            console.log(`Market creation swap completed: ${swapResult.txHash}`);
          }

          // Transfer nTZS fee to platform
          console.log(`Market creation fee transfer: ${user.ntzsUserId} (${user.walletAddress}) → ${PLATFORM_NTZS_USER_ID} (${CREATION_FEE_TZS} TZS)`);
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
          console.error("Market creation fee failed:", err);
          return NextResponse.json(
            { error: "Failed to process market creation fee. Please try again." },
            { status: 500 }
          );
        }
      }
    } else {
      console.log(`Admin user ${user.ntzsUserId} creating market - fee waived`);
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

    // For multi-option: seed pools from optionProbs if provided, else equal
    // Formula: pool_i = POOL_PER_OPTION / (n * p_i)
    // This satisfies getMultiOptionPrices: P(i) = (1/pool_i) / Σ(1/pool_j) = p_i
    const POOL_PER_OPTION = 100000;
    const n = isMultiOption ? options.length : 0;
    const hasValidProbs = isMultiOption
      && Array.isArray(optionProbs)
      && optionProbs.length === options.length
      && optionProbs.every((p: number) => p > 0)
      && Math.abs(optionProbs.reduce((s: number, p: number) => s + p, 0) - 100) <= 1;

    const optionPools = isMultiOption
      ? hasValidProbs
        ? options.map((_: unknown, i: number) => Math.round(POOL_PER_OPTION / (n * (optionProbs[i] / 100))))
        : options.map(() => POOL_PER_OPTION)
      : null;

    // Binary pool seeding from initial probability
    // P(YES) = noPool / (yesPool + noPool) = p  →  noPool = p * L, yesPool = (1-p) * L
    const TOTAL_LIQUIDITY = 1000000;
    const p = (!isMultiOption && initialProb != null)
      ? Math.max(1, Math.min(99, Number(initialProb))) / 100
      : 0.5;
    const initYesPool = Math.round((1 - p) * TOTAL_LIQUIDITY);
    const initNoPool  = Math.round(p * TOTAL_LIQUIDITY);

    // Create market and optionally record fee transaction (skip for admins)
    const market = isAdmin
      ? await prisma.market.create({
          data: {
            title: effectiveTitle,
            description: finalDescription,
            category,
            subCategory: category === "Sports" ? subCategory || null : null,
            imageUrl,
            resolvesAt: (() => {
              // Parse as EAT (GMT+3) - subtract 3 hours to get UTC
              const [datePart, timePart] = resolvesAt.split('T');
              const [year, month, day] = datePart.split('-').map(Number);
              const [hour, minute] = timePart.split(':').map(Number);
              return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
            })(),
            creatorId: session.userId,
            currency: marketCurrency,
            yesPool: isMultiOption ? 0 : initYesPool,
            noPool: isMultiOption ? 0 : initNoPool,
            liquidity: isMultiOption ? POOL_PER_OPTION * options.length : TOTAL_LIQUIDITY,
            options: isMultiOption ? options : undefined,
            optionPools: optionPools || undefined,
          },
        })
      : (
          await prisma.$transaction([
            prisma.market.create({
              data: {
                title: effectiveTitle,
                description: finalDescription,
                category,
                subCategory: category === "Sports" ? subCategory || null : null,
                imageUrl,
                resolvesAt: (() => {
                  // Parse as EAT (GMT+3) - subtract 3 hours to get UTC
                  const [datePart, timePart] = resolvesAt.split('T');
                  const [year, month, day] = datePart.split('-').map(Number);
                  const [hour, minute] = timePart.split(':').map(Number);
                  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
                })(),
                creatorId: session.userId,
                currency: marketCurrency,
                yesPool: isMultiOption ? 0 : 100000,
                noPool: isMultiOption ? 0 : 100000,
                liquidity: isMultiOption ? POOL_PER_OPTION * options.length : TOTAL_LIQUIDITY,
                options: isMultiOption ? options : undefined,
                optionPools: optionPools || undefined,
              },
            }),
            prisma.transaction.create({
              data: {
                userId: session.userId,
                type: "CREATE_MARKET",
                amountTzs: marketCurrency === 'TZS' ? CREATION_FEE_TZS : 0,
                amountKes: marketCurrency === 'KES' ? Math.round(CREATION_FEE_TZS / 18.5) : 0,
                currency: marketCurrency,
                status: "COMPLETED",
                recipientUsername: effectiveTitle,
              },
            }),
            prisma.user.update({
              where: { id: session.userId },
              data: marketCurrency === 'KES'
                ? { balanceKes: { decrement: Math.round(CREATION_FEE_TZS / 18.5) } }
                : { balanceTzs: { decrement: CREATION_FEE_TZS } },
            }),
          ])
        )[0];

    // Notification: market created
    createNotification({
      userId: session.userId,
      type: "MARKET_CREATED",
      title: "Market Created",
      message: `Your market "${effectiveTitle}" is now live!`,
      link: `/markets/${market.id}`,
    });

    return NextResponse.json({ market });
  } catch (err) {
    console.error("Market creation error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
