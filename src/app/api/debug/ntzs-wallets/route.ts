/**
 * TEMPORARY DEBUG ENDPOINT — remove after fixing env vars
 * GET /api/debug/ntzs-wallets
 *
 * Resolves nTZS External IDs → Internal UUIDs.
 * The nTZS portal only shows External IDs (CUIDs), but the transfer API
 * needs Internal IDs (UUIDs). This endpoint resolves each configured wallet.
 */
import { NextResponse } from "next/server";
import { ntzs } from "@/lib/ntzs";

// These are the External IDs (from the nTZS portal)
const WALLET_EXTERNAL_IDS: Record<string, string> = {
  PLATFORM_NTZS_USER_ID: process.env.PLATFORM_NTZS_USER_ID || "",
  CREATION_FEE_NTZS_USER_ID: process.env.CREATION_FEE_NTZS_USER_ID || "",
  SETTLEMENT_FEE_NTZS_USER_ID: process.env.SETTLEMENT_FEE_NTZS_USER_ID || "",
};

// Placeholder emails — only used if wallet doesn't exist yet; idempotent if it does
const WALLET_EMAILS: Record<string, string> = {
  PLATFORM_NTZS_USER_ID: "platform@betua.app",
  CREATION_FEE_NTZS_USER_ID: "creation-fee@betua.app",
  SETTLEMENT_FEE_NTZS_USER_ID: "settlement-fee@betua.app",
};

export async function GET() {
  const results: Record<string, unknown> = {};

  for (const [key, externalId] of Object.entries(WALLET_EXTERNAL_IDS)) {
    if (!externalId) {
      results[key] = { configured: false };
      continue;
    }

    // First try: GET /users/:externalId directly (some nTZS endpoints accept external IDs)
    try {
      const user = await ntzs.users.get(externalId);
      results[key] = {
        method: "GET by provided ID",
        externalId_provided: externalId,
        ntzs_internal_id: user.id,
        ntzs_externalId: user.externalId,
        walletAddress: user.walletAddress,
        balanceTzs: user.balanceTzs,
        // If internal ID differs from what's in env, env needs updating
        env_needs_update: user.id !== externalId,
        correct_env_value: user.id,
      };
      continue;
    } catch {
      // GET by external ID didn't work — try idempotent create to resolve
    }

    // Second try: use idempotent users.create with the external ID
    // nTZS docs: "Same externalId returns existing user"
    try {
      const user = await ntzs.users.create({
        externalId,
        email: WALLET_EMAILS[key],
      });
      results[key] = {
        method: "resolved via users.create (idempotent)",
        externalId_provided: externalId,
        ntzs_internal_id: user.id,
        ntzs_externalId: user.externalId,
        walletAddress: user.walletAddress,
        balanceTzs: user.balanceTzs,
        env_needs_update: user.id !== externalId,
        correct_env_value: user.id,
      };
    } catch (err) {
      results[key] = {
        method: "both lookups failed",
        externalId_provided: externalId,
        error: err instanceof Error ? err.message : "lookup failed",
        suggestion: "Contact nTZS support to get the internal UUID for this wallet",
      };
    }
  }

  // Show current user's nTZS ID format for comparison
  const note = {
    info: "Regular user ntzsUserId format (UUID from nTZS API) stored in your DB",
    example_user_ntzs_id_format: "8a7e0b3b-83d3-4080-978c-3016b25ad6b0 (UUID)",
    platform_ids_in_env_format: "cmmhrr1680000du3pt3abt7ow (CUID - likely External ID, not Internal ID)",
  };

  return NextResponse.json({ note, wallets: results });
}
