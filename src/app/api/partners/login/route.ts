import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "partner-secret");

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const partner = await prisma.partner.findUnique({ where: { email } });
    if (!partner?.passwordHash) return NextResponse.json({ error: "Invalid" }, { status: 401 });

    const valid = await bcrypt.compare(password, partner.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid" }, { status: 401 });

    const token = await new SignJWT({ partnerId: partner.id })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const res = NextResponse.json({
      success: true,
      partner: { id: partner.id, name: partner.name, tier: partner.tier, isApproved: partner.isApproved },
    });
    res.cookies.set("partner_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 604800,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
