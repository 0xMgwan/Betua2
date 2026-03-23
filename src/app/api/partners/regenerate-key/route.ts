import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function POST(req: NextRequest) {
  try {
    // Get partner from session
    const cookieStore = await cookies();
    const token = cookieStore.get("partner_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const partner = await prisma.partner.findUnique({
      where: { id: decoded.partnerId },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Generate new API key
    const rawApiKey = `gp_live_${crypto.randomBytes(32).toString("hex")}`;
    // Use SHA256 hash to match api-auth.ts validation
    const hashedApiKey = crypto.createHash("sha256").update(rawApiKey).digest("hex");

    // Update partner with new key
    await prisma.partner.update({
      where: { id: partner.id },
      data: {
        apiKey: hashedApiKey,
        apiKeyPrefix: "gp_live_",
        rawApiKey: rawApiKey,
      },
    });

    return NextResponse.json({
      success: true,
      apiKey: rawApiKey,
      message: "API key regenerated successfully. Store it securely - it will not be shown again after you leave this page.",
    });
  } catch (error) {
    console.error("API key regeneration error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate API key" },
      { status: 500 }
    );
  }
}
