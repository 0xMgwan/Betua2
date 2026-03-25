/**
 * Partner Market Resolution API
 * POST /api/v1/markets/{id}/resolve - Resolve a partner's own market
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: marketId } = await params;

  const partner = await validateApiKey(req);
  if (!partner) return apiError("Invalid or missing API key", 401);

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, `/api/v1/markets/${marketId}/resolve`, "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { outcome, outcomeLabel } = await req.json();

    // Get market
    const market = await prisma.market.findUnique({ where: { id: marketId } });

    if (!market) return apiError("Market not found", 404);
    
    // Partners can only resolve their own markets
    if (market.partnerId !== partner.partnerId) {
      return apiError("You can only resolve your own markets", 403);
    }

    if (market.status !== "OPEN") {
      return apiError(`Market is already ${market.status}`, 400);
    }

    const isMultiOption = Array.isArray(market.options) && (market.options as string[]).length >= 2;

    // Validate outcome
    if (outcome === undefined || outcome === null) {
      return apiError("outcome is required", 400);
    }

    if (isMultiOption) {
      const options = market.options as string[];
      if (typeof outcome !== "number" || outcome < 0 || outcome >= options.length) {
        return apiError(`outcome must be 0-${options.length - 1} for multi-option markets`, 400);
      }
    } else {
      if (outcome !== 0 && outcome !== 1) {
        return apiError("outcome must be 0 (NO) or 1 (YES) for binary markets", 400);
      }
    }

    // Resolve market
    const resolvedMarket = await prisma.market.update({
      where: { id: marketId },
      data: {
        status: "RESOLVED",
        outcome,
        outcomeLabel: outcomeLabel || (isMultiOption 
          ? (market.options as string[])[outcome]
          : outcome === 1 ? "YES" : "NO"),
        resolvedAt: new Date(),
      },
    });

    await logApiRequest(partner.partnerId, `/api/v1/markets/${marketId}/resolve`, "POST", 200, Date.now() - startTime, req);
    return apiSuccess({
      marketId,
      title: resolvedMarket.title,
      status: resolvedMarket.status,
      outcome: resolvedMarket.outcome,
      outcomeLabel: resolvedMarket.outcomeLabel,
      resolvedAt: resolvedMarket.resolvedAt,
      message: "Market resolved. Users can now redeem their winnings.",
    });

  } catch (err) {
    console.error("Partner resolve error:", err);
    return apiError("Resolution failed", 500);
  }
}
