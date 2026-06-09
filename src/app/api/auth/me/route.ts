import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        // DB balances — source of truth under the custodial pool model
        balanceTzs: true,
        balanceUsdc: true,
        balanceKes: true,
      },
    });
    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: {
        ...user,
        // balanceTzs/Usdc/Kes already included from select above
      }
    });
  } catch (err) {
    console.error("[Auth/me] Error:", err);
    return NextResponse.json({ user: null });
  }
}
