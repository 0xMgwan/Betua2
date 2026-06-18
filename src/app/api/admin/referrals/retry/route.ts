import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_USER_IDS = [
  "cmmjemfo900046e3pyoegxsni",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
  ...(process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean),
];

// Settle outstanding referral rewards (FAILED/PENDING) under the pooled model:
// credit the referrer's DB balance + record a transaction, then mark COMPLETED.
export async function POST() {
  const session = await getSession();
  if (!session || !ADMIN_USER_IDS.includes(session.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const outstanding = await prisma.referralReward.findMany({
    where: { status: { in: ["FAILED", "PENDING"] } },
    select: { id: true, referrerId: true, referredId: true, amountTzs: true },
  });

  let credited = 0;
  let amountTzs = 0;
  let skipped = 0;

  for (const r of outstanding) {
    try {
      const [referrer, referred] = await Promise.all([
        prisma.user.findUnique({ where: { id: r.referrerId }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: r.referredId }, select: { username: true } }),
      ]);
      if (!referrer) { skipped++; continue; }

      await prisma.$transaction([
        prisma.referralReward.update({ where: { id: r.id }, data: { status: "COMPLETED" } }),
        prisma.user.update({ where: { id: r.referrerId }, data: { balanceTzs: { increment: r.amountTzs } } }),
        prisma.transaction.create({
          data: {
            userId: r.referrerId,
            type: "REFERRAL_REWARD",
            amountTzs: r.amountTzs,
            status: "COMPLETED",
            recipientUsername: referred?.username || "referral",
          },
        }),
      ]);
      credited++;
      amountTzs += r.amountTzs;
    } catch (err) {
      console.error("[Referral retry] failed for reward", r.id, err);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, scanned: outstanding.length, credited, skipped, amountTzs });
}
