import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ADMIN_NTZS_USER_IDS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
];

// Add 720 hours ONLY to markets that are currently expired (resolvesAt < now)
// This fixes markets that were incorrectly pushed into the past
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ntzsUserId: true },
  });

  if (!user || !ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const now = new Date();
    const offsetMs = 720 * 60 * 60 * 1000; // 30 days

    // Get all markets that are currently expired
    const expiredMarkets = await prisma.market.findMany({
      where: {
        resolvesAt: { lt: now },
        status: "OPEN", // Only fix markets that are still open
      },
      select: {
        id: true,
        title: true,
        resolvesAt: true,
        status: true,
      },
    });

    const results = [];
    for (const market of expiredMarkets) {
      const oldTime = new Date(market.resolvesAt);
      const newTime = new Date(oldTime.getTime() + offsetMs);

      await prisma.market.update({
        where: { id: market.id },
        data: { resolvesAt: newTime },
      });

      results.push({
        title: market.title.substring(0, 50),
        old: oldTime.toISOString(),
        new: newTime.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Added 720 hours to ${expiredMarkets.length} expired markets`,
      fixed: expiredMarkets.length,
      results,
    });
  } catch (error) {
    console.error("Fix error:", error);
    return NextResponse.json(
      { error: "Fix failed", details: String(error) },
      { status: 500 }
    );
  }
}
