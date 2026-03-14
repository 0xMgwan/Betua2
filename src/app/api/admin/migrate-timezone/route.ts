import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ADMIN_NTZS_USER_IDS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
];

// GET: List all market times for inspection
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ntzsUserId: true },
  });
  if (!user || !ADMIN_NTZS_USER_IDS.includes(user.ntzsUserId || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const markets = await prisma.market.findMany({
    select: { id: true, title: true, resolvesAt: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    count: markets.length,
    markets: markets.map((m) => ({
      id: m.id,
      title: m.title.substring(0, 60),
      status: m.status,
      resolvesAt: m.resolvesAt.toISOString(),
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

// POST: Subtract hours from all market resolvesAt
// Body: { "hours": 702 }  — number of hours to SUBTRACT
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
    const { hours } = await req.json();
    if (typeof hours !== "number" || hours <= 0) {
      return NextResponse.json({ error: "Provide a positive 'hours' number to subtract" }, { status: 400 });
    }

    const offsetMs = hours * 60 * 60 * 1000;

    const markets = await prisma.market.findMany({
      select: { id: true, title: true, resolvesAt: true, status: true },
    });

    const results = [];
    for (const market of markets) {
      const oldTime = new Date(market.resolvesAt);
      const newTime = new Date(oldTime.getTime() - offsetMs);

      await prisma.market.update({
        where: { id: market.id },
        data: { resolvesAt: newTime },
      });

      results.push({
        title: market.title.substring(0, 50),
        status: market.status,
        old: oldTime.toISOString(),
        new: newTime.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Subtracted ${hours} hours from ${markets.length} markets`,
      updated: markets.length,
      results,
    });
  } catch (error) {
    console.error("Fix error:", error);
    return NextResponse.json({ error: "Fix failed", details: String(error) }, { status: 500 });
  }
}
