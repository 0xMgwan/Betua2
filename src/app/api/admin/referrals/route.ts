import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REFERRAL_REWARD_TZS } from "@/lib/referral";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// Admin view of the referral programme: who referred whom, whether the referred
// user deposited (and how much), what's been paid, and what is still owed.
export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [referredUsers, rewards] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: { not: null } },
      select: { id: true, username: true, referredById: true, createdAt: true },
    }),
    prisma.referralReward.findMany({
      select: { referrerId: true, referredId: true, amountTzs: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const referredIds = referredUsers.map((u) => u.id);

  // Completed deposits per referred user (count + total amount)
  const depositRows = referredIds.length
    ? await prisma.transaction.groupBy({
        by: ["userId"],
        where: { userId: { in: referredIds }, type: "DEPOSIT", status: "COMPLETED" },
        _sum: { amountTzs: true },
        _count: true,
      })
    : [];
  const depositByUser = new Map(depositRows.map((d) => [d.userId, { amount: d._sum.amountTzs || 0, count: d._count }]));

  // Reward status per referred user
  const rewardByReferred = new Map(rewards.map((r) => [r.referredId, r]));

  // Usernames for referrers
  const referrerIds = [...new Set(referredUsers.map((u) => u.referredById!).filter(Boolean))];
  const referrers = await prisma.user.findMany({ where: { id: { in: referrerIds } }, select: { id: true, username: true } });
  const referrerName = new Map(referrers.map((u) => [u.id, u.username]));

  // Per-referred-user rows
  const rows = referredUsers.map((u) => {
    const dep = depositByUser.get(u.id);
    const reward = rewardByReferred.get(u.id);
    return {
      referrer: referrerName.get(u.referredById!) || "—",
      referred: u.username,
      deposited: !!dep,
      depositedTzs: dep?.amount || 0,
      rewardStatus: reward?.status || (dep ? "PENDING" : null), // owed once deposited
      rewardTzs: reward?.amountTzs ?? (dep ? REFERRAL_REWARD_TZS : 0),
      joinedAt: u.createdAt,
    };
  }).sort((a, b) => Number(b.deposited) - Number(a.deposited) || b.depositedTzs - a.depositedTzs);

  // Summary
  const depositedCount = rows.filter((r) => r.deposited).length;
  let paidTzs = 0, owedTzs = 0;
  for (const r of rows) {
    if (r.rewardStatus === "COMPLETED") paidTzs += r.rewardTzs;
    else if (r.rewardStatus === "PENDING" || r.rewardStatus === "FAILED") owedTzs += r.rewardTzs;
  }

  // Per-referrer totals
  const byReferrer = new Map<string, { referrals: number; deposited: number; paid: number; owed: number }>();
  for (const r of rows) {
    const e = byReferrer.get(r.referrer) || { referrals: 0, deposited: 0, paid: 0, owed: 0 };
    e.referrals++;
    if (r.deposited) e.deposited++;
    if (r.rewardStatus === "COMPLETED") e.paid += r.rewardTzs;
    else if (r.rewardStatus === "PENDING" || r.rewardStatus === "FAILED") e.owed += r.rewardTzs;
    byReferrer.set(r.referrer, e);
  }
  const topReferrers = [...byReferrer.entries()]
    .map(([username, v]) => ({ username, ...v }))
    .sort((a, b) => (b.paid + b.owed) - (a.paid + a.owed))
    .slice(0, 25);

  return NextResponse.json({
    rewardTzs: REFERRAL_REWARD_TZS,
    summary: {
      referredUsers: referredUsers.length,
      depositedCount,
      paidTzs,
      owedTzs,
    },
    topReferrers,
    referredUsers: rows.slice(0, 100),
  });
}
