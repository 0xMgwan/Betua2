/**
 * Regenerate API Key for existing partner
 * POST /api/v1/partners/regenerate-key
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-auth";

const ADMIN_SECRET = process.env.ADMIN_API_SECRET || "dev-secret-change-in-production";

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get("X-Admin-Secret");
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.findUnique({
      where: { email },
    });

    if (!partner) {
      return NextResponse.json(
        { ok: false, error: "Partner not found" },
        { status: 404 }
      );
    }

    // Generate new API key
    const { apiKey, hashedKey, prefix } = generateApiKey();

    // Update partner with new key
    await prisma.partner.update({
      where: { email },
      data: {
        apiKey: hashedKey,
        apiKeyPrefix: prefix,
        isActive: true,
        isApproved: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        partnerId: partner.id,
        name: partner.name,
        email: partner.email,
        apiKey: apiKey,
        message: "New API key generated. Store it securely - it will not be shown again.",
      },
    });
  } catch (err) {
    console.error("API key regeneration error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to regenerate API key" },
      { status: 500 }
    );
  }
}
