/**
 * Partner Wallet Withdrawal API
 * POST /api/v1/wallet/withdraw
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  const partner = await validateApiKey(req);
  if (!partner) return apiError("Invalid or missing API key", 401);

  const withinLimit = await checkRateLimit(partner.partnerId, partner.rateLimit);
  if (!withinLimit) {
    await logApiRequest(partner.partnerId, "/api/v1/wallet/withdraw", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { externalId, amountTzs, phone } = await req.json();

    if (!externalId || !amountTzs || amountTzs < 1000 || !phone) {
      return apiError("externalId, amountTzs (min 1000), and phone are required", 400);
    }

    const mapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId } },
    });
    if (!mapping) return apiError("User not found", 404);

    const user = await prisma.user.findUnique({
      where: { id: mapping.userId },
      select: { id: true, ntzsUserId: true },
    });
    if (!user?.ntzsUserId) return apiError("User wallet not provisioned", 400);

    // Check balance
    const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
    if (balanceTzs < amountTzs) {
      return apiError(`Insufficient balance. Available: ${balanceTzs} TZS`, 400);
    }

    const withdrawal = await ntzs.withdrawals.create({ userId: user.ntzsUserId, amountTzs, phone });

    await prisma.transaction.create({
      data: { userId: user.id, type: "WITHDRAWAL", amountTzs, status: "PENDING", ntzsWithdrawId: withdrawal.id, phone },
    });

    await logApiRequest(partner.partnerId, "/api/v1/wallet/withdraw", "POST", 201, Date.now() - startTime, req);
    return apiSuccess({ withdrawalId: withdrawal.id, externalId, amountTzs, phone, status: "PENDING" }, 201);

  } catch (err) {
    console.error("Partner withdrawal error:", err);
    if (err instanceof NtzsApiError) return apiError(err.message || "Withdrawal failed", 400);
    return apiError("Withdrawal failed", 500);
  }
}
