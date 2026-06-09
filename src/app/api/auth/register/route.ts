import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";
import { signToken } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email, username, password, phone, referralCode } = await req.json();

    if (!email || !username || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return NextResponse.json({ error: "Email or username already taken" }, { status: 409 });
    }

    // Look up referrer if referral code provided
    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.trim().toUpperCase() },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Detect country: Vercel sets x-vercel-ip-country on every request
    const ipCountry = req.headers.get('x-vercel-ip-country') || '';
    // Phone prefix takes priority over IP (more accurate for phone users)
    let country = ipCountry || 'TZ';
    if (phone?.startsWith('255') || phone?.startsWith('+255')) country = 'TZ';
    else if (phone?.startsWith('254') || phone?.startsWith('+254')) country = 'KE';
    else if (phone?.startsWith('234') || phone?.startsWith('+234')) country = 'NG';

    const user = await prisma.user.create({
      data: { email, username, displayName: username, phone, passwordHash, referredById, country },
    });

    // nTZS wallet creation disabled — all funds flow through the settlement pool.
    // Wallets are only provisioned for specific platform accounts.

    // Auto-subscribe to email notifications and send welcome email
    try {
      const sub = await prisma.emailSubscription.create({
        data: { email, locale: country === 'KE' ? 'sw' : 'en' },
      });
      sendWelcomeEmail(email, sub.locale, sub.unsubscribeToken).catch(() => {});
    } catch { /* ignore if already exists */ }

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
