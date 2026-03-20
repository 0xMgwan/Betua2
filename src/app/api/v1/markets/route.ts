/**
 * Markets API
 * GET /api/v1/markets - List markets (partner sees only their markets)
 * POST /api/v1/markets - Create a new market (only visible on partner's platform)
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
import { ntzs, NtzsApiError } from "@/lib/ntzs";

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

    // Build where clause - only show partner's own markets
    const where: any = {
      partnerId: partner.partnerId, // Only show markets created by this partner
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
      creatorExternalId 
    } = body;

    // Validate required fields
    if (!title || !description || !category || !resolvesAt || !creatorExternalId) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError("Missing required fields: title, description, category, resolvesAt, creatorExternalId", 400);
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

    if (!user.ntzsUserId) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError("User wallet not provisioned. User must deposit first to create markets.", 400);
    }

    // Check balance and transfer creation fee
    try {
      const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
      if (balanceTzs < CREATION_FEE_TZS) {
        await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
        return apiError(
          `Insufficient balance. Creating a market costs ${CREATION_FEE_TZS.toLocaleString()} TZS. User balance: ${balanceTzs.toLocaleString()} TZS.`,
          400
        );
      }
    } catch (balErr) {
      if (balErr instanceof NtzsApiError) {
        await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 503, Date.now() - startTime, req);
        return apiError("Could not verify balance. Please try again.", 503);
      }
      throw balErr;
    }

    // Transfer creation fee
    if (PLATFORM_NTZS_USER_ID) {
      try {
        await ntzs.transfers.create({
          fromUserId: user.ntzsUserId,
          toUserId: PLATFORM_NTZS_USER_ID,
          amountTzs: CREATION_FEE_TZS,
        });

        // Forward to creation fee wallet (non-blocking)
        if (CREATION_FEE_NTZS_USER_ID) {
          ntzs.transfers
            .create({
              fromUserId: PLATFORM_NTZS_USER_ID,
              toUserId: CREATION_FEE_NTZS_USER_ID,
              amountTzs: CREATION_FEE_TZS,
            })
            .catch((err) => console.error("Creation fee forward failed (non-fatal):", err));
        }
      } catch (err) {
        if (err instanceof NtzsApiError) {
          console.error(`Market creation fee transfer failed: ${err.message}`);
          await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 500, Date.now() - startTime, req);
          return apiError(`Failed to process market creation fee: ${err.message}`, 500);
        }
        throw err;
      }
    }

    // Validate options for multi-option markets
    const isMultiOption = Array.isArray(options) && options.length >= 2;
    if (isMultiOption && options.length > 10) {
      await logApiRequest(partner.partnerId, "/api/v1/markets", "POST", 400, Date.now() - startTime, req);
      return apiError("Maximum 10 options allowed", 400);
    }

    // Pool configuration
    const POOL_PER_OPTION = 5000;
    const optionPools = isMultiOption ? options.map(() => POOL_PER_OPTION) : null;

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
          title,
          description,
          category,
          subCategory: category === "Sports" ? subCategory || null : null,
          imageUrl: imageUrl || null,
          resolvesAt: resolveDate,
          creatorId: user.id,
          partnerId: partner.partnerId, // IMPORTANT: Scopes market to partner's platform
          yesPool: isMultiOption ? 0 : 100000,
          noPool: isMultiOption ? 0 : 100000,
          liquidity: isMultiOption ? POOL_PER_OPTION * options.length : 200000,
          options: isMultiOption ? options : undefined,
          optionPools: optionPools || undefined,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          type: "CREATE_MARKET",
          amountTzs: CREATION_FEE_TZS,
          status: "COMPLETED",
          recipientUsername: title,
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
          options: (market.options as string[]).map((opt, i) => ({
            option: opt,
            price: 1 / options.length,
            probability: Math.round((1 / options.length) * 100),
          })),
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
            yes: { price: 0.5, probability: 50 },
            no: { price: 0.5, probability: 50 },
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
