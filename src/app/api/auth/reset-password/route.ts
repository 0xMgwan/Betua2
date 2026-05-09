import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma.user as any).findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() }, // not expired
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
