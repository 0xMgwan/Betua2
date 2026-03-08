import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.ntzsUserId) {
    return NextResponse.json({ balanceTzs: 0, walletAddress: null });
  }

  try {
    const { balanceTzs } = await ntzs.users.getBalance(user.ntzsUserId);
    return NextResponse.json({ balanceTzs, walletAddress: user.walletAddress });
  } catch {
    return NextResponse.json({ balanceTzs: 0, walletAddress: user.walletAddress });
  }
}
