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

    // DB is the source of truth for deposits under the custodial pool model.
    // For legacy users with a personal nTZS wallet, also read their on-chain
    // balance and show whichever is higher — this covers the transition period
    // where some balance may still be in the personal wallet.
    let balanceTzs  = Math.max(0, user.balanceTzs  || 0);
    let balanceUsdc = Math.max(0, user.balanceUsdc  || 0);
    const balanceKes = Math.max(0, user.balanceKes  || 0);

    if (user.ntzsUserId) {
      try {
        const bal = await ntzs.users.getBalance(user.ntzsUserId);
        const ntzsTzs  = Math.max(0, bal.balanceTzs  || 0);
        const ntzsUsdc = Math.max(0, bal.balanceUsdc  || 0);

        // Use whichever is higher — DB gets credited by deposits,
        // nTZS wallet may still hold legacy funds. Never let nTZS overwrite
        // a higher DB balance (which reflects recent deposits to the pool).
        balanceTzs  = Math.max(balanceTzs,  ntzsTzs);
        balanceUsdc = Math.max(balanceUsdc, ntzsUsdc);
      } catch {
        // nTZS API unavailable — DB balance is already set above
      }
    }

    return NextResponse.json({
      user: {
        ...user,
        balanceTzs,
        balanceUsdc,
        balanceKes,
      }
    });
  } catch (err) {
    console.error("[Auth/me] Error:", err);
    return NextResponse.json({ user: null });
  }
}
