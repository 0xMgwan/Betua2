import { NextResponse } from "next/server";
import { ntzs } from "@/lib/ntzs";

/**
 * Verify what wallet address nTZS returns for a given UUID
 */
export async function GET() {
  try {
    const testUuid = "8a7e0b3b-83d3-4080-978c-3016b25ad6b0";
    
    console.log(`Verifying nTZS UUID: ${testUuid}`);
    
    const ntzsUser = await ntzs.users.get(testUuid);
    
    console.log("nTZS API returned:", JSON.stringify(ntzsUser, null, 2));
    
    return NextResponse.json({
      uuid: testUuid,
      walletAddress: ntzsUser.walletAddress,
      balanceTzs: ntzsUser.balanceTzs,
      externalId: ntzsUser.externalId,
      fullResponse: ntzsUser,
    });
  } catch (err: any) {
    console.error("Verify UUID error:", err);
    return NextResponse.json({
      error: err.message || "Failed to verify UUID",
      details: err.body || err,
    }, { status: 500 });
  }
}
