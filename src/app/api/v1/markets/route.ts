/**
 * Markets API
 * GET /api/v1/markets - List all markets
 * 
 * Query params:
 * - status: OPEN, RESOLVED, ALL (default: OPEN)
 * - category: filter by category
 * - limit: max results (default: 50, max: 100)
 * - offset: pagination offset
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

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

    // Build where clause
    const where: any = {};
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
