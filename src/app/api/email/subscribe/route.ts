import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, locale } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const subscription = await prisma.emailSubscription.upsert({
      where: { email },
      update: { isActive: true, locale: locale || "en" },
      create: { email, locale: locale || "en" },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
