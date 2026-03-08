import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, username: true, displayName: true,
      phone: true, bio: true, avatarUrl: true, walletAddress: true,
      ntzsUserId: true, createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ user: null });

  // Get live balance
  let balanceTzs = 0;
  if (user.ntzsUserId) {
    try {
      const bal = await ntzs.users.getBalance(user.ntzsUserId);
      balanceTzs = bal.balanceTzs;
    } catch {}
  }

  return NextResponse.json({ user: { ...user, balanceTzs } });
}
