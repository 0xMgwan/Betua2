import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true, email: true, username: true, displayName: true,
        phone: true, bio: true, avatarUrl: true, walletAddress: true,
        ntzsUserId: true, createdAt: true, country: true, preferredCurrency: true,
        balanceTzs: true,
        balanceUsdc: true,
        balanceKes: true,
      },
    });
    if (!user) return NextResponse.json({ user: null });

    // DB is the source of truth — all deposits/withdrawals/trades update balanceTzs directly.
    // DB balance is the single source of truth (pooled model). We no longer
    // display the legacy personal nTZS wallet balance — showing it when DB was 0
    // surfaced a phantom balance that couldn't actually be spent.
    const balanceTzs  = Math.max(0, user.balanceTzs  || 0);
    const balanceUsdc = Math.max(0, user.balanceUsdc || 0);
    const balanceKes  = Math.max(0, user.balanceKes  || 0);

    return NextResponse.json({
      user: { ...user, balanceTzs, balanceUsdc, balanceKes }
    });
  } catch (err) {
    console.error("[Auth/me] Error:", err);
    return NextResponse.json({ user: null });
  }
}
