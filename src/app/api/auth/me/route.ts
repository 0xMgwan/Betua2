import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseOnchainBalance } from "@/lib/houseWallets";

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

    // DB is the source of truth for regular users. For the platform's own
    // house/pool wallet, show the real on-chain nTZS balance (the pool) instead
    // of the DB accounting figure, which inflates over time.
    let balanceTzs  = Math.max(0, user.balanceTzs  || 0);
    let balanceUsdc = Math.max(0, user.balanceUsdc || 0);
    const balanceKes  = Math.max(0, user.balanceKes  || 0);
    const onchain = await getHouseOnchainBalance(user.ntzsUserId);
    if (onchain) {
      balanceTzs = onchain.balanceTzs;
      balanceUsdc = onchain.balanceUsdc;
    }

    return NextResponse.json({
      user: { ...user, balanceTzs, balanceUsdc, balanceKes }
    });
  } catch (err) {
    console.error("[Auth/me] Error:", err);
    return NextResponse.json({ user: null });
  }
}
