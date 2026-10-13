/**
 * Settlement model.
 *
 * GUAP has historically settled **fixed odds**: the multiple shown at trade
 * time is stored on the position (`yesImpliedPayout` / `optionImpliedPayouts`)
 * and paid out regardless of how much money the market actually took. That
 * makes the house the counterparty — it is a bookmaker, not an exchange — and
 * with no margin priced in it has lost money overall.
 *
 * **Parimutuel** settles the other way: winners divide the money that was
 * actually staked, less a rake. Payouts are a share of a pot that exists, so
 * total out can never exceed total in. The house cannot lose; it earns the
 * rake on turnover. This is how a totalizator works, and it is the model
 * Polymarket and Kalshi approximate from the other direction — they never take
 * the other side either, they just match counterparties instead of pooling.
 *
 * Switching is deliberately gated:
 *   PAYOUT_MODEL     "fixed" (default) | "parimutuel"
 *   PARIMUTUEL_FROM  optional ISO date — only markets created on or after this
 *                    settle parimutuel, so bets already placed under advertised
 *                    fixed odds are honoured. Omit to apply to every market.
 */

export type PayoutModel = "fixed" | "parimutuel";

export const PAYOUT_MODEL: PayoutModel =
  (process.env.PAYOUT_MODEL || "fixed").toLowerCase() === "parimutuel" ? "parimutuel" : "fixed";

const PARIMUTUEL_FROM = process.env.PARIMUTUEL_FROM
  ? new Date(process.env.PARIMUTUEL_FROM)
  : null;

/**
 * Whether a given market settles parimutuel. Markets created before the
 * cutover keep the fixed odds their bettors were shown.
 */
export function usesParimutuel(marketCreatedAt: Date | string): boolean {
  if (PAYOUT_MODEL !== "parimutuel") return false;
  if (!PARIMUTUEL_FROM || Number.isNaN(PARIMUTUEL_FROM.getTime())) return true;
  return new Date(marketCreatedAt).getTime() >= PARIMUTUEL_FROM.getTime();
}

export interface ParimutuelInput {
  /** Total staked into the market (the handle). */
  totalVolume: number;
  /** This position's shares on the winning outcome. */
  winningShares: number;
  /** Winning shares across all bettors, excluding seeded LP. */
  totalWinningShares: number;
  /** Creator-seeded liquidity, which claims its pro-rata slice before bettors. */
  seedAmount?: number;
  /** Rake, as a fraction (0.05 = 5%). */
  feePercent: number;
}

export interface ParimutuelResult {
  /** Paid to the bettor. */
  payoutTzs: number;
  /** Rake retained by the platform. */
  feeTzs: number;
  /** Pot available to bettors after rake and the LP slice. */
  bettorPot: number;
}

/**
 * Winner's share of the pot.
 *
 *   pot        = handle − rake
 *   bettorPot  = pot − LP's pro-rata slice of the seed
 *   payout     = bettorPot × (yourShares / allWinningShares)
 *
 * The rake is taken exactly once, on the way in. (The previous inline version
 * of this deducted it twice — once from the pot and again from each payout —
 * which quietly charged ~9.75% at a nominal 5%.)
 */
export function parimutuelPayout(i: ParimutuelInput): ParimutuelResult {
  const handle = Math.max(0, i.totalVolume);
  const rake = Math.round(handle * i.feePercent);
  const pot = handle - rake;

  const seed = Math.max(0, i.seedAmount ?? 0);
  const lpClaim = seed > 0 && handle > 0 ? Math.round((seed / handle) * pot) : 0;
  const bettorPot = Math.max(0, pot - lpClaim);

  const share = i.totalWinningShares > 0 ? i.winningShares / i.totalWinningShares : 0;
  const payoutTzs = Math.round(share * bettorPot);

  // This winner's slice of the market-wide rake. Summed across winners these
  // add up to the rake — the platform never books more than it actually took.
  const feeTzs = Math.round(share * rake);

  return { payoutTzs, feeTzs, bettorPot };
}
