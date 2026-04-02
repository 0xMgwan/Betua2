import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNewMarketsEmail } from "@/lib/email";

// This endpoint is called by a cron job or manually to send daily market emails
// Protect with a secret key
const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get markets created in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const newMarkets = await prisma.market.findMany({
      where: {
        createdAt: { gte: yesterday },
        status: "OPEN",
      },
      select: {
        id: true,
        title: true,
        category: true,
        imageUrl: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (newMarkets.length === 0) {
      return NextResponse.json({ message: "No new markets to send", sent: 0 });
    }

    // Get active subscribers
    const subscribers = await prisma.emailSubscription.findMany({
      where: { isActive: true },
    });

    if (subscribers.length === 0) {
      return NextResponse.json({ message: "No subscribers", sent: 0 });
    }

    // Send emails
    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      try {
        await sendNewMarketsEmail(
          sub.email,
          newMarkets,
          sub.locale,
          sub.unsubscribeToken
        );
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${sub.email}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      message: `Sent ${sent} emails, ${failed} failed`,
      sent,
      failed,
      markets: newMarkets.length,
    });
  } catch (error) {
    console.error("Send daily email error:", error);
    return NextResponse.json({ error: "Failed to send emails" }, { status: 500 });
  }
}
