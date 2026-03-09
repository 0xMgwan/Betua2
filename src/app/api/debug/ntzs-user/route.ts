import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.ntzsUserId) {
      return NextResponse.json({ error: "No nTZS user ID" }, { status: 404 });
    }

    // Get nTZS user info
    const ntzsUser = await ntzs.users.get(user.ntzsUserId);

    return NextResponse.json({
      database: {
        ntzsUserId: user.ntzsUserId,
        walletAddress: user.walletAddress,
      },
      ntzsApi: {
        id: ntzsUser.id,
        walletAddress: ntzsUser.walletAddress,
        balanceTzs: ntzsUser.balanceTzs,
        externalId: ntzsUser.externalId,
      },
      match: {
        walletMatches: user.walletAddress === ntzsUser.walletAddress,
        idMatches: user.ntzsUserId === ntzsUser.id,
      },
    });
  } catch (err) {
    console.error("Debug nTZS user error:", err);
    return NextResponse.json({ 
      error: "Server error",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
