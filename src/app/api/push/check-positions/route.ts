import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPositionExpiring, notifyPositionChange } from "@/lib/push";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let expiringNotified = 0;
    let priceChangeNotified = 0;

    // 1. Check for expiring positions (markets resolving within 24 hours)
    const expiringMarkets = await prisma.market.findMany({
      where: {
        status: "OPEN",
        resolvesAt: {
          gte: now,
          lte: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
        },
      },
      include: {
        positions: {
          where: {
            OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
          },
          include: {
            user: { select: { id: true, locale: true } },
          },
        },
      },
    });

    for (const market of expiringMarkets) {
      const hoursLeft = Math.round((market.resolvesAt.getTime() - now.getTime()) / (60 * 60 * 1000));
      
      for (const position of market.positions) {
        // Check user preferences
        const prefs = await prisma.notificationPreference.findUnique({
          where: { userId: position.userId },
        });
        
        if (prefs?.positionExpiring !== false && prefs?.pushEnabled !== false) {
          // Check if we already notified (use tag to prevent spam)
          const recentNotification = await prisma.notification.findFirst({
            where: {
              userId: position.userId,
              type: 'EXPIRING',
              link: `/markets/${market.id}`,
              createdAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) }, // 12 hours
            },
          });

          if (!recentNotification) {
            await notifyPositionExpiring(
              position.userId,
              market.title,
              hoursLeft,
              market.id,
              position.user.locale || 'en'
            );
            
            // Store in-app notification
            await prisma.notification.create({
              data: {
                userId: position.userId,
                type: 'EXPIRING',
                title: 'Market Expiring Soon',
                message: `"${market.title}" expires in ${hoursLeft} hours`,
                link: `/markets/${market.id}`,
              },
            });
            
            expiringNotified++;
          }
        }
      }
    }

    // 2. Check for significant price changes (>10% move)
    // Get all open markets with positions
    const marketsWithPositions = await prisma.market.findMany({
      where: { status: "OPEN" },
      include: {
        positions: {
          where: {
            OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
          },
          include: {
            user: { select: { id: true, locale: true } },
          },
        },
        trades: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    for (const market of marketsWithPositions) {
      // Calculate current price
      const currentYesPrice = market.yesPool / (market.yesPool + market.noPool);
      
      // Get price from 24 hours ago (approximate from trades)
      const oldTrades = market.trades.filter(
        t => t.createdAt < new Date(now.getTime() - 24 * 60 * 60 * 1000)
      );
      
      if (oldTrades.length > 0) {
        const oldPrice = oldTrades[0].price;
        const priceChange = ((currentYesPrice - oldPrice) / oldPrice) * 100;
        
        if (Math.abs(priceChange) >= 10) {
          for (const position of market.positions) {
            const prefs = await prisma.notificationPreference.findUnique({
              where: { userId: position.userId },
            });
            
            const threshold = prefs?.priceChangeThreshold || 10;
            
            if (Math.abs(priceChange) >= threshold && prefs?.positionPriceChange !== false && prefs?.pushEnabled !== false) {
              // Check if already notified recently
              const recentNotification = await prisma.notification.findFirst({
                where: {
                  userId: position.userId,
                  type: 'PRICE_CHANGE',
                  link: `/markets/${market.id}`,
                  createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) }, // 6 hours
                },
              });

              if (!recentNotification) {
                const side = position.yesShares > 0 ? 'YES' : 'NO';
                const relevantPrice = side === 'YES' ? currentYesPrice : 1 - currentYesPrice;
                const relevantChange = side === 'YES' ? priceChange : -priceChange;
                
                await notifyPositionChange(
                  position.userId,
                  market.title,
                  side,
                  relevantChange,
                  relevantPrice,
                  market.id,
                  position.user.locale || 'en'
                );
                
                await prisma.notification.create({
                  data: {
                    userId: position.userId,
                    type: 'PRICE_CHANGE',
                    title: 'Position Update',
                    message: `${side} in "${market.title}" moved ${relevantChange > 0 ? '+' : ''}${relevantChange.toFixed(0)}%`,
                    link: `/markets/${market.id}`,
                  },
                });
                
                priceChangeNotified++;
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      expiringNotified,
      priceChangeNotified,
    });
  } catch (error) {
    console.error("Check positions error:", error);
    return NextResponse.json({ error: "Failed to check positions" }, { status: 500 });
  }
}
