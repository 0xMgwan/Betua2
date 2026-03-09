import { NextResponse } from "next/server";
import { ntzs } from "@/lib/ntzs";

/**
 * Try to find the nTZS user ID for the operator wallet
 * by checking all known user IDs
 */
export async function GET() {
  const operatorWallet = "0x2FbC75970Ed94848D75544aBc7C54e4edd8e20c5";
  
  try {
    // Check all configured wallet IDs
    const walletsToCheck = [
      { name: "Platform", id: process.env.PLATFORM_NTZS_USER_ID },
      { name: "Creation Fee", id: process.env.CREATION_FEE_NTZS_USER_ID },
      { name: "Settlement Fee", id: process.env.SETTLEMENT_FEE_NTZS_USER_ID },
      { name: "User", id: "8a7e0b3b-83d3-4080-978c-3016b25ad6b0" },
    ];

    const results = [];
    
    for (const wallet of walletsToCheck) {
      if (!wallet.id) continue;
      
      try {
        const user = await ntzs.users.get(wallet.id);
        results.push({
          name: wallet.name,
          id: user.id,
          walletAddress: user.walletAddress,
          balanceTzs: user.balanceTzs,
          isOperator: user.walletAddress.toLowerCase() === operatorWallet.toLowerCase(),
        });
      } catch (err) {
        console.error(`Failed to get ${wallet.name}:`, err);
      }
    }

    const operatorMatch = results.find(r => r.isOperator);

    return NextResponse.json({
      operatorWallet,
      results,
      operatorMatch: operatorMatch || null,
      message: operatorMatch 
        ? `Found operator wallet! UUID: ${operatorMatch.id}`
        : "Operator wallet not found in configured wallets. You may need to contact nTZS support to find its UUID.",
    });
  } catch (err: any) {
    console.error("Find operator wallet error:", err);
    return NextResponse.json({
      error: err.message || "Failed to find operator wallet",
      details: err.body || err,
    }, { status: 500 });
  }
}
