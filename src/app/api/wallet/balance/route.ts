import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the user's DB balance — the single source of truth in the pooled
// model. (Previously read the legacy nTZS personal wallet, which diverged from
// the real balance shown on the admin dashboard.)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balanceTzs: true, balanceUsdc: true, balanceKes: true, walletAddress: true },
  });

  return NextResponse.json({
    balanceTzs: Math.max(0, user?.balanceTzs || 0),
    balanceUsdc: Math.max(0, user?.balanceUsdc || 0),
    balanceKes: Math.max(0, user?.balanceKes || 0),
    walletAddress: user?.walletAddress ?? null,
  });
}
