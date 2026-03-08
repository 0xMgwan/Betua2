import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ntzs } from "@/lib/ntzs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { outcome } = await req.json(); // true = YES wins, false = NO wins

  const market = await prisma.market.findUnique({
    where: { id },
    include: { positions: { include: { user: true } } },
  });

  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (market.creatorId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (market.status !== "OPEN") {
    return NextResponse.json({ error: "Market already resolved" }, { status: 400 });
  }

  // Resolve market
  await prisma.market.update({
    where: { id },
    data: { status: "RESOLVED", outcome: outcome ? 1 : 0, resolvedAt: new Date() },
  });

  // Pay out winners
  const winnerPositions = market.positions.filter((p: typeof market.positions[number]) =>
    outcome ? p.yesShares > 0 : p.noShares > 0
  );

  // Platform wallet acts as escrow — for now we transfer from platform
  // In production, funds are held in escrow and transferred on resolution
  for (const pos of winnerPositions) {
    const winningShares = outcome ? pos.yesShares : pos.noShares;
    const payout = winningShares; // 1 share = 1 TZS on resolution

    if (pos.user.ntzsUserId && winningShares > 0) {
      try {
        // We would transfer from platform escrow wallet to user
        // For now just log — actual transfer requires platform escrow user setup
        console.log(`Payout ${payout} TZS to ${pos.user.username}`);
      } catch (err) {
        console.error("Payout failed for", pos.user.username, err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
