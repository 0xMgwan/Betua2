import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "partner-secret");

// Line-item earnings ledger for the authenticated partner (most recent first).
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("partner_token")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const partnerId = payload.partnerId as string;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const [entries, total] = await Promise.all([
      prisma.partnerEarning.findMany({
        where: { partnerId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: { id: true, type: true, amountTzs: true, marketId: true, description: true, createdAt: true },
      }),
      prisma.partnerEarning.count({ where: { partnerId } }),
    ]);

    return NextResponse.json({ entries, pagination: { total, limit, offset, hasMore: offset + limit < total } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch earnings" }, { status: 500 });
  }
}
