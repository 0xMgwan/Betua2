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

    // Get partner users count
    const usersCount = await prisma.partnerUser.count({ where: { partnerId } });

    // Get API logs stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCalls, todayCalls, monthCalls, recentLogs] = await Promise.all([
      prisma.apiLog.count({ where: { partnerId } }),
      prisma.apiLog.count({ where: { partnerId, createdAt: { gte: today } } }),
      prisma.apiLog.count({ where: { partnerId, createdAt: { gte: thisMonth } } }),
      prisma.apiLog.findMany({
        where: { partnerId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { endpoint: true, method: true, statusCode: true, responseTime: true, createdAt: true },
      }),
    ]);

    // Get trades placed through this partner
    const partnerUserIds = await prisma.partnerUser.findMany({
      where: { partnerId },
      select: { userId: true },
    });
    const userIds = partnerUserIds.map((u) => u.userId);

    const [tradesCount, totalVolume] = await Promise.all([
      prisma.trade.count({ where: { userId: { in: userIds } } }),
      prisma.trade.aggregate({ where: { userId: { in: userIds } }, _sum: { amountTzs: true } }),
    ]);

    return NextResponse.json({
      users: usersCount,
      apiCalls: { total: totalCalls, today: todayCalls, thisMonth: monthCalls },
      trades: { count: tradesCount, volume: totalVolume._sum.amountTzs || 0 },
      recentLogs,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
