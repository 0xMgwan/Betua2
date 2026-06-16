import { prisma } from "@/lib/prisma";

// Partner markup is charged ON TOP of the platform base fee, and 100% of it
// accrues to the owning partner's earnings balance. It is intentionally kept
// separate from the AMM/pot math so it never affects market solvency.

export interface PartnerMarkup {
  tradingMarkupPercent: number; // 0–20, added on top of trades on the partner's markets
  creationMarkupTzs: number; // 0–100,000, added on top of the market creation fee
}

export async function getPartnerMarkup(partnerId: string | null | undefined): Promise<PartnerMarkup> {
  if (!partnerId) return { tradingMarkupPercent: 0, creationMarkupTzs: 0 };
  const p = await prisma.partner.findUnique({ where: { id: partnerId }, select: { metadata: true } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fees = ((p?.metadata as any)?.fees) || {};
  return {
    tradingMarkupPercent: Math.max(0, Math.min(20, Number(fees.tradingMarkupPercent) || 0)),
    creationMarkupTzs: Math.max(0, Math.min(100000, Math.round(Number(fees.creationMarkupTzs) || 0))),
  };
}
