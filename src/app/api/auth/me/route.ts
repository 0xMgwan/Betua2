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
        ntzsUserId: true, createdAt: true, country: true,
      },
    });
    if (!user) return NextResponse.json({ user: null });

    // Get live nTZS and USDC balances from nTZS API
    let balanceTzs = 0;
    let balanceUsdc = 0; // USDC as float (e.g., 6.50 = $6.50)
    if (user.ntzsUserId) {
      try {
        const bal = await ntzs.users.getBalance(user.ntzsUserId);
        balanceTzs = bal.balanceTzs;
        balanceUsdc = bal.balanceUsdc; // Already a float from nTZS API
      } catch (err) {
        console.error("[Auth/me] Failed to fetch balance:", err);
      }
    }

    return NextResponse.json({ 
      user: { 
        ...user, 
        balanceTzs,
        balanceUsdc, // Float (e.g., 6.50 = $6.50)
        balanceKes: 0,
      } 
    });
  } catch (err) {
    console.error("[Auth/me] Error:", err);
    return NextResponse.json({ user: null });
  }
}
