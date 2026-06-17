import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// Admin view of all partners: profile, counts, earnings, and their users + balances.
export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      tier: true,
      rateLimit: true,
      isActive: true,
      isApproved: true,
      earningsTzs: true,
      webhookUrl: true,
      createdAt: true,
      _count: { select: { users: true, markets: true, apiLogs: true } },
    },
  });

  // Per-partner: their users (capped) + total user balances.
  const enriched = await Promise.all(
    partners.map(async (p) => {
      const mappings = await prisma.partnerUser.findMany({
        where: { partnerId: p.id },
        select: { externalId: true, userId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const userIds = mappings.map((m) => m.userId);
      const [users, totals] = await Promise.all([
        userIds.length
          ? prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, username: true, email: true, phone: true, balanceTzs: true, balanceUsdc: true },
            })
          : Promise.resolve([]),
        userIds.length
          ? prisma.user.aggregate({ where: { id: { in: userIds } }, _sum: { balanceTzs: true, balanceUsdc: true } })
          : Promise.resolve({ _sum: { balanceTzs: 0, balanceUsdc: 0 } }),
      ]);
      const byId = new Map(users.map((u) => [u.id, u]));

      return {
        ...p,
        totalUserBalanceTzs: totals._sum.balanceTzs || 0,
        totalUserBalanceUsdc: totals._sum.balanceUsdc || 0,
        users: mappings.map((m) => {
          const u = byId.get(m.userId);
          return {
            externalId: m.externalId,
            username: u?.username ?? null,
            email: u?.email ?? null,
            phone: u?.phone ?? null,
            balanceTzs: u?.balanceTzs ?? 0,
            balanceUsdc: u?.balanceUsdc ?? 0,
            joinedAt: m.createdAt,
          };
        }),
      };
    }),
  );

  return NextResponse.json({ partners: enriched });
}
