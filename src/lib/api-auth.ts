/**
 * API Authentication utilities for Partner integrations
 * Handles API key validation, rate limiting, and request logging
 */

import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import crypto from "crypto";

export interface PartnerContext {
  partnerId: string;
  partnerName: string;
  tier: string;
  rateLimit: number;
}

/**
 * Generate a new API key for a partner
 * Returns: { apiKey: "gp_live_xxx...", hashedKey: "sha256..." }
 */
export function generateApiKey(): { apiKey: string; hashedKey: string; prefix: string } {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const apiKey = `gp_live_${randomBytes}`;
  const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
  const prefix = "gp_live_";
  return { apiKey, hashedKey, prefix };
}

/**
 * Hash an API key for storage/comparison
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Validate API key from request headers
 * Returns partner context if valid, null if invalid
 */
export async function validateApiKey(req: NextRequest): Promise<PartnerContext | null> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer " prefix
  
  if (!apiKey.startsWith("gp_live_")) {
    return null;
  }

  const hashedKey = hashApiKey(apiKey);

  const partner = await prisma.partner.findUnique({
    where: { apiKey: hashedKey },
    select: {
      id: true,
      name: true,
      tier: true,
      rateLimit: true,
      isActive: true,
      isApproved: true,
    },
  });

  if (!partner || !partner.isActive || !partner.isApproved) {
    return null;
  }

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    tier: partner.tier,
    rateLimit: partner.rateLimit,
  };
}

/**
 * Log API request for analytics and rate limiting
 */
export async function logApiRequest(
  partnerId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTime: number,
  req: NextRequest
): Promise<void> {
  try {
    await prisma.apiLog.create({
      data: {
        partnerId,
        endpoint,
        method,
        statusCode,
        responseTime,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
      },
    });
  } catch (err) {
    console.error("Failed to log API request:", err);
  }
}

/**
 * Check rate limit for a partner
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(partnerId: string, rateLimit: number): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const requestCount = await prisma.apiLog.count({
    where: {
      partnerId,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  return requestCount < rateLimit;
}

/**
 * API response helpers
 */
export function apiError(message: string, status: number = 400) {
  return Response.json(
    { ok: false, error: message },
    { status }
  );
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return Response.json(
    { ok: true, data },
    { status }
  );
}

/**
 * Rate limit tiers
 */
export const RATE_LIMITS = {
  FREE: 100,        // 100 requests/minute
  BASIC: 500,       // 500 requests/minute
  PRO: 2000,        // 2000 requests/minute
  ENTERPRISE: 10000 // 10000 requests/minute
};
