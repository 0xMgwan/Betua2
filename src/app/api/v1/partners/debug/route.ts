import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { hashApiKey } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();
  const hashedKey = hashApiKey(apiKey);
  const partner = await prisma.partner.findUnique({ where: { apiKey: hashedKey } });
  const all = await prisma.partner.findMany({ select: { name: true, apiKey: true, isActive: true, isApproved: true } });
  return NextResponse.json({ hashedKey, found: !!partner, partner, allPartners: all });
}
