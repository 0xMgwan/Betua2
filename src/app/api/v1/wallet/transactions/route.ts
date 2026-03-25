/**
 * Partner Wallet Transactions API
 * GET /api/v1/wallet/transactions?externalId=xxx - Get user's transaction history
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) return apiError("Invalid or missing API key", 401);

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/wallet/transactions", "GET", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { searchParams } = new URL(req.url);
    const externalId = searchParams.get("externalId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!externalId) return apiError("externalId is required", 400);

    const mapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId } },
    });
    if (!mapping) return apiError("User not found", 404);

    const transactions = await prisma.transaction.findMany({
      where: { userId: mapping.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        amountTzs: true,
        status: true,
        phone: true,
        recipientUsername: true,
        createdAt: true,
      },
    });

    const total = await prisma.transaction.count({ where: { userId: mapping.userId } });

    await logApiRequest(partner.partnerId, "/api/v1/wallet/transactions", "GET", 200, Date.now() - startTime, req);
    return apiSuccess({ externalId, transactions, total, limit, offset });

  } catch (err) {
    console.error("Partner transactions error:", err);
    return apiError("Failed to fetch transactions", 500);
  }
}
