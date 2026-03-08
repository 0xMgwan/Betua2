import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, username, password, phone } = await req.json();

    if (!email || !username || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return NextResponse.json({ error: "Email or username already taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, username, displayName: username, phone, passwordHash },
    });

    // Create NTZS wallet
    try {
      const ntzsUser = await ntzs.users.create({
        externalId: user.id,
        email,
        phone: phone || undefined,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { ntzsUserId: ntzsUser.id, walletAddress: ntzsUser.walletAddress },
      });
    } catch {
      // Non-fatal — wallet can be provisioned later
    }

    const token = await signToken({ userId: user.id, email, username });

    const res = NextResponse.json({ user: { id: user.id, email, username } });
    res.cookies.set("betua_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
