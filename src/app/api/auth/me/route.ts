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

    let balanceTzs  = Math.max(0, user.balanceTzs  || 0);
    let balanceUsdc = Math.max(0, user.balanceUsdc  || 0);
    let balanceKes  = Math.max(0, user.balanceKes   || 0);

    // For users with a personal nTZS wallet (legacy/platform accounts):
    // read live balance from nTZS API and sync it to DB so it becomes the source of truth.
    if (user.ntzsUserId) {
      try {
        const bal = await ntzs.users.getBalance(user.ntzsUserId);
        const liveTzs  = Math.max(0, bal.balanceTzs  || 0);
        const liveUsdc = Math.max(0, bal.balanceUsdc  || 0);

        // Sync to DB if nTZS wallet shows a higher (more accurate) balance
        if (liveTzs !== balanceTzs || liveUsdc !== balanceUsdc) {
          prisma.user.update({
            where: { id: user.id },
            data: { balanceTzs: liveTzs, balanceUsdc: liveUsdc },
          }).catch(() => {}); // fire-and-forget
        }

        balanceTzs  = liveTzs;
        balanceUsdc = liveUsdc;
      } catch {
        // nTZS API unavailable — use DB balance as fallback
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
