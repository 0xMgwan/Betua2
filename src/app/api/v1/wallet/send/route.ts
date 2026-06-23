/**
 * Partner Wallet Send API
 * POST /api/v1/wallet/send - Move TZS balance between two of the partner's users.
 *
 * Pooled model: this is a DB-balance ledger transfer (the funds already sit in
 * the settlement pool). Use it to fund end-users from a treasury user, etc.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const amt = Math.round(amountTzs);

    const [senderMapping, recipientMapping] = await Promise.all([
      prisma.partnerUser.findUnique({ where: { partnerId_externalId: { partnerId: partner.partnerId, externalId: fromExternalId } } }),
      prisma.partnerUser.findUnique({ where: { partnerId_externalId: { partnerId: partner.partnerId, externalId: toExternalId } } }),
    ]);
    if (!senderMapping) return apiError("Sender not found", 404);
    if (!recipientMapping) return apiError("Recipient not found", 404);

    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderMapping.userId }, select: { id: true, username: true, balanceTzs: true } }),
      prisma.user.findUnique({ where: { id: recipientMapping.userId }, select: { id: true, username: true } }),
    ]);
    if (!sender) return apiError("Sender not found", 404);
    if (!recipient) return apiError("Recipient not found", 404);

    if ((sender.balanceTzs || 0) < amt) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/send", "POST", 400, Date.now() - startTime, req);
      return apiError(`Insufficient balance. Available: ${(sender.balanceTzs || 0).toLocaleString()} TZS`, 400);
    }

    // Pooled ledger transfer (no fee; funds stay in the settlement pool).
    await prisma.$transaction([
      prisma.user.update({ where: { id: sender.id }, data: { balanceTzs: { decrement: amt } } }),
      prisma.user.update({ where: { id: recipient.id }, data: { balanceTzs: { increment: amt } } }),
      prisma.transaction.create({ data: { userId: sender.id, type: "SEND", amountTzs: amt, status: "COMPLETED", recipientUsername: recipient.username } }),
      prisma.transaction.create({ data: { userId: recipient.id, type: "RECEIVE", amountTzs: amt, status: "COMPLETED", recipientUsername: sender.username } }),
    ]);

    await logApiRequest(partner.partnerId, "/api/v1/wallet/send", "POST", 200, Date.now() - startTime, req);
    return apiSuccess({
      fromExternalId,
      toExternalId,
      amountTzs: amt,
      recipientAmountTzs: amt,
      feeAmountTzs: 0,
      status: "COMPLETED",
    });
  } catch (err) {
    console.error("Partner send error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/wallet/send", "POST", 500, Date.now() - startTime, req);
    return apiError("Transfer failed", 500);
  }
}
