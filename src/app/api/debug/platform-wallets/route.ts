import { NextResponse } from "next/server";
import { ntzs } from "@/lib/ntzs";

const PLATFORM_NTZS_USER_ID = process.env.PLATFORM_NTZS_USER_ID || "";
const CREATION_FEE_NTZS_USER_ID = process.env.CREATION_FEE_NTZS_USER_ID || "";
const SETTLEMENT_FEE_NTZS_USER_ID = process.env.SETTLEMENT_FEE_NTZS_USER_ID || "";

export async function GET() {
  try {
    const results: any = {
      platform: null,
      creationFee: null,
      settlementFee: null,
    };

    if (PLATFORM_NTZS_USER_ID) {
      try {
        results.platform = await ntzs.users.get(PLATFORM_NTZS_USER_ID);
      } catch (err) {
        results.platform = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (CREATION_FEE_NTZS_USER_ID) {
      try {
        results.creationFee = await ntzs.users.get(CREATION_FEE_NTZS_USER_ID);
      } catch (err) {
        results.creationFee = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (SETTLEMENT_FEE_NTZS_USER_ID) {
      try {
        results.settlementFee = await ntzs.users.get(SETTLEMENT_FEE_NTZS_USER_ID);
      } catch (err) {
        results.settlementFee = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Debug platform wallets error:", err);
    return NextResponse.json({ 
      error: "Server error",
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
