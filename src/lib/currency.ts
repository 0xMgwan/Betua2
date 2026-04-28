/**
 * Multi-Currency Support for GUAP
 * 
 * Supported currencies:
 * - TZS (nTZS) - Tanzanian Shilling (base currency)
 * - KES (nKES) - Kenyan Shilling (future)
 * - USDC - USD Coin on Base
 * - NGN (nNGN) - Nigerian Naira (future)
 * 
 * Architecture:
 * - All markets use TZS as internal base unit
 * - Users can hold balances in multiple currencies
 * - Swaps happen via nTZS API (USDC ↔ nTZS)
 * - Display converts to user's preferred currency
 */

export type Currency = 'TZS' | 'KES' | 'USDC' | 'NGN';

// Exchange rates (TZS as base)
// Updated periodically - in production, fetch from API
const EXCHANGE_RATES: Record<Currency, number> = {
  TZS: 1,
  KES: 0.054,      // 1 TZS = 0.054 KES (1 KES ≈ 18.5 TZS)
  USDC: 0.00038,   // 1 TZS ≈ 0.00038 USDC (1 USDC ≈ 2,630 TZS)
  NGN: 0.60,       // 1 TZS ≈ 0.60 NGN (1 NGN ≈ 1.67 TZS)
};

// Currency metadata
export const CURRENCY_INFO: Record<Currency, {
  symbol: string;
  name: string;
  decimals: number;
  flag: string;
  country: string;
  minDeposit: number;
  minWithdraw: number;
}> = {
  TZS: {
    symbol: 'TZS',
    name: 'Tanzanian Shilling',
    decimals: 0,
    flag: '🇹🇿',
    country: 'TZ',
    minDeposit: 1000,
    minWithdraw: 5000,
  },
  KES: {
    symbol: 'KES',
    name: 'Kenyan Shilling',
    decimals: 0,
    flag: '🇰🇪',
    country: 'KE',
    minDeposit: 100,
    minWithdraw: 500,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    flag: '🇺🇸',
    country: 'US',
    minDeposit: 1,      // $1 minimum
    minWithdraw: 5,     // $5 minimum
  },
  NGN: {
    symbol: 'NGN',
    name: 'Nigerian Naira',
    decimals: 0,
    flag: '🇳🇬',
    country: 'NG',
    minDeposit: 1000,
    minWithdraw: 5000,
  },
};

/**
 * Convert amount between currencies
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  
  // Convert to TZS first, then to target
  const inTzs = amount / EXCHANGE_RATES[from];
  const result = inTzs * EXCHANGE_RATES[to];
  
  // Round based on target currency decimals
  const decimals = CURRENCY_INFO[to].decimals;
  if (decimals === 0) {
    return Math.round(result);
  }
  return Math.round(result * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convert to TZS (base currency for markets)
 */
export function toTZS(amount: number, currency: Currency): number {
  return convertCurrency(amount, currency, 'TZS');
}

/**
 * Convert from TZS to user's currency
 */
export function fromTZS(amount: number, currency: Currency): number {
  return convertCurrency(amount, 'TZS', currency);
}

/**
 * Get user's default currency based on country
 */
export function getUserCurrency(country?: string | null, phone?: string | null): Currency {
  // Tanzania → nTZS
  if (country === 'TZ') return 'TZS';
  // Kenya → KES
  if (country === 'KE') return 'KES';
  // Nigeria → NGN
  if (country === 'NG') return 'NGN';

  // Detect from phone prefix (overrides country if set)
  if (phone) {
    if (phone.startsWith('255') || phone.startsWith('+255')) return 'TZS';
    if (phone.startsWith('254') || phone.startsWith('+254')) return 'KES';
    if (phone.startsWith('234') || phone.startsWith('+234')) return 'NGN';
  }

  // All other countries (international users) → USDC by default
  if (country && country !== '') return 'USDC';

  return 'TZS'; // fallback when country is completely unknown
}

/**
 * Format amount in the appropriate currency
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const info = CURRENCY_INFO[currency];
  
  if (currency === 'USDC') {
    // USDC stored in micro-units (6 decimals)
    const usdcAmount = amount / 1_000_000;
    return `$${usdcAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  return `${amount.toLocaleString()} ${info.symbol}`;
}

/**
 * Format with currency symbol prefix
 */
export function formatWithSymbol(amount: number, currency: Currency): string {
  const info = CURRENCY_INFO[currency];
  
  if (currency === 'USDC') {
    const usdcAmount = amount / 1_000_000;
    return `$${usdcAmount.toFixed(2)}`;
  }
  
  return `${info.flag} ${amount.toLocaleString()} ${info.symbol}`;
}

/**
 * Get balance field name for a currency
 */
export function getBalanceField(currency: Currency): 'balanceTzs' | 'balanceKes' | 'balanceUsdc' {
  switch (currency) {
    case 'KES': return 'balanceKes';
    case 'USDC': return 'balanceUsdc';
    default: return 'balanceTzs';
  }
}

/**
 * Get all user balances formatted
 */
export function getAllBalances(user: {
  balanceTzs: number;
  balanceKes: number;
  balanceUsdc: number;
}): { currency: Currency; amount: number; formatted: string }[] {
  const balances: { currency: Currency; amount: number; formatted: string }[] = [
    { currency: 'TZS' as Currency, amount: user.balanceTzs, formatted: formatCurrency(user.balanceTzs, 'TZS') },
    { currency: 'KES' as Currency, amount: user.balanceKes, formatted: formatCurrency(user.balanceKes, 'KES') },
    { currency: 'USDC' as Currency, amount: user.balanceUsdc, formatted: formatCurrency(user.balanceUsdc, 'USDC') },
  ];
  return balances.filter(b => b.amount > 0);
}

/**
 * Get total balance in TZS equivalent
 */
export function getTotalBalanceInTzs(user: {
  balanceTzs: number;
  balanceKes: number;
  balanceUsdc: number;
}): number {
  return (
    user.balanceTzs +
    toTZS(user.balanceKes, 'KES') +
    toTZS(user.balanceUsdc / 1_000_000, 'USDC') // USDC stored in micro-units
  );
}

/**
 * Get exchange rate between two currencies
 */
export function getExchangeRate(from: Currency, to: Currency): number {
  if (from === to) return 1;
  return EXCHANGE_RATES[to] / EXCHANGE_RATES[from];
}

/**
 * Get all exchange rates relative to a base currency
 */
export function getAllRates(base: Currency = 'TZS'): Record<Currency, number> {
  const rates: Record<Currency, number> = {} as Record<Currency, number>;
  for (const currency of Object.keys(EXCHANGE_RATES) as Currency[]) {
    rates[currency] = getExchangeRate(base, currency);
  }
  return rates;
}

/**
 * Check if currency is supported
 */
export function isSupportedCurrency(currency: string): currency is Currency {
  return ['TZS', 'KES', 'USDC', 'NGN'].includes(currency);
}

/**
 * Parse amount from user input (handles decimals for USDC)
 */
export function parseAmount(input: string, currency: Currency): number {
  const num = parseFloat(input.replace(/,/g, ''));
  if (isNaN(num)) return 0;
  
  if (currency === 'USDC') {
    // Convert to micro-USDC (6 decimals)
    return Math.round(num * 1_000_000);
  }
  
  return Math.round(num);
}
