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
 * New trades are switched off for the same reason — UI entry points only
 * (buy buttons, add-to-cart, quick buy). The trade API route is untouched, and
 * selling/redeeming existing positions is a separate flow and stays open.
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
