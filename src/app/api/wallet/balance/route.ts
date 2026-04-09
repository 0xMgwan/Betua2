import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ntzs } from "@/lib/ntzs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ 
    where: { id: session.userId },
    select: { id: true, ntzsUserId: true, walletAddress: true }
  });
  if (!user?.ntzsUserId) {
    return NextResponse.json({ balanceTzs: 0, balanceUsdc: 0, walletAddress: null });
  }

  try {
    // Fetch nTZS and USDC balances from nTZS API
    const { balanceTzs, balanceUsdc } = await ntzs.users.getBalance(user.ntzsUserId);
    
    return NextResponse.json({ 
      balanceTzs, 
      balanceUsdc, // Float from nTZS API (e.g., 6.50 = $6.50)
      walletAddress: user.walletAddress 
    });
  } catch {
    return NextResponse.json({ 
      balanceTzs: 0, 
      balanceUsdc: 0,
      walletAddress: user.walletAddress 
    });
  }
}
