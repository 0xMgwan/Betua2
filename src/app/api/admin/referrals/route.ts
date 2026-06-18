import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// Admin view of the referral programme: who referred whom, earnings, and what
// is still owed (pending + failed payouts).
export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rewards, referredUsers] = await Promise.all([
    prisma.referralReward.findMany({
      select: { referrerId: true, referredId: true, amountTzs: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // Users who were referred (regardless of whether a reward fired yet)
    prisma.user.findMany({ where: { referredById: { not: null } }, select: { id: true, referredById: true } }),
  ]);

  // Per-referrer aggregation
  const byReferrer = new Map<string, { paid: number; pending: number; failed: number; rewardCount: number }>();
  const sum = { paid: 0, pending: 0, failed: 0 };
  for (const r of rewards) {
    const e = byReferrer.get(r.referrerId) || { paid: 0, pending: 0, failed: 0, rewardCount: 0 };
    e.rewardCount++;
    if (r.status === "COMPLETED") { e.paid += r.amountTzs; sum.paid += r.amountTzs; }
    else if (r.status === "PENDING") { e.pending += r.amountTzs; sum.pending += r.amountTzs; }
    else { e.failed += r.amountTzs; sum.failed += r.amountTzs; }
    byReferrer.set(r.referrerId, e);
  }

  // Referral counts (how many people each user referred)
  const referralCounts = new Map<string, number>();
  for (const u of referredUsers) {
    if (u.referredById) referralCounts.set(u.referredById, (referralCounts.get(u.referredById) || 0) + 1);
  }

  // Resolve usernames for everyone involved
  const ids = new Set<string>();
  rewards.forEach((r) => { ids.add(r.referrerId); ids.add(r.referredId); });
  referralCounts.forEach((_, id) => ids.add(id));
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, username: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.username]));

  // Top referrers (by total earned + owed)
  const topReferrers = [...new Set([...byReferrer.keys(), ...referralCounts.keys()])]
    .map((id) => {
      const agg = byReferrer.get(id) || { paid: 0, pending: 0, failed: 0, rewardCount: 0 };
      return {
        username: nameOf.get(id) || "—",
        referrals: referralCounts.get(id) || 0,
        rewardCount: agg.rewardCount,
        paid: agg.paid,
        owed: agg.pending + agg.failed,
      };
    })
    .sort((a, b) => (b.paid + b.owed) - (a.paid + a.owed))
    .slice(0, 25);

  const recent = rewards.slice(0, 25).map((r) => ({
    referrer: nameOf.get(r.referrerId) || "—",
    referred: nameOf.get(r.referredId) || "—",
    amountTzs: r.amountTzs,
    status: r.status,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({
    percent: 1, // % of the referred user's first deposit
    summary: {
      referredUsers: referredUsers.length,
      rewardCount: rewards.length,
      paidTzs: sum.paid,
      pendingTzs: sum.pending,
      failedTzs: sum.failed,
      owedTzs: sum.pending + sum.failed,
    },
    topReferrers,
    recent,
  });
}
