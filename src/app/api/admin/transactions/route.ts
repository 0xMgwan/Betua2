import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// Admin view of deposits & withdrawals, each mapped to the GUAP user who made
// it — so an nTZS-dashboard row (matched by nTZS ID or payer phone) can be tied
// to a username. ?kind=deposit|withdrawal, ?q=username/phone/nTZS-id, ?limit=.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") === "withdrawal" ? "WITHDRAWAL" : "DEPOSIT";
  const q = (sp.get("q") || "").trim();
  const limit = Math.min(parseInt(sp.get("limit") || "100"), 500);

  // Optional search by username/email/phone → user ids, or by nTZS id/reference.
  let userIdFilter: string[] | undefined;
  if (q) {
    const matchedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    userIdFilter = matchedUsers.map((u) => u.id);
  }

  const where: Record<string, unknown> = { type: kind };
  if (q) {
    where.OR = [
      ...(userIdFilter && userIdFilter.length ? [{ userId: { in: userIdFilter } }] : []),
      { phone: { contains: q } },
      { ntzsDepositId: { contains: q } },
      { ntzsWithdrawId: { contains: q } },
      { externalRef: { contains: q } },
    ];
  }

  const [rows, sumAgg] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, userId: true, amountTzs: true, currency: true, status: true,
        phone: true, ntzsDepositId: true, ntzsWithdrawId: true, externalRef: true, createdAt: true,
      },
    }),
    prisma.transaction.aggregate({
      where: { type: kind, status: kind === "DEPOSIT" ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] } },
      _sum: { amountTzs: true }, _count: true,
    }),
  ]);

  // Map userId → username/email in one query
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = rows.map((r) => ({
    id: r.id,
    ntzsId: r.ntzsDepositId || r.ntzsWithdrawId || null,
    reference: r.externalRef || null,
    username: userMap.get(r.userId)?.username || "—",
    email: userMap.get(r.userId)?.email || "",
    amountTzs: r.amountTzs,
    currency: r.currency,
    status: r.status,
    phone: r.phone,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({
    kind,
    items,
    totalCompletedTzs: sumAgg._sum.amountTzs || 0,
    count: sumAgg._count,
  });
}
