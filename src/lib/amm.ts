// ── Prediction-Market CPMM (Constant Product Market Maker) ──────────────
//
// Pools represent virtual liquidity. The ratio determines implied probability.
// Price YES = noPool / (yesPool + noPool)   (range 0–1)
// Price NO  = yesPool / (yesPool + noPool)
//
// Shares track proportional ownership. When a market resolves:
//   - totalVolume (all money deposited by all traders, minus platform fees taken at entry)
//     is the pot to be distributed.
//   - Winners split the pot proportionally based on their shares.
//   - payout_i = (shares_i / totalWinningShares) × totalVolume × (1 - settlementFee)
//
// This guarantees solvency: total payouts ≤ total deposits.
// Winners always profit (they get losers' money). Losers get 0.

export function getPrice(yesPool: number, noPool: number): { yes: number; no: number } {
  const total = yesPool + noPool;
  return {
    yes: noPool / total,
    no: yesPool / total,
  };
}

export function getSharesOut(
  amountIn: number,
  poolIn: number,
  poolOut: number
): { shares: number; newPoolIn: number; newPoolOut: number; avgPrice: number } {
  const k = poolIn * poolOut;
  const newPoolIn = poolIn + amountIn;
  const newPoolOut = k / newPoolIn;
  const shares = poolOut - newPoolOut;
  const avgPrice = amountIn / shares;

  return { shares, newPoolIn, newPoolOut, avgPrice };
}

export function getCostForShares(
  sharesWanted: number,
  poolIn: number,
  poolOut: number
): number {
  const k = poolIn * poolOut;
  const newPoolOut = poolOut - sharesWanted;
  if (newPoolOut <= 0) throw new Error("Insufficient liquidity");
  const newPoolIn = k / newPoolOut;
  return newPoolIn - poolIn;
}

export function getPriceImpact(
  amountIn: number,
  poolIn: number,
  poolOut: number
): number {
  const priceBefore = poolIn / (poolIn + poolOut);
  const { newPoolIn, newPoolOut } = getSharesOut(amountIn, poolIn, poolOut);
  const priceAfter = newPoolIn / (newPoolIn + newPoolOut);
  return Math.abs(priceAfter - priceBefore) / priceBefore;
}

// ── Sell (reverse of buy) ─────────────────────────────────────────────
// User returns shares → pool absorbs them → user gets TZS payout

export function getPayoutForShares(
  sharesIn: number,
  poolIn: number,
  poolOut: number
): { payout: number; newPoolIn: number; newPoolOut: number; avgPrice: number } {
  // poolIn = the pool of the side being sold (e.g. yesPool for selling YES)
  // poolOut = the other pool
  // Selling shares increases poolIn (shares go back), decreases poolOut (TZS come out)
  const k = poolIn * poolOut;
  const newPoolIn = poolIn + sharesIn;
  const newPoolOut = k / newPoolIn;
  const payout = poolOut - newPoolOut;
  const avgPrice = payout / sharesIn;

  return { payout, newPoolIn: Math.round(newPoolIn), newPoolOut: Math.round(newPoolOut), avgPrice };
}

export function getMultiOptionPayoutForShares(
  sharesIn: number,
  optionIndex: number,
  pools: number[]
): { payout: number; newPools: number[]; avgPrice: number } {
  const targetPool = pools[optionIndex];
  const otherPoolsTotal = pools.reduce((s, p, idx) => idx !== optionIndex ? s + p : s, 0);

  // Reverse of buy: shares go back into target pool, TZS come out of other pools
  const k = targetPool * otherPoolsTotal;
  const newTargetPool = targetPool + sharesIn;
  const newOtherTotal = k / newTargetPool;
  const payout = otherPoolsTotal - newOtherTotal;
  const avgPrice = payout / sharesIn;

  const newPools = pools.map((p, idx) => {
    if (idx === optionIndex) return Math.round(newTargetPool);
    const proportion = p / otherPoolsTotal;
    return Math.round(p - payout * proportion);
  });

  return { payout: Math.round(payout), newPools, avgPrice };
}

// ── Multi-option AMM ────────────────────────────────────────────────────

export function getMultiOptionPrices(pools: number[]): number[] {
  const inverses = pools.map(p => 1 / p);
  const sumInverses = inverses.reduce((s, v) => s + v, 0);
  return inverses.map(inv => inv / sumInverses);
}

export function getMultiOptionSharesOut(
  amountIn: number,
  optionIndex: number,
  pools: number[]
): { shares: number; newPools: number[]; avgPrice: number } {
  const otherPoolsTotal = pools.reduce((s, p, idx) => idx !== optionIndex ? s + p : s, 0);
  const targetPool = pools[optionIndex];

  const k = targetPool * otherPoolsTotal;
  const newOtherTotal = otherPoolsTotal + amountIn;
  const newTargetPool = k / newOtherTotal;
  const shares = targetPool - newTargetPool;
  const avgPrice = amountIn / shares;

  const newPools = pools.map((p, idx) => {
    if (idx === optionIndex) return Math.round(newTargetPool);
    const proportion = p / otherPoolsTotal;
    return Math.round(p + amountIn * proportion);
  });

  return { shares, newPools, avgPrice };
}
