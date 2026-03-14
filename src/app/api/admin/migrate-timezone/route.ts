import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

// Admin user IDs who can run migrations
const ADMIN_NTZS_USER_IDS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
];

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ntzsUserId: true },
  });

  if (!user || !ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Get all markets
    const markets = await prisma.market.findMany({
      select: {
        id: true,
        title: true,
        resolvesAt: true,
        status: true,
      },
    });

    const updates = [];

    for (const market of markets) {
      const oldTime = new Date(market.resolvesAt);
      const newTime = new Date(oldTime.getTime() + EAT_OFFSET_MS);

      updates.push({
        id: market.id,
        title: market.title.substring(0, 50),
        status: market.status,
        oldTime: oldTime.toISOString(),
        newTime: newTime.toISOString(),
        oldLocal: oldTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
        newLocal: newTime.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }),
      });

      await prisma.market.update({
        where: { id: market.id },
        data: { resolvesAt: newTime },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${markets.length} markets to EAT timezone`,
      updated: markets.length,
      details: updates,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: String(error) },
      { status: 500 }
    );
  }
}
