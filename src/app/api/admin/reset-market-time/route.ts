import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ADMIN_NTZS_USER_IDS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
];

// Set a specific market's resolution time
// Body: { "marketId": "xxx", "resolvesAt": "2026-03-14T19:55:00.000Z" }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ntzsUserId: true },
  });
  if (!user || !ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { marketId, resolvesAt } = await req.json();
    
    if (!marketId || !resolvesAt) {
      return NextResponse.json({ error: "Provide marketId and resolvesAt" }, { status: 400 });
    }

    const newTime = new Date(resolvesAt);
    if (isNaN(newTime.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true, title: true, resolvesAt: true },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const oldTime = market.resolvesAt;

    await prisma.market.update({
      where: { id: marketId },
      data: { resolvesAt: newTime },
    });

    return NextResponse.json({
      success: true,
      market: {
        id: market.id,
        title: market.title,
        oldTime: oldTime.toISOString(),
        newTime: newTime.toISOString(),
      },
    });
  } catch (error) {
    console.error("Reset market time error:", error);
    return NextResponse.json({ error: "Failed", details: String(error) }, { status: 500 });
  }
}
