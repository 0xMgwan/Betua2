import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { email: true, country: true } });
  let subscribed = 0;

  for (const user of users) {
    try {
      await prisma.emailSubscription.create({
        data: { email: user.email, locale: user.country === 'KE' ? 'sw' : 'en' },
      });
      subscribed++;
    } catch { /* skip if exists */ }
  }

  return NextResponse.json({ subscribed, total: users.length });
}
