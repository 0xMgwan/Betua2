import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export type PartnerWebhookEvent =
  | "deposit.completed"
  | "deposit.failed"
  | "withdrawal.completed"
  | "withdrawal.failed"
  | "market.created"
  | "market.resolved";

/**
 * Deliver a single signed webhook to a partner's configured endpoint.
 * No-ops if the partner has no webhookUrl. Best-effort: a single attempt with a
 * 5s timeout; failures are logged, never thrown (must not break the caller).
 *
 * Signature: header `X-GUAP-Signature: sha256=<hmac>` over the raw JSON body,
 * using the partner's webhookSecret (HMAC-SHA256). Partners verify by recomputing.
 */
export async function sendPartnerWebhook(
  partnerId: string,
  event: PartnerWebhookEvent,
  data: AnyObj,
): Promise<void> {
  try {
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { webhookUrl: true, webhookSecret: true, isActive: true },
    });
    if (!partner?.webhookUrl || partner.isActive === false) return;

    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-GUAP-Event": event,
    };
    if (partner.webhookSecret) {
      headers["X-GUAP-Signature"] =
        "sha256=" + crypto.createHmac("sha256", partner.webhookSecret).update(payload).digest("hex");
    }

    await fetch(partner.webhookUrl, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[webhook] delivery to partner ${partnerId} failed:`, err);
  }
}

/**
 * Deliver an event to whichever partner(s) a user belongs to. Includes the
 * partner's own externalId for the user so they can match it to their records.
 */
export async function notifyUserPartners(
  userId: string,
  event: PartnerWebhookEvent,
  data: AnyObj,
): Promise<void> {
  const mappings = await prisma.partnerUser.findMany({
    where: { userId },
    select: { partnerId: true, externalId: true },
  });
  await Promise.all(
    mappings.map((m) => sendPartnerWebhook(m.partnerId, event, { ...data, externalId: m.externalId })),
  );
}
