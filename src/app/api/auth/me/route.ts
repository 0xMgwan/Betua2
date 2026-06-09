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
    // For legacy users whose nTZS wallet still holds unmigrated funds (not yet reflected in DB),
    // we add the difference so they don't lose visibility of those funds.
    let balanceTzs  = Math.max(0, user.balanceTzs  || 0);
    let balanceUsdc = Math.max(0, user.balanceUsdc  || 0);
    const balanceKes = Math.max(0, user.balanceKes  || 0);

    if (user.ntzsUserId && balanceTzs === 0) {
      // Only check nTZS wallet when DB shows 0 — avoids overriding correct DB balance
      // (e.g. after a withdrawal the DB is lower but nTZS wallet may lag)
      try {
        const bal = await ntzs.users.getBalance(user.ntzsUserId);
        const ntzsTzs  = Math.max(0, bal.balanceTzs  || 0);
        const ntzsUsdc = Math.max(0, bal.balanceUsdc  || 0);
        if (ntzsTzs > 0)  balanceTzs  = ntzsTzs;
        if (ntzsUsdc > 0) balanceUsdc = ntzsUsdc;
      } catch {
        // nTZS API unavailable — DB value already used
      }
    }

    return NextResponse.json({
      user: { ...user, balanceTzs, balanceUsdc, balanceKes }
    });
  } catch (err) {
    console.error("[Auth/me] Error:", err);
    return NextResponse.json({ user: null });
  }
}
