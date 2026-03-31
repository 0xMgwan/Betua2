/**
 * Currency Conversion Helper
 * Handles KES <-> TZS conversion for unified markets
 * 
 * Live rate: 1 KES ≈ 18.5 TZS
 */

// Exchange rate: 1 KES = X TZS
const KES_TO_TZS_RATE = 18.5;

export type Currency = 'TZS' | 'KES';

/**
 * Convert amount between currencies
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  
  if (from === 'KES' && to === 'TZS') {
    // KES to TZS: multiply by rate
    return Math.round(amount * KES_TO_TZS_RATE);
  } else {
    // TZS to KES: divide by rate
    return Math.round(amount / KES_TO_TZS_RATE);
  }
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
 * Get user's currency based on country
 */
export function getUserCurrency(country?: string | null): Currency {
  return country === 'KE' ? 'KES' : 'TZS';
}

/**
 * Format amount in the appropriate currency
 */
export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'KES') {
    return `${(amount / 100).toLocaleString()} KES`;
  } else {
    return `${amount.toLocaleString()} TZS`;
  }
}

/**
 * Get current exchange rate info
 */
export function getExchangeRate() {
  return {
    rate: KES_TO_TZS_RATE,
    description: `1 KES = ${KES_TO_TZS_RATE} TZS`,
  };
}
