import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/activity - Get recent platform activity (trades, resolutions)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const marketId = searchParams.get("marketId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  try {
    // Build where clause for trades
    const tradeWhere = marketId ? { marketId } : {};

    // Fetch recent trades
    const trades = await prisma.trade.findMany({
      where: tradeWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { username: true, avatarUrl: true } },
        market: { select: { id: true, title: true, status: true } },
      },
    });

    // Fetch recently resolved markets
    const resolvedMarkets = await prisma.market.findMany({
      where: {
        status: "RESOLVED",
        resolvedAt: { not: null },
        ...(marketId ? { id: marketId } : {}),
      },
      orderBy: { resolvedAt: "desc" },
      take: Math.min(limit, 10),
      select: {
        id: true,
        title: true,
        outcomeLabel: true,
        resolvedAt: true,
        creator: { select: { username: true, avatarUrl: true } },
      },
    });

    // Combine and format activities
    type Activity = {
      id: string;
      type: "TRADE" | "RESOLUTION";
      timestamp: Date;
      user: { username: string; avatarUrl: string | null };
      market: { id: string; title: string };
      details: {
        side?: string;
        shares?: number;
        amountTzs?: number;
        outcome?: string;
      };
    };

    const activities: Activity[] = [];

    // Add trades
    for (const trade of trades) {
      const isSell = trade.side.startsWith("SELL_");
      activities.push({
        id: `trade-${trade.id}`,
        type: "TRADE",
        timestamp: trade.createdAt,
        user: {
          username: trade.user.username,
          avatarUrl: trade.user.avatarUrl,
        },
        market: {
          id: trade.market.id,
          title: trade.market.title,
        },
        details: {
          side: isSell ? trade.side.replace("SELL_", "") : trade.side,
          shares: trade.shares,
          amountTzs: trade.amountTzs,
        },
      });
    }

    // Add resolutions (only for global feed, not market-specific)
    if (!marketId) {
      for (const market of resolvedMarkets) {
        if (market.resolvedAt) {
          activities.push({
            id: `resolution-${market.id}`,
            type: "RESOLUTION",
            timestamp: market.resolvedAt,
            user: {
              username: market.creator.username,
              avatarUrl: market.creator.avatarUrl,
            },
            market: {
              id: market.id,
              title: market.title,
            },
            details: {
              outcome: market.outcomeLabel || "Unknown",
            },
          });
        }
      }
    }

    // Sort by timestamp descending
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit final result
    const finalActivities = activities.slice(0, limit);

    return NextResponse.json({
      activities: finalActivities,
      count: finalActivities.length,
    });
  } catch (err) {
    console.error("Activity feed error:", err);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
