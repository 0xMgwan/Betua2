import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function generateCode(username: string): string {
  const hash = crypto.randomBytes(3).toString("hex"); // 6 chars
  return `${username.slice(0, 6).toUpperCase()}${hash}`;
}

// GET: fetch my referral code, stats, and rewards
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      referralCode: true,
      username: true,
      referrals: {
        select: { id: true, username: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      referralRewards: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Auto-generate referral code if user doesn't have one
  let code = user.referralCode;
  if (!code) {
    code = generateCode(user.username);
    // Handle unlikely collision
    try {
      await prisma.user.update({
        where: { id: session.userId },
        data: { referralCode: code },
      });
    } catch {
      // Collision — retry with fresh random
      code = generateCode(user.username + crypto.randomBytes(2).toString("hex"));
      await prisma.user.update({
        where: { id: session.userId },
        data: { referralCode: code },
      });
    }
  }

  const totalEarned = user.referralRewards
    .filter((r) => r.status === "COMPLETED")
    .reduce((sum, r) => sum + r.amountTzs, 0);

  const pendingEarnings = user.referralRewards
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + r.amountTzs, 0);

  return NextResponse.json({
    referralCode: code,
    totalReferred: user.referrals.length,
    totalEarned,
    pendingEarnings,
    referrals: user.referrals.map((r) => ({
      username: r.username,
      joinedAt: r.createdAt,
    })),
    rewards: user.referralRewards,
  });
}
