import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];
const ADMIN_NTZS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
  "5e89781c-b8c0-4a49-a235-0bb0048ac18d",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ntzsUserId: true },
  });
  const isAdmin = ADMIN_IDS.includes(session.userId) ||
    ADMIN_NTZS.includes(user?.ntzsUserId || "");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [rawUsers, markets, transactions] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, username: true, displayName: true, email: true, phone: true,
        country: true, balanceTzs: true, balanceUsdc: true, balanceKes: true,
        ntzsUserId: true, createdAt: true,
        _count: { select: { trades: { where: { isLpSeed: false } }, marketsCreated: true, positions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.market.findMany({
      select: {
        id: true, title: true, category: true, status: true, totalVolume: true,
        seedAmount: true, createdAt: true, resolvesAt: true, outcome: true,
        creator: { select: { username: true } },
        _count: { select: { trades: { where: { isLpSeed: false } }, positions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.groupBy({
      by: ["type", "status"],
      _sum: { amountTzs: true },
      _count: true,
    }),
  ]);

  // For legacy users with nTZS wallets: use max(DB, nTZS wallet) — same logic as me/
  // Sync any higher nTZS wallet balance back to DB so DB becomes accurate going forward
  const { ntzs } = await import('@/lib/ntzs');
  const users = await Promise.all(rawUsers.map(async (u) => {
    let balanceTzs  = Math.max(0, u.balanceTzs  || 0);
    let balanceUsdc = Math.max(0, u.balanceUsdc  || 0);
    if (u.ntzsUserId && balanceTzs === 0) {
      try {
        const bal = await ntzs.users.getBalance(u.ntzsUserId);
        const liveTzs  = Math.max(0, bal.balanceTzs  || 0);
        const liveUsdc = Math.max(0, bal.balanceUsdc  || 0);
        if (liveTzs > balanceTzs) {
          balanceTzs = liveTzs;
          // Sync to DB silently
          prisma.user.update({ where: { id: u.id }, data: { balanceTzs: liveTzs, balanceUsdc: liveUsdc } }).catch(() => {});
        }
        if (liveUsdc > balanceUsdc) balanceUsdc = liveUsdc;
      } catch { /* skip if API down */ }
    }
    return { ...u, balanceTzs, balanceUsdc };
  }));

  // Total outstanding fixed-odds payout obligations on open markets
  const openPositions = await prisma.position.findMany({
    where: { redeemed: false, market: { status: "OPEN" } },
    select: { yesImpliedPayout: true, noImpliedPayout: true, optionImpliedPayouts: true },
  });
  const totalImpliedLiability = openPositions.reduce((s, p) => {
    const yes = (p as any).yesImpliedPayout || 0;
    const no  = (p as any).noImpliedPayout  || 0;
    const opt = Object.values((p as any).optionImpliedPayouts || {}).reduce((a: number, v) => a + (v as number), 0);
    return s + Math.max(yes, no, opt as number); // worst-case per position
  }, 0);

  // Seed capital still locked in open markets (LP seed positions use parimutuel,
  // so they don't appear in impliedLiability — count seedAmount separately)
  const openSeedLiability = markets
    .filter(m => m.status === "OPEN")
    .reduce((s, m) => s + (m.seedAmount || 0), 0);

  // ── REAL on-chain settlement pool balance (source of truth) ──────────────
  const POOL_ID = process.env.PLATFORM_NTZS_USER_ID || "";
  let poolBalanceTzs = 0;
  let poolBalanceUsdc = 0;
  if (POOL_ID) {
    try {
      const bal = await ntzs.users.getBalance(POOL_ID);
      poolBalanceTzs = Math.max(0, bal.balanceTzs || 0);
      poolBalanceUsdc = Math.max(0, bal.balanceUsdc || 0);
    } catch { /* nTZS API unavailable */ }
  }

  // Platform summary
  const totalBalanceTzs = users.reduce((s, u) => s + (u.balanceTzs || 0), 0);
  const totalVolume = markets.reduce((s, m) => s + m.totalVolume, 0);
  const openMarkets = markets.filter(m => m.status === "OPEN").length;
  const resolvedMarkets = markets.filter(m => m.status === "RESOLVED").length;
  const totalDeposits = transactions
    .filter(t => t.type === "DEPOSIT" && t.status === "COMPLETED")
    .reduce((s, t) => s + (t._sum.amountTzs || 0), 0);
  const totalWithdrawals = transactions
    .filter(t => t.type === "WITHDRAWAL" && t.status === "COMPLETED")
    .reduce((s, t) => s + (t._sum.amountTzs || 0), 0);
  const totalTrades = transactions
    .filter(t => t.type === "BUY_SHARES")
    .reduce((s, t) => s + t._count, 0);

  return NextResponse.json({
    summary: {
      totalUsers: users.length, totalBalanceTzs, totalVolume, openMarkets, resolvedMarkets,
      totalDeposits, totalWithdrawals, totalTrades, totalImpliedLiability, openSeedLiability,
      poolBalanceTzs, poolBalanceUsdc,
    },
    users,
    markets,
    transactions,
  });
}
