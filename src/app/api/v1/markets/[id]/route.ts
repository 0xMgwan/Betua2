/**
 * Single Market API
 * GET /api/v1/markets/:id - Get market details
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, `/api/v1/markets/${id}`, "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        creator: {
          select: { username: true, displayName: true },
        },
        _count: {
          select: { positions: true, trades: true, comments: true },
        },
      },
    });

    if (!market) {
      await logApiRequest(partner.partnerId, `/api/v1/markets/${id}`, "GET", 404, Date.now() - startTime, req);
      return apiError("Market not found", 404);
    }

    // Calculate prices
    const isMultiOption = Array.isArray(market.options) && (market.options as string[]).length >= 2;
    let prices: any;

    if (isMultiOption) {
      const pools = (market.optionPools as number[]) || [];
      const totalPool = pools.reduce((a, b) => a + b, 0);
      prices = (market.options as string[]).map((opt, i) => ({
        option: opt,
        price: totalPool > 0 ? pools[i] / totalPool : 0,
        probability: totalPool > 0 ? Math.round((pools[i] / totalPool) * 100) : 0,
        pool: pools[i],
      }));
    } else {
      const total = market.yesPool + market.noPool;
      const yesPrice = total > 0 ? market.noPool / total : 0.5;
      const noPrice = total > 0 ? market.yesPool / total : 0.5;
      prices = {
        yes: { price: yesPrice, probability: Math.round(yesPrice * 100), pool: market.yesPool },
        no: { price: noPrice, probability: Math.round(noPrice * 100), pool: market.noPool },
      };
    }

    // Calculate total shares for payout estimation
    const positions = await prisma.position.findMany({
      where: { marketId: id },
      select: { yesShares: true, noShares: true, optionShares: true },
    });

    let totalYesShares = 0;
    let totalNoShares = 0;
    const totalOptionShares: Record<string, number> = {};

    for (const pos of positions) {
      totalYesShares += pos.yesShares;
      totalNoShares += pos.noShares;
      if (pos.optionShares) {
        const optShares = pos.optionShares as Record<string, number>;
        for (const [key, val] of Object.entries(optShares)) {
          totalOptionShares[key] = (totalOptionShares[key] || 0) + val;
        }
      }
    }

    await logApiRequest(partner.partnerId, `/api/v1/markets/${id}`, "GET", 200, Date.now() - startTime, req);
    return apiSuccess({
      id: market.id,
      title: market.title,
      description: market.description,
      category: market.category,
      subCategory: market.subCategory,
      imageUrl: market.imageUrl,
      status: market.status,
      outcome: market.outcome,
      outcomeLabel: market.outcomeLabel,
      resolvesAt: market.resolvesAt,
      resolvedAt: market.resolvedAt,
      totalVolume: market.totalVolume,
      type: isMultiOption ? "MULTI" : "BINARY",
      prices,
      totalShares: isMultiOption ? totalOptionShares : { yes: totalYesShares, no: totalNoShares },
      creator: market.creator,
      stats: {
        positions: market._count.positions,
        trades: market._count.trades,
        comments: market._count.comments,
      },
      createdAt: market.createdAt,
    });

  } catch (err) {
    console.error("Market fetch error:", err);
    await logApiRequest(partner.partnerId, `/api/v1/markets/${id}`, "GET", 500, Date.now() - startTime, req);
    return apiError("Failed to fetch market", 500);
  }
}
