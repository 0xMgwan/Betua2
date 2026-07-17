import { ntzs } from "@/lib/ntzs";

// The platform's own on-chain wallets (settlement pool + fee wallets). These are
// NOT regular users — their "balance" is the real on-chain nTZS held by the
// wallet (the pool), not the DB accounting balance (which, for the pool account,
// inflates because deposits credit it but payouts never debit it).
export const HOUSE_WALLET_IDS = new Set(
  [
    process.env.PLATFORM_NTZS_USER_ID,
    process.env.SETTLEMENT_FEE_NTZS_USER_ID,
    process.env.CREATION_FEE_NTZS_USER_ID,
  ].filter(Boolean) as string[]
);

export function isHouseWallet(ntzsUserId: string | null | undefined): boolean {
  return !!ntzsUserId && HOUSE_WALLET_IDS.has(ntzsUserId);
}

// Live on-chain nTZS balance for a house wallet, or null if it isn't one / the
// nTZS API is unavailable. Used so a pool/fee account shows its real on-chain
// balance (topping it up reflects immediately) instead of the DB figure.
export async function getHouseOnchainBalance(
  ntzsUserId: string | null | undefined
): Promise<{ balanceTzs: number; balanceUsdc: number } | null> {
  if (!isHouseWallet(ntzsUserId)) return null;
  try {
    const bal = await ntzs.users.getBalance(ntzsUserId!);
    return {
      balanceTzs: Math.max(0, bal.balanceTzs || 0),
      balanceUsdc: Math.max(0, bal.balanceUsdc || 0),
    };
  } catch {
    return null;
  }
}
