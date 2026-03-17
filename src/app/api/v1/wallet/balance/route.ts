/**
 * Wallet Balance API
 * GET /api/v1/wallet/balance?externalId=xxx
 * 
 * Get user's wallet balance
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/wallet/balance", "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { searchParams } = new URL(req.url);
    const externalId = searchParams.get("externalId");

    if (!externalId) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/balance", "GET", 400, Date.now() - startTime, req);
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
      await logApiRequest(partner.partnerId, "/api/v1/wallet/balance", "GET", 404, Date.now() - startTime, req);
      return apiError("User not found", 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: mapping.userId },
      select: { id: true, balanceTzs: true, ntzsUserId: true },
    });

    if (!user) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/balance", "GET", 404, Date.now() - startTime, req);
      return apiError("User not found", 404);
    }

    // Get nTZS balance
    let balanceTzs = user.balanceTzs;
    if (user.ntzsUserId) {
      try {
        const ntzsUser = await ntzs.users.get(user.ntzsUserId);
        balanceTzs = ntzsUser.balanceTzs;
      } catch {
        // Fall back to local balance
      }
    }

    await logApiRequest(partner.partnerId, "/api/v1/wallet/balance", "GET", 200, Date.now() - startTime, req);
    return apiSuccess({
      externalId,
      balanceTzs,
      currency: "TZS",
    });

  } catch (err) {
    console.error("Balance check error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/wallet/balance", "GET", 500, Date.now() - startTime, req);
    return apiError("Failed to get balance", 500);
  }
}
