/**
 * Deposits are switched off while the platform is under regulatory sandbox
 * review. This only disables the UI entry points — the deposit API routes are
 * untouched, so anything already in flight still settles.
 *
 * Default is OFF. To turn deposits back on, set NEXT_PUBLIC_DEPOSITS_ENABLED
 * to "true" in the Vercel environment and redeploy — no code change needed.
 */
export const DEPOSITS_ENABLED = process.env.NEXT_PUBLIC_DEPOSITS_ENABLED === "true";

/** Shown wherever a deposit control is disabled. */
export function depositsDisabledLabel(locale: string) {
  return locale === "sw"
    ? "Kuweka pesa kumesimamishwa kwa muda wakati wa mapitio ya udhibiti."
    : "Deposits are paused during regulatory review.";
}

/**
 * New trades (buying) are switched off for the same reason — UI entry points
 * only. The trade API routes are untouched by this flag, but reject directly
 * too (see /api/trades and /api/v1/trades) so it can't be bypassed by calling
 * the API instead of clicking through the disabled UI.
 *
 * Default is OFF. Set NEXT_PUBLIC_TRADING_ENABLED to "true" in the Vercel
 * environment and redeploy to turn buying back on — no code change needed.
 */
export const TRADING_ENABLED = process.env.NEXT_PUBLIC_TRADING_ENABLED === "true";

/** Shown wherever a buy control is disabled. */
export function tradingDisabledLabel(locale: string) {
  return locale === "sw"
    ? "Ununuzi mpya umesimamishwa kwa muda wakati wa mapitio ya udhibiti."
    : "New trades are paused during regulatory review.";
}

/**
 * Selling open positions and redeeming resolved ones are switched off for the
 * same reason. Note this is a bigger freeze than the deposit/trading pauses —
 * it locks up funds users have already won, not just new activity — so it's
 * kept as its own flag rather than folded into TRADING_ENABLED.
 *
 * Default is OFF. Set NEXT_PUBLIC_SELLING_ENABLED to "true" in the Vercel
 * environment and redeploy to turn selling/redeeming back on.
 */
export const SELLING_ENABLED = process.env.NEXT_PUBLIC_SELLING_ENABLED === "true";

/** Shown wherever a sell/redeem control is disabled. */
export function sellingDisabledLabel(locale: string) {
  return locale === "sw"
    ? "Kuuza na kukomboa kumesimamishwa kwa muda wakati wa mapitio ya udhibiti."
    : "Selling and redeeming are paused during regulatory review.";
}
