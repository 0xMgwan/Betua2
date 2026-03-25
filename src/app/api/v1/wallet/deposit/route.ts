/**
 * Partner Wallet Deposit API
 * POST /api/v1/wallet/deposit - Initiate a deposit for a user
 * 
 * Body params:
 * - externalId: string (required) - Partner's user ID
 * - amountTzs: number (required) - Amount to deposit (min 1000)
 * - phone: string (required) - M-Pesa phone number
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) {
    return apiError("Invalid or missing API key", 401);
  }

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const body = await req.json();
    const { externalId, amountTzs, phone } = body;

    // Validate required fields
    if (!externalId) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 400, Date.now() - startTime, req);
      return apiError("externalId is required", 400);
    }

    if (!amountTzs || amountTzs < 1000) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 400, Date.now() - startTime, req);
      return apiError("Minimum deposit is 1,000 TZS", 400);
    }

    if (!phone) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 400, Date.now() - startTime, req);
      return apiError("Phone number is required", 400);
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
      await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 404, Date.now() - startTime, req);
      return apiError("User not found. Create user first via POST /api/v1/users", 404);
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: mapping.userId },
      select: { id: true, ntzsUserId: true },
    });

    if (!user?.ntzsUserId) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 400, Date.now() - startTime, req);
      return apiError("User wallet not provisioned", 400);
    }

    // Create deposit via nTZS
    const deposit = await ntzs.deposits.create({
      userId: user.ntzsUserId,
      amountTzs,
      phone,
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        amountTzs,
        status: "PENDING",
        ntzsDepositId: deposit.id,
        phone,
      },
    });

    await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 201, Date.now() - startTime, req);
    return apiSuccess({
      depositId: deposit.id,
      externalId,
      amountTzs,
      phone,
      status: "PENDING",
      message: "STK push sent to phone. User should complete payment on their device.",
    }, 201);

  } catch (err) {
    console.error("Partner deposit error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/wallet/deposit", "POST", 500, Date.now() - startTime, req);
    
    if (err instanceof NtzsApiError) {
      return apiError(err.message || "Deposit failed", 400);
    }
    return apiError("Deposit failed", 500);
  }
}
