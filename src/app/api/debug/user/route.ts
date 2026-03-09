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
      select: {
        id: true,
        username: true,
        email: true,
        ntzsUserId: true,
        walletAddress: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get nTZS user info if available
    let ntzsUserInfo = null;
    if (user.ntzsUserId) {
      try {
        ntzsUserInfo = await ntzs.users.get(user.ntzsUserId);
      } catch (err) {
        console.error("Failed to fetch nTZS user:", err);
      }
    }

    return NextResponse.json({
      database: {
        userId: user.id,
        username: user.username,
        email: user.email,
        ntzsUserId: user.ntzsUserId,
        walletAddress: user.walletAddress,
      },
      ntzs: ntzsUserInfo,
    });
  } catch (err) {
    console.error("Debug user error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
