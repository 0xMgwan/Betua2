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
