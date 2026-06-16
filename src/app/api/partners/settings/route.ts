import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "partner-secret");

// Update partner settings: webhook URL + fee preferences (stored in metadata).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("partner_token")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const partnerId = payload.partnerId as string;

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { metadata: true, webhookSecret: true },
    });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const body = await req.json();
    const { webhookUrl, tradingMarkupPercent, creationMarkupTzs } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    let webhookSecret = partner.webhookSecret;

    if (webhookUrl !== undefined) {
      if (webhookUrl && !/^https?:\/\/.+/.test(webhookUrl)) {
        return NextResponse.json({ error: "webhookUrl must be a valid http(s) URL" }, { status: 400 });
      }
      data.webhookUrl = webhookUrl || null;
      // Generate a signing secret the first time a webhook URL is configured.
      if (webhookUrl && !webhookSecret) {
        webhookSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
        data.webhookSecret = webhookSecret;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (partner.metadata as any) || {};
    const fees = { ...(meta.fees || {}) };

    if (tradingMarkupPercent !== undefined) {
      const f = Number(tradingMarkupPercent);
      if (Number.isNaN(f) || f < 0 || f > 20) {
        return NextResponse.json({ error: "tradingMarkupPercent must be between 0 and 20" }, { status: 400 });
      }
      fees.tradingMarkupPercent = f;
    }
    if (creationMarkupTzs !== undefined) {
      const c = Math.round(Number(creationMarkupTzs));
      if (Number.isNaN(c) || c < 0 || c > 100000) {
        return NextResponse.json({ error: "creationMarkupTzs must be between 0 and 100,000" }, { status: 400 });
      }
      fees.creationMarkupTzs = c;
    }

    data.metadata = { ...meta, fees };

    await prisma.partner.update({ where: { id: partnerId }, data });
    return NextResponse.json({ ok: true, webhookUrl: data.webhookUrl ?? undefined, webhookSecret, fees });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
