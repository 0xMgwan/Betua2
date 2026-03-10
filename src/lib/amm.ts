// Constant Product Market Maker (CPMM) for prediction markets
// k = yesPool * noPool (invariant)

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

// ── Multi-option AMM ────────────────────────────────────────────────────
// For N-option markets, each option has a pool. Price of option i = (totalPools - pool_i) / ((N-1) * totalPools)
// Simplified: we use pairwise CPMM — buying option i is like buying against the sum of all other pools.

export function getMultiOptionPrices(pools: number[]): number[] {
  const total = pools.reduce((s, p) => s + p, 0);
  // Price of option i is proportional to 1/pool_i (lower pool = higher price)
  // Normalized: price_i = (total - pool_i) / ((pools.length - 1) * total)
  // Simpler approach: price_i = (1/pool_i) / sum(1/pool_j)
  const inverses = pools.map(p => 1 / p);
  const sumInverses = inverses.reduce((s, v) => s + v, 0);
  return inverses.map(inv => inv / sumInverses);
}

export function getMultiOptionSharesOut(
  amountIn: number,
  optionIndex: number,
  pools: number[]
): { shares: number; newPools: number[]; avgPrice: number } {
  // Buying option i: money goes into all OTHER pools, shares come from pool i
  const otherPoolsTotal = pools.reduce((s, p, idx) => idx !== optionIndex ? s + p : s, 0);
  const targetPool = pools[optionIndex];
  
  // Use CPMM: k = targetPool * otherPoolsTotal
  const k = targetPool * otherPoolsTotal;
  const newOtherTotal = otherPoolsTotal + amountIn;
  const newTargetPool = k / newOtherTotal;
  const shares = targetPool - newTargetPool;
  const avgPrice = amountIn / shares;

  // Distribute the amountIn proportionally across other pools
  const newPools = pools.map((p, idx) => {
    if (idx === optionIndex) return Math.round(newTargetPool);
    const proportion = p / otherPoolsTotal;
    return Math.round(p + amountIn * proportion);
  });

  return { shares, newPools, avgPrice };
}
