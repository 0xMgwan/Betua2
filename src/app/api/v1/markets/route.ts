/**
 * Markets API
 * GET /api/v1/markets - List markets (all public GUAP markets + partner's own markets)
 * POST /api/v1/markets - Create a new market (scoped to partner's platform)
 * 
 * Query params (GET):
 * - status: OPEN, RESOLVED, ALL (default: OPEN)
 * - category: filter by category
 * - limit: max results (default: 50, max: 100)
 * - offset: pagination offset
 * 
 * Body params (POST):
 * - title: string (required)
 * - description: string (required)
 * - category: string (required)
 * - subCategory: string (optional, for Sports)
 * - resolvesAt: ISO date string (required)
 * - imageUrl: string (optional)
 * - options: string[] (optional, for multi-option markets)
 * - creatorExternalId: string (required - partner's user ID who creates the market)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import { ntzs } from "@/lib/ntzs";
import { CATEGORIES } from "@/lib/utils";

// Fee configuration
const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const CREATION_FEE_NTZS_USER_ID = process.env.CREATION_FEE_NTZS_USER_ID || "";
const CREATION_FEE_TZS = parseInt(process.env.MARKET_CREATION_FEE_TZS || "2000", 10);

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/markets", "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "OPEN";
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause - show public markets (no partnerId) AND partner's own markets
    const where: any = {
      OR: [
        { partnerId: null }, // Public GUAP markets
        { partnerId: partner.partnerId }, // Partner's own markets
      ],
    };
    if (status !== "ALL") {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          subCategory: true,
          imageUrl: true,
          status: true,
          outcome: true,
          outcomeLabel: true,
          resolvesAt: true,
          resolvedAt: true,
          totalVolume: true,
          yesPool: true,
          noPool: true,
          options: true,
          optionPools: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.market.count({ where }),
    ]);

    // Calculate prices for each market
    const marketsWithPrices = markets.map((market) => {
      const isMultiOption = Array.isArray(market.options) && (market.options as string[]).length >= 2;
      
      if (isMultiOption) {
        const pools = (market.optionPools as number[]) || [];
        const totalPool = pools.reduce((a, b) => a + b, 0);
        const prices = pools.map((pool) => totalPool > 0 ? pool / totalPool : 0);
        return {
          ...market,
          type: "MULTI",
          prices: (market.options as string[]).map((opt, i) => ({
            option: opt,
            price: prices[i] || 0,
            probability: Math.round((prices[i] || 0) * 100),
          })),
        };
      } else {
        const total = market.yesPool + market.noPool;
        const yesPrice = total > 0 ? market.noPool / total : 0.5;
        const noPrice = total > 0 ? market.yesPool / total : 0.5;
        return {
          ...market,
          type: "BINARY",
          prices: {
            yes: { price: yesPrice, probability: Math.round(yesPrice * 100) },
            no: { price: noPrice, probability: Math.round(noPrice * 100) },
          },
        };
      }
    });

    await logApiRequest(partner.partnerId, "/api/v1/markets", "GET", 200, Date.now() - startTime, req);
    return apiSuccess({
      markets: marketsWithPrices,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (err) {
    console.error("Markets list error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/markets", "GET", 500, Date.now() - startTime, req);
    return apiError("Failed to fetch markets", 500);
  }
}

/**
 * POST /api/v1/markets - Create a new market
 * Markets created via API are scoped to the partner's platform only
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      category,
      subCategory,
      resolvesAt,
      imageUrl,
      options,
      creatorExternalId,
      // Optional advanced fields (parity with the in-app market creator)
      initialProb,      // binary: starting YES probability 1–99 (default 50)
      optionProbs,      // multi-option: starting probabilities (must sum ~100)
      fxRate,           // optional display FX rate
      pythSymbol,       // auto-resolve: e.g. "XAU/USD" (see GET /api/v1/categories)
      pythTargetPrice,  // auto-resolve: numeric target price
      pythOperator,     // auto-resolve: "above" | "below" (default "above")
    } = body;

    // For Pyth auto-resolve markets, the title can be generated automatically.
    const effectiveTitle = title ||
      (pythSymbol && pythTargetPrice
        ? `Will ${pythSymbol} be ${pythOperator === "below" ? "≤" : "≥"} $${Number(pythTargetPrice).toLocaleString()} USD by resolution?`
        : null);

    // Validate required fields
    if (!effectiveTitle || !description || !category || !resolvesAt || !creatorExternalId) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError("Missing required fields: title (or pythSymbol+pythTargetPrice), description, category, resolvesAt, creatorExternalId", 400);
    }

    // Validate category against the known list (see GET /api/v1/categories)
    if (!CATEGORIES.includes(category)) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError(`Invalid category '${category}'. Valid categories: ${CATEGORIES.join(", ")}`, 400);
    }

    // Find the partner user mapping
    const partnerUser = await prisma.partnerUser.findUnique({
      where: {
        partnerId_externalId: {
          partnerId: partner.partnerId,
          externalId: creatorExternalId,
        },
      },
    });

    if (!partnerUser) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 404, Date.now() - startTime, req);
      return apiError(`User with externalId '${creatorExternalId}' not found. Create user first via POST /api/v1/users`, 404);
    }

    // Get the internal user
    const user = await prisma.user.findUnique({
      where: { id: partnerUser.userId },
      select: { id: true, ntzsUserId: true, balanceTzs: true, walletAddress: true },
    });

    if (!user) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 404, Date.now() - startTime, req);
      return apiError("Internal user not found", 404);
    }

    // Pooled model: charge the creation fee against the DB balance ledger (the
    // funds already sit in the settlement pool). No personal wallet required.
    if ((user.balanceTzs || 0) < CREATION_FEE_TZS) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError(
        `Insufficient balance. Creating a market costs ${CREATION_FEE_TZS.toLocaleString()} TZS. User balance: ${(user.balanceTzs || 0).toLocaleString()} TZS.`,
        400
      );
    }

    // Forward the creation fee from the pool to the creation-fee wallet
    // (non-blocking; the DB balance is debited in the create transaction below).
    if (PLATFORM_NTZS_USER_ID && CREATION_FEE_NTZS_USER_ID) {
      ntzs.transfers
        .create({
          fromUserId: PLATFORM_NTZS_USER_ID,
          toUserId: CREATION_FEE_NTZS_USER_ID,
          amountTzs: CREATION_FEE_TZS,
        })
        .catch((err) => console.error("Creation fee forward failed (non-fatal):", err));
    }

    // Validate options for multi-option markets
    const isMultiOption = Array.isArray(options) && options.length >= 2;
    if (isMultiOption && options.length > 10) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError("Maximum 10 options allowed", 400);
    }

    // Pool configuration — seed pools from initialProb / optionProbs when provided
    // (same math as the in-app creator) so markets can open at custom odds.
    const POOL_PER_OPTION = 100000;
    const TOTAL_LIQUIDITY = 1000000;
    const n = isMultiOption ? options.length : 0;

    const hasValidProbs = isMultiOption
      && Array.isArray(optionProbs)
      && optionProbs.length === options.length
      && optionProbs.every((pp: number) => pp > 0)
      && Math.abs(optionProbs.reduce((s: number, pp: number) => s + pp, 0) - 100) <= 1;

    const optionPools = isMultiOption
      ? hasValidProbs
        ? options.map((_: unknown, i: number) => Math.round(POOL_PER_OPTION / (n * (optionProbs[i] / 100))))
        : options.map(() => POOL_PER_OPTION)
      : null;

    // Binary: P(YES) = noPool / (yesPool + noPool) = p  →  noPool = p·L, yesPool = (1-p)·L
    const p = (!isMultiOption && initialProb != null)
      ? Math.max(1, Math.min(99, Number(initialProb))) / 100
      : 0.5;
    const initYesPool = Math.round((1 - p) * TOTAL_LIQUIDITY);
    const initNoPool = Math.round(p * TOTAL_LIQUIDITY);

    // For Pyth auto-resolve markets, embed config in the description so the
    // hourly resolver can settle them from live prices.
    const finalDescription = pythSymbol && pythTargetPrice
      ? `${description}\n\n[PYTH:${pythSymbol}:${pythTargetPrice}:${pythOperator || "above"}]`
      : description;

    // Parse resolvesAt date
    let resolveDate: Date;
    try {
      resolveDate = new Date(resolvesAt);
      if (isNaN(resolveDate.getTime())) {
        throw new Error("Invalid date");
      }
    } catch {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError("Invalid resolvesAt date format. Use ISO 8601 format.", 400);
    }

    // Create market with partnerId (scoped to partner's platform)
    const [market] = await prisma.$transaction([
      prisma.market.create({
        data: {
          title: effectiveTitle,
          description: finalDescription,
          category,
          subCategory: category === "Sports" ? subCategory || null : null,
          imageUrl: imageUrl || null,
          resolvesAt: resolveDate,
          creatorId: user.id,
          partnerId: partner.partnerId, // IMPORTANT: Scopes market to partner's platform
          yesPool: isMultiOption ? 0 : initYesPool,
          noPool: isMultiOption ? 0 : initNoPool,
          liquidity: isMultiOption ? POOL_PER_OPTION * options.length : TOTAL_LIQUIDITY,
          options: isMultiOption ? options : undefined,
          optionPools: optionPools || undefined,
          fxRate: fxRate ? parseFloat(fxRate) : undefined,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          type: "CREATE_MARKET",
          amountTzs: CREATION_FEE_TZS,
          status: "COMPLETED",
          recipientUsername: effectiveTitle,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { balanceTzs: { decrement: CREATION_FEE_TZS } },
      }),
    ]);

    // Calculate prices for response
    const response = isMultiOption
      ? {
          id: market.id,
          title: market.title,
          description: market.description,
          category: market.category,
          subCategory: market.subCategory,
          imageUrl: market.imageUrl,
          status: market.status,
          resolvesAt: market.resolvesAt,
          type: "MULTI",
          options: (market.options as string[]).map((opt, i) => {
            const prob = hasValidProbs ? optionProbs[i] / 100 : 1 / options.length;
            return { option: opt, price: prob, probability: Math.round(prob * 100) };
          }),
          createdAt: market.createdAt,
          creationFee: CREATION_FEE_TZS,
        }
      : {
          id: market.id,
          title: market.title,
          description: market.description,
          category: market.category,
          subCategory: market.subCategory,
          imageUrl: market.imageUrl,
          status: market.status,
          resolvesAt: market.resolvesAt,
          type: "BINARY",
          prices: {
            yes: { price: p, probability: Math.round(p * 100) },
            no: { price: 1 - p, probability: Math.round((1 - p) * 100) },
          },
          createdAt: market.createdAt,
          creationFee: CREATION_FEE_TZS,
        };

    await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 201, Date.now() - startTime, req);
    return apiSuccess({ market: response }, 201);

  } catch (err) {
    console.error("Market creation error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 500, Date.now() - startTime, req);
    return apiError("Failed to create market", 500);
  }
}
