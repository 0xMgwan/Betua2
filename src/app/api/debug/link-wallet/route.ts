import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

/**
 * Manually link a user to an existing nTZS wallet by UUID
 * Use this to fix wallet linkage issues
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ntzsUserId } = await req.json();

    if (!ntzsUserId) {
      return NextResponse.json({ error: "Missing ntzsUserId" }, { status: 400 });
    }

    // Verify the nTZS user exists and get wallet info
    const ntzsUser = await ntzs.users.get(ntzsUserId);

    console.log("Linking user to nTZS wallet:", {
      userId: session.userId,
      ntzsUserId: ntzsUser.id,
      walletAddress: ntzsUser.walletAddress,
      balanceTzs: ntzsUser.balanceTzs,
    });

    // Update user record
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        ntzsUserId: ntzsUser.id,
        walletAddress: ntzsUser.walletAddress,
      },
    });

    return NextResponse.json({
      success: true,
      ntzsUser: {
        id: ntzsUser.id,
        walletAddress: ntzsUser.walletAddress,
        balanceTzs: ntzsUser.balanceTzs,
      },
    });
  } catch (err: any) {
    console.error("Link wallet error:", err);
    return NextResponse.json({
      error: err.message || "Failed to link wallet",
      details: err.body || err,
    }, { status: 500 });
  }
}
