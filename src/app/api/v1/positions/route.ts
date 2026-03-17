/**
 * Positions API
 * GET /api/v1/positions - Get user's positions/portfolio
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

const FEE_PERCENT = parseFloat(process.env.TRANSACTION_FEE_PERCENT || "5") / 100;

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/positions", "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { searchParams } = new URL(req.url);
    const externalId = searchParams.get("externalId");
    const status = searchParams.get("status"); // OPEN, RESOLVED, ALL

    if (!externalId) {
      await logApiRequest(partner.partnerId, "/api/v1/positions", "GET", 400, Date.now() - startTime, req);
      return apiError("externalId is required");
    }

    // Find user mapping
    const mapping = await prisma.partnerUser.findUnique({
      where: {
        partnerId_externalId: {
          partnerId: partner.partnerId,
          externalId,
        },
      },
    });

    if (!mapping) {
      await logApiRequest(partner.partnerId, "/api/v1/positions", "GET", 404, Date.now() - startTime, req);
      return apiError("User not found", 404);
    }

    // Build where clause
    const where: any = { userId: mapping.userId };
    if (status && status !== "ALL") {
      where.market = { status };
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            outcome: true,
            outcomeLabel: true,
            totalVolume: true,
            yesPool: true,
            noPool: true,
            options: true,
            optionPools: true,
            resolvesAt: true,
            resolvedAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate values for each position
    const positionsWithValues = await Promise.all(positions.map(async (pos) => {
      const market = pos.market;
      const isMultiOption = Array.isArray(market.options) && (market.options as string[]).length >= 2;
      
      // Get total shares for payout calculation
      const allPositions = await prisma.position.findMany({
        where: { marketId: market.id },
        select: { yesShares: true, noShares: true, optionShares: true },
      });

      let totalYesShares = 0;
      let totalNoShares = 0;
      const totalOptionShares: Record<string, number> = {};

      for (const p of allPositions) {
        totalYesShares += p.yesShares;
        totalNoShares += p.noShares;
        if (p.optionShares) {
          const optShares = p.optionShares as Record<string, number>;
          for (const [key, val] of Object.entries(optShares)) {
            totalOptionShares[key] = (totalOptionShares[key] || 0) + val;
          }
        }
      }

      const pot = Math.round(market.totalVolume * (1 - FEE_PERCENT));

      if (isMultiOption) {
        const optShares = (pos.optionShares as Record<string, number>) || {};
        const options = market.options as string[];
        const pools = (market.optionPools as number[]) || [];
        const totalPool = pools.reduce((a, b) => a + b, 0);

        const holdings = options.map((opt, i) => {
          const shares = optShares[String(i)] || 0;
          const price = totalPool > 0 ? pools[i] / totalPool : 0;
          const totalShares = totalOptionShares[String(i)] || 0;
          const potentialPayout = totalShares > 0 
            ? Math.round((shares / totalShares) * pot * (1 - FEE_PERCENT))
            : 0;

          return {
            option: opt,
            optionIndex: i,
            shares,
            price,
            probability: Math.round(price * 100),
            potentialPayout,
            isWinner: market.status === "RESOLVED" && market.outcome === i,
          };
        }).filter(h => h.shares > 0);

        return {
          positionId: pos.id,
          marketId: market.id,
          marketTitle: market.title,
          marketStatus: market.status,
          type: "MULTI",
          holdings,
          redeemed: pos.redeemed,
          canRedeem: market.status === "RESOLVED" && !pos.redeemed && holdings.some(h => h.isWinner),
          resolvesAt: market.resolvesAt,
          resolvedAt: market.resolvedAt,
        };
      } else {
        const total = market.yesPool + market.noPool;
        const yesPrice = total > 0 ? market.noPool / total : 0.5;
        const noPrice = total > 0 ? market.yesPool / total : 0.5;

        const yesPayout = totalYesShares > 0 
          ? Math.round((pos.yesShares / totalYesShares) * pot * (1 - FEE_PERCENT))
          : 0;
        const noPayout = totalNoShares > 0 
          ? Math.round((pos.noShares / totalNoShares) * pot * (1 - FEE_PERCENT))
          : 0;

        const isYesWinner = market.status === "RESOLVED" && market.outcome === 1;
        const isNoWinner = market.status === "RESOLVED" && market.outcome === 0;

        return {
          positionId: pos.id,
          marketId: market.id,
          marketTitle: market.title,
          marketStatus: market.status,
          type: "BINARY",
          holdings: {
            yes: {
              shares: pos.yesShares,
              price: yesPrice,
              probability: Math.round(yesPrice * 100),
              potentialPayout: yesPayout,
              isWinner: isYesWinner,
            },
            no: {
              shares: pos.noShares,
              price: noPrice,
              probability: Math.round(noPrice * 100),
              potentialPayout: noPayout,
              isWinner: isNoWinner,
            },
          },
          redeemed: pos.redeemed,
          canRedeem: market.status === "RESOLVED" && !pos.redeemed && 
            ((isYesWinner && pos.yesShares > 0) || (isNoWinner && pos.noShares > 0)),
          resolvesAt: market.resolvesAt,
          resolvedAt: market.resolvedAt,
        };
      }
    }));

    await logApiRequest(partner.partnerId, "/api/v1/positions", "GET", 200, Date.now() - startTime, req);
    return apiSuccess({
      positions: positionsWithValues,
      count: positionsWithValues.length,
    });

  } catch (err) {
    console.error("Positions error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/positions", "GET", 500, Date.now() - startTime, req);
    return apiError("Failed to fetch positions", 500);
  }
}
