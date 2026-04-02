import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  await prisma.emailSubscription.updateMany({
    where: { unsubscribeToken: token },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
