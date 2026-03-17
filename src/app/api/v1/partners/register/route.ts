/**
 * Partner Registration API
 * POST /api/v1/partners/register
 * 
 * Register a new partner and get API credentials
 * This endpoint is admin-protected in production
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey, RATE_LIMITS } from "@/lib/api-auth";
import crypto from "crypto";

const ADMIN_SECRET = process.env.ADMIN_API_SECRET || "dev-secret-change-in-production";

export async function POST(req: NextRequest) {
  try {
    // Verify admin secret for partner registration
    const adminSecret = req.headers.get("X-Admin-Secret");
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, email, tier = "FREE", webhookUrl } = body;

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if partner already exists
    const existing = await prisma.partner.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Partner with this email already exists" },
        { status: 409 }
      );
    }

    // Generate API key
    const { apiKey, hashedKey, prefix } = generateApiKey();

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    // Create partner
    const partner = await prisma.partner.create({
      data: {
        name,
        email,
        apiKey: hashedKey,
        apiKeyPrefix: prefix,
        tier: tier.toUpperCase(),
        rateLimit: RATE_LIMITS[tier.toUpperCase() as keyof typeof RATE_LIMITS] || RATE_LIMITS.FREE,
        webhookUrl: webhookUrl || null,
        webhookSecret,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        partnerId: partner.id,
        name: partner.name,
        email: partner.email,
        tier: partner.tier,
        rateLimit: partner.rateLimit,
        // IMPORTANT: This is the ONLY time the full API key is returned
        // Store it securely - it cannot be retrieved again
        apiKey: apiKey,
        apiKeyPrefix: prefix,
        webhookSecret: webhookSecret,
        message: "Store your API key securely. It will not be shown again.",
      },
    });
  } catch (err) {
    console.error("Partner registration error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to register partner" },
      { status: 500 }
    );
  }
}
