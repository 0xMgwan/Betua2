/**
 * Partner Wallet Withdrawal API
 * POST /api/v1/wallet/withdraw
 *
 * Mirrors the in-app withdrawal flow: debit the DB balance immediately, send
 * nTZS from the settlement pool (or the user's legacy personal wallet), and
 * reverse the debit if the nTZS API rejects it.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ntzs, NtzsApiError } from "@/lib/ntzs";
import { validateApiKey, checkRateLimit, logApiRequest, apiError, apiSuccess } from "@/lib/api-auth";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";

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
    if (!PLATFORM_NTZS_USER_ID) {
      return apiError("Settlement wallet not configured.", 500);
    }

    const mapping = await prisma.partnerUser.findUnique({
      where: { partnerId_externalId: { partnerId: partner.partnerId, externalId } },
    });
    if (!mapping) return apiError("User not found", 404);

    const user = await prisma.user.findUnique({
      where: { id: mapping.userId },
      select: { id: true, balanceTzs: true, ntzsUserId: true },
    });
    if (!user) return apiError("User not found", 404);

    // Funding source: "pool" (DB balance backed by settlement pool) or "wallet"
    // (legacy users whose funds still sit in their personal nTZS wallet).
    let dbBalance = user.balanceTzs || 0;
    let source: "pool" | "wallet" = "pool";

    if (dbBalance < amountTzs && user.ntzsUserId) {
      try {
        const { balanceTzs: walletTzs } = await ntzs.users.getBalance(user.ntzsUserId);
        if ((walletTzs || 0) >= amountTzs) {
          source = "wallet";
          dbBalance = Math.max(dbBalance, walletTzs || 0);
          // Sync DB to reflect the personal wallet balance for consistent accounting
          await prisma.user.update({ where: { id: user.id }, data: { balanceTzs: dbBalance } });
        }
      } catch {
        /* nTZS API down — fall through to the insufficient-balance check */
      }
    }

    if (dbBalance < amountTzs) {
      await logApiRequest(partner.partnerId, "/api/v1/wallet/withdraw", "POST", 400, Date.now() - startTime, req);
      return apiError(`Insufficient balance. Available: ${dbBalance.toLocaleString()} TZS`, 400);
    }

    // Debit DB balance immediately + create PENDING record atomically
    const [, tx] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { balanceTzs: { decrement: amountTzs } },
      }),
      prisma.transaction.create({
        data: { userId: user.id, type: "WITHDRAWAL", amountTzs, status: "PENDING", phone },
      }),
    ]);

    // Send nTZS → user's phone from the correct source.
    const fromUserId = source === "wallet" && user.ntzsUserId ? user.ntzsUserId : PLATFORM_NTZS_USER_ID;
    try {
      const withdrawal = await ntzs.withdrawals.create({ userId: fromUserId, amountTzs, phone });
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { ntzsWithdrawId: withdrawal.id, status: "COMPLETED" },
      });

      await logApiRequest(partner.partnerId, "/api/v1/wallet/withdraw", "POST", 201, Date.now() - startTime, req);
      return apiSuccess({ withdrawalId: withdrawal.id, externalId, amountTzs, phone, status: "COMPLETED" }, 201);
    } catch (wErr) {
      // nTZS API rejected it — reverse the debit and mark FAILED.
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { balanceTzs: { increment: amountTzs } } }),
        prisma.transaction.update({ where: { id: tx.id }, data: { status: "FAILED" } }),
      ]);
      console.error("Partner withdrawal API failed, reversed deduction:", wErr);
      throw wErr;
    }
  } catch (err) {
    console.error("Partner withdrawal error:", err);
    await logApiRequest(partner.partnerId, "/api/v1/wallet/withdraw", "POST", 500, Date.now() - startTime, req);
    if (err instanceof NtzsApiError) return apiError(err.message || "Withdrawal failed", 400);
    return apiError("Withdrawal failed", 500);
  }
}
