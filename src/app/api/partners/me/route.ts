import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "partner-secret");

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("partner_token")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const partnerId = payload.partnerId as string;

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        rateLimit: true,
        isActive: true,
        isApproved: true,
        apiKeyPrefix: true,
        rawApiKey: true,
        webhookUrl: true,
        createdAt: true,
      },
    });

    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    return NextResponse.json({ partner });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
