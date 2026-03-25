/**
 * Partner Wallet Send API
 * POST /api/v1/wallet/send - Send TZS between users
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
    await logApiRequest(partner.partnerId, "/api/v1/wallet/send", "POST", 429, Date.now() - startTime, req);
    return apiError("Rate limit exceeded", 429);
  }

  try {
    const { fromExternalId, toExternalId, amountTzs } = await req.json();

    if (!fromExternalId || !toExternalId || !amountTzs || amountTzs <= 0) {
      return apiError("fromExternalId, toExternalId, and amountTzs (> 0) are required", 400);
    }

    if (fromExternalId === toExternalId) {
      return apiError("Cannot send to yourself", 400);
    }

    // Get sender
    const senderMapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId: fromExternalId } },
    });
    if (!senderMapping) return apiError("Sender not found", 404);

    const sender = await prisma.user.findUnique({
      where: { id: senderMapping.userId },
      select: { id: true, ntzsUserId: true, username: true },
    });
    if (!sender?.ntzsUserId) return apiError("Sender wallet not provisioned", 400);

    // Get recipient
    const recipientMapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId: toExternalId } },
    });
    if (!recipientMapping) return apiError("Recipient not found", 404);

    const recipient = await prisma.user.findUnique({
      where: { id: recipientMapping.userId },
      select: { id: true, ntzsUserId: true, username: true },
    });
    if (!recipient?.ntzsUserId) return apiError("Recipient wallet not provisioned", 400);

    // Check balance
    const { balanceTzs } = await ntzs.users.getBalance(sender.ntzsUserId);
    if (balanceTzs < amountTzs) {
      return apiError(`Insufficient balance. Available: ${balanceTzs} TZS`, 400);
    }

    // Execute transfer
    const transfer = await ntzs.transfers.create({
      fromUserId: sender.ntzsUserId,
      toUserId: recipient.ntzsUserId,
      amountTzs,
    });

    // Record transactions
    await prisma.transaction.createMany({
      data: [
        { userId: sender.id, type: "SEND", amountTzs, status: "COMPLETED", recipientUsername: recipient.username },
        { userId: recipient.id, type: "RECEIVE", amountTzs: transfer.recipientAmountTzs, status: "COMPLETED", recipientUsername: sender.username },
      ],
    });

    await logApiRequest(partner.partnerId, "/api/v1/wallet/send", "POST", 200, Date.now() - startTime, req);
    return apiSuccess({
      transferId: transfer.id,
      fromExternalId,
      toExternalId,
      amountTzs: transfer.amountTzs,
      recipientAmountTzs: transfer.recipientAmountTzs,
      feeAmountTzs: transfer.feeAmountTzs,
      status: "COMPLETED",
    });

  } catch (err) {
    console.error("Partner send error:", err);
    if (err instanceof NtzsApiError) return apiError(err.message || "Transfer failed", 400);
    return apiError("Transfer failed", 500);
  }
}
