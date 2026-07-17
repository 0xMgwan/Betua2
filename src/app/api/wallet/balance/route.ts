import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHouseOnchainBalance } from "@/lib/houseWallets";

// Returns the user's DB balance — the single source of truth in the pooled
// model. For the platform's own house/pool wallet, returns the real on-chain
// nTZS balance instead (so topping the pool up reflects immediately, and the
// balance isn't the inflated DB accounting figure).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balanceTzs: true, balanceUsdc: true, balanceKes: true, walletAddress: true, ntzsUserId: true },
  });

  let balanceTzs = Math.max(0, user?.balanceTzs || 0);
  let balanceUsdc = Math.max(0, user?.balanceUsdc || 0);
  const onchain = await getHouseOnchainBalance(user?.ntzsUserId);
  if (onchain) {
    balanceTzs = onchain.balanceTzs;
    balanceUsdc = onchain.balanceUsdc;
  }

  return NextResponse.json({
    balanceTzs,
    balanceUsdc,
    balanceKes: Math.max(0, user?.balanceKes || 0),
    walletAddress: user?.walletAddress ?? null,
  });
}
