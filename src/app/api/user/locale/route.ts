import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { locale } = await req.json();

    if (!locale || !["en", "sw"].includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { locale },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating locale:", error);
    return NextResponse.json({ error: "Failed to update locale" }, { status: 500 });
  }
}
