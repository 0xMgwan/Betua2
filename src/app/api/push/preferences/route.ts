import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("betua_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: payload.userId },
    });

    return NextResponse.json(prefs || {
      pushEnabled: true,
      tradePlaced: true,
      positionExpiring: true,
      positionPriceChange: true,
      marketResolved: true,
      winnings: true,
      priceChangeThreshold: 10,
      expiryWarningHours: 24,
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json({ error: "Failed to get preferences" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("betua_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updates = await req.json();

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: payload.userId },
      update: updates,
      create: { userId: payload.userId, ...updates },
    });

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
