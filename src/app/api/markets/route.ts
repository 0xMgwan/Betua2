import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPrice, getMultiOptionPrices, getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { createNotification, broadcastNewMarket } from "@/lib/notify";
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
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  "cmqr2tyew000004icz2ibal5y", // @goodmusic__tz — admin (no nTZS wallet, keyed by userId)
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const subCategory = searchParams.get("subCategory");
    const status = searchParams.get("status") || "OPEN";
    const search = searchParams.get("q");
    const sort = searchParams.get("sort") || "volume";

    // Category/subCategory filtering uses the EVENT as the source of truth for
    // event-linked markets (their own category/subCategory can drift from the
    // event after edits, and sub-markets never copy the event's subCategory).
    // Standalone markets are filtered by their own fields.
    const AND: Record<string, unknown>[] = [];
    if (category && category !== "all") {
      AND.push({ OR: [{ eventId: null, category }, { event: { category } }] });
    }
    if (subCategory && subCategory !== "all") {
      // Standalone markets must match the subcategory; event-linked markets are
      // always included (they span multiple sub-markets across subcategories).
      AND.push({ OR: [{ eventId: null, subCategory }, { eventId: { not: null } }] });
    }

    const markets = await prisma.market.findMany({
      where: {
        status: status === "all" ? undefined : status,
        ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
        resolvesAt: { gte: new Date() },
        ...(AND.length ? { AND } : {}),
      },
      include: {
        creator: { select: { username: true, avatarUrl: true } },
        event: { select: { id: true, title: true, imageUrl: true, category: true, subCategory: true } },
        _count: { select: { trades: { where: { isLpSeed: false } }, comments: true } },
      },
      orderBy: sort === "volume" ? { totalVolume: "desc" }
        : sort === "ending" ? { resolvesAt: "asc" }
        : { createdAt: "desc" },
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
    const { title, description, category, subCategory, resolvesAt, imageUrl, pythSymbol, pythTargetPrice, pythOperator, options, optionImages, initialProb, optionProbs, seedAmount: rawSeedAmount, seedCurrency, seedDistribution, fxRate } = body;
    const seedAmount = Math.max(0, Math.round(Number(rawSeedAmount) || 0));
    const isSeedUsdc = seedCurrency === 'USDC';
    const useProportionalSeed = seedDistribution === 'proportional';

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
      select: { id: true, ntzsUserId: true, balanceTzs: true, balanceKes: true, balanceUsdc: true, walletAddress: true, country: true }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Determine market currency based on creator's country
    const marketCurrency = getUserCurrency(user.country);

    // ── Check balance & deduct 2,000 TZS creation fee from DB (skip for admins) ──
    // All funds are in the settlement pool. Fee is deducted from DB balance here;
    // the pool then forwards it to the creation fee wallet (non-blocking).
    const isAdmin = ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId || "") ||
                    ADMIN_NTZS_USER_IDS.includes(session.userId);
    const USDC_TO_TZS_RATE = 2630;
    const CREATION_FEE_USDC = CREATION_FEE_TZS / USDC_TO_TZS_RATE;

    if (!isAdmin) {
      const dbTzs  = user.balanceTzs  || 0;
      const dbUsdc = user.balanceUsdc || 0;

      if (dbTzs < CREATION_FEE_TZS && dbUsdc < CREATION_FEE_USDC) {
        return NextResponse.json(
          { error: `Insufficient balance. Creating a market costs ${CREATION_FEE_TZS.toLocaleString()} TZS (~$${CREATION_FEE_USDC.toFixed(2)}). Your balance: ${dbTzs.toLocaleString()} TZS / $${dbUsdc.toFixed(2)} USDC.` },
          { status: 400 }
        );
      }

      // Deduct from DB balance (TZS preferred, else USDC)
      const useUsdc = dbTzs < CREATION_FEE_TZS;
      await prisma.user.update({
        where: { id: session.userId },
        data: useUsdc
          ? { balanceUsdc: { decrement: CREATION_FEE_USDC } }
          : { balanceTzs:  { decrement: CREATION_FEE_TZS  } },
      });

      // Forward fee: settlement pool → creation fee wallet (non-blocking, non-fatal)
      if (PLATFORM_NTZS_USER_ID && CREATION_FEE_NTZS_USER_ID) {
        ntzs.transfers.create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: CREATION_FEE_NTZS_USER_ID,
          amountTzs: CREATION_FEE_TZS,
        }).catch((err) => console.error("Creation fee forward failed (non-fatal):", err));
      }
    } else {
      console.log(`Admin user ${session.userId} creating market — fee waived`);
    }

    // ── Optional liquidity seed: deduct from creator's DB balance ──────────
    // Seed funds are already in the settlement pool; we just track them in DB.
    const MIN_SEED = 1000;
    const MAX_SEED = 10_000_000;
    let effectiveSeed = 0;
    if (seedAmount >= MIN_SEED) {
      if (seedAmount > MAX_SEED) {
        return NextResponse.json({ error: `Seed amount cannot exceed ${MAX_SEED.toLocaleString()} TZS` }, { status: 400 });
      }
      const seedUsdc = seedAmount / USDC_TO_TZS_RATE;
      const dbTzsNow  = user.balanceTzs  || 0;
      const dbUsdcNow = user.balanceUsdc || 0;
      if (!isSeedUsdc && dbTzsNow < seedAmount) {
        return NextResponse.json({ error: "Insufficient TZS balance to seed market." }, { status: 400 });
      }
      if (isSeedUsdc && dbUsdcNow < seedUsdc) {
        return NextResponse.json({ error: "Insufficient USDC balance to seed market." }, { status: 400 });
      }
      // Deduct seed from DB balance
      await prisma.user.update({
        where: { id: session.userId },
        data: isSeedUsdc
          ? { balanceUsdc: { decrement: seedUsdc } }
          : { balanceTzs:  { decrement: seedAmount } },
      });
      effectiveSeed = seedAmount;
      console.log(`Market seed: ${seedAmount} TZS deducted from DB balance for user ${session.userId}`);
    }

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
    // Helper to parse resolvesAt as EAT (GMT+3)
    const parseResolvesAt = () => {
      const [datePart, timePart] = resolvesAt.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
    };

    const marketData = {
      title: effectiveTitle,
      description: finalDescription,
      category,
      subCategory: category === "Sports" ? subCategory || null : null,
      imageUrl,
      resolvesAt: parseResolvesAt(),
      creatorId: session.userId,
      currency: marketCurrency,
      yesPool: isMultiOption ? 0 : initYesPool,
      noPool: isMultiOption ? 0 : initNoPool,
      liquidity: isMultiOption ? POOL_PER_OPTION * options.length : TOTAL_LIQUIDITY,
      options: isMultiOption ? options : undefined,
      optionPools: optionPools || undefined,
      // Per-side/per-option logos: multi = index-aligned with options; binary =
      // [0] YES, [1] NO. Only kept when at least one is set.
      optionImages: Array.isArray(optionImages) && optionImages.some((u: unknown) => typeof u === "string" && u)
        ? optionImages.map((u: unknown) => (typeof u === "string" ? u : "")).slice(0, isMultiOption ? options.length : 2)
        : undefined,
      seedAmount: effectiveSeed,
      totalVolume: effectiveSeed, // seed immediately backs the pot
      fxRate: fxRate ? parseFloat(fxRate) : undefined,
    };

    const market = isAdmin
      ? await prisma.market.create({ data: marketData })
      : (
          await prisma.$transaction([
            prisma.market.create({ data: { ...marketData, yesPool: isMultiOption ? 0 : initYesPool, noPool: isMultiOption ? 0 : initNoPool } }),
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

    // ── Create seeded position for creator (if they seeded) ──────────────────
    // Seed split: equal (default) or proportional to initial probability
    // At resolution creator redeems their winning-side shares like any bettor
    if (effectiveSeed > 0) {
      try {
        // No entry fee on LP seed — creator already transferred full amount to escrow.
        // Standard settlement fee still applies at resolution payout.

        if (isMultiOption && optionPools) {
          // Compute per-option seed amounts
          let seedPerOption: number[];
          if (useProportionalSeed && Array.isArray(optionProbs) && optionProbs.length === options.length) {
            const totalProb = optionProbs.reduce((s: number, p: number) => s + p, 0) || 100;
            seedPerOption = optionProbs.map((p: number) => Math.round(effectiveSeed * (p / totalProb)));
          } else {
            const perOption = Math.floor(effectiveSeed / options.length);
            seedPerOption = options.map(() => perOption);
          }

          const optionSharesMap: Record<string, number> = {};
          const currentPools = [...(optionPools as number[])];
          for (let i = 0; i < options.length; i++) {
            const netAmt = Math.round(seedPerOption[i]); // full amount, no entry fee
            if (netAmt <= 0) continue;
            const result = getMultiOptionSharesOut(netAmt, i, currentPools);
            optionSharesMap[String(i)] = Math.round(result.shares);
            result.newPools.forEach((p, idx) => { currentPools[idx] = p; });
          }

          // lpOptionShares mirrors optionShares so portfolio can distinguish seed vs trade shares
          await prisma.$transaction([
            prisma.position.create({
              data: { userId: session.userId, marketId: market.id, yesShares: 0, noShares: 0, optionShares: optionSharesMap, lpOptionShares: optionSharesMap },
            }),
            prisma.transaction.create({
              data: { userId: session.userId, type: "SEED_LIQUIDITY", amountTzs: effectiveSeed, currency: marketCurrency, status: "COMPLETED", recipientUsername: effectiveTitle },
            }),
          ]);
        } else {
          // Binary: split by prob or 50/50
          const yesPct = useProportionalSeed ? Math.max(1, Math.min(99, Number(initialProb) || 50)) : 50;
          const yesSeed = Math.round(effectiveSeed * yesPct / 100);
          const noSeed  = effectiveSeed - yesSeed;
          const yesResult = getSharesOut(yesSeed, market.noPool, market.yesPool); // full amount, no entry fee
          const noResult  = getSharesOut(noSeed,  market.yesPool, market.noPool);
          const yesShares = Math.round(yesResult.shares);
          const noShares  = Math.round(noResult.shares);

          // lpYesShares/lpNoShares mirror yesShares/noShares so portfolio can distinguish
          // seed shares from any additional trades the creator makes on their own market
          await prisma.$transaction([
            prisma.position.create({
              data: { userId: session.userId, marketId: market.id, yesShares, noShares, lpYesShares: yesShares, lpNoShares: noShares },
            }),
            prisma.trade.create({
              data: { userId: session.userId, marketId: market.id, side: "YES", amountTzs: yesSeed, shares: yesShares, price: yesResult.avgPrice, isLpSeed: true },
            }),
            prisma.trade.create({
              data: { userId: session.userId, marketId: market.id, side: "NO", amountTzs: noSeed, shares: noShares, price: noResult.avgPrice, isLpSeed: true },
            }),
            prisma.transaction.create({
              data: { userId: session.userId, type: "SEED_LIQUIDITY", amountTzs: effectiveSeed, currency: marketCurrency, status: "COMPLETED", recipientUsername: effectiveTitle },
            }),
          ]);
        }

        console.log(`Market ${market.id} seeded with ${effectiveSeed} TZS by creator ${session.userId}`);
      } catch (seedPosErr) {
        // Non-fatal: market is created and funds transferred, position record just failed
        console.error("Failed to create seed position records (non-fatal):", seedPosErr);
      }
    }

    // Notification: creator's own confirmation
    createNotification({
      userId: session.userId,
      type: "MARKET_CREATED",
      title: "Market Created",
      message: `Your market "${effectiveTitle}" is now live!${effectiveSeed > 0 ? ` Seeded with ${effectiveSeed.toLocaleString()} TZS.` : ""}`,
      link: `/markets/${market.id}`,
    });

    // Announce the new market to everyone else (bell + push), like resolution does.
    // Fire-and-forget so it never delays the create response.
    broadcastNewMarket({
      marketId: market.id,
      title: effectiveTitle,
      creatorId: session.userId,
      category,
    }).catch((e) => console.error("[markets] broadcast failed:", e));

    return NextResponse.json({ market });
  } catch (err) {
    console.error("Market creation error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
