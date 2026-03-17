import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Self-service partner registration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, companyDescription } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if partner already exists
    const existingPartner = await prisma.partner.findUnique({
      where: { email },
    });

    if (existingPartner) {
      return NextResponse.json(
        { error: "A partner with this email already exists" },
        { status: 409 }
      );
    }

    // Generate API key
    const rawApiKey = `gp_live_${crypto.randomBytes(24).toString("hex")}`;
    const hashedApiKey = await bcrypt.hash(rawApiKey, 10);
    const apiKeyPrefix = rawApiKey.substring(0, 16);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create partner (not approved by default)
    const partner = await prisma.partner.create({
      data: {
        name,
        email,
        passwordHash,
        apiKey: hashedApiKey,
        apiKeyPrefix,
        rawApiKey, // Store raw key so partner can see it in dashboard
        tier: "FREE",
        rateLimit: 100,
        isActive: true,
        isApproved: false, // Requires admin approval
        metadata: companyDescription ? { description: companyDescription } : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Registration successful! Your account is pending approval.",
      partnerId: partner.id,
      email: partner.email,
      apiKeyPrefix: partner.apiKeyPrefix,
      isApproved: partner.isApproved,
    });
  } catch (error) {
    console.error("Partner registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
