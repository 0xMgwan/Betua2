/**
 * Categories API
 * GET /api/v1/categories - List valid market categories, sub-categories, and the
 * Pyth symbols available for auto-resolving FX & Commodity / Crypto markets.
 *
 * Use these exact values when creating markets via POST /api/v1/markets.
 */

import { NextRequest } from "next/server";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";
import { CATEGORIES, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { ALL_PYTH_SYMBOLS, CRYPTO_SYMBOLS, FX_SYMBOLS, COMMODITY_SYMBOLS } from "@/lib/pyth";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/categories", "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  await logApiRequest(partner.partnerId, "/api/v1/categories", "GET", 200, Date.now() - startTime, req);
  return apiSuccess({
    categories: CATEGORIES,
    // subCategories only apply when category === "Sports".
    subCategories: {
      Sports: SPORTS_SUBCATEGORIES.map((s) => ({ value: s.value, label: s.label })),
    },
    // Pyth symbols for auto-resolving markets (category "FX & Commodities" / crypto).
    // Pass one as `pythSymbol` (with `pythTargetPrice` + `pythOperator`) when creating a market.
    pythSymbols: {
      crypto: CRYPTO_SYMBOLS.map((s) => ({ symbol: s.symbol, label: s.label })),
      fx: FX_SYMBOLS.map((s) => ({ symbol: s.symbol, label: s.label })),
      commodities: COMMODITY_SYMBOLS.map((s) => ({ symbol: s.symbol, label: s.label })),
      all: ALL_PYTH_SYMBOLS.map((s) => s.symbol),
    },
  });
}
