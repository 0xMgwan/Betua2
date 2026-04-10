"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayCurrency = 'TZS' | 'USDC' | 'KES';

// Exchange rates
const TZS_TO_USDC_RATE = 1 / 2630;
const USDC_TO_TZS_RATE = 2630;
const TZS_TO_KES_RATE = 1 / 18.5; // ~18.5 TZS = 1 KES
const KES_TO_TZS_RATE = 18.5;

interface CurrencyStore {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  toggleCurrency: () => void;
  toDisplay: (tzs: number) => number;
  fromDisplay: (amount: number) => number;
  format: (tzs: number) => string;
  formatRaw: (amount: number) => string;
}

export const useCurrency = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: 'TZS',
      setCurrency: (currency) => set({ currency }),
      toggleCurrency: () => set((state) => ({ 
        currency: state.currency === 'TZS' ? 'USDC' : state.currency === 'USDC' ? 'KES' : 'TZS'
      })),
      toDisplay: (tzs: number) => {
        const { currency } = get();
        if (currency === 'USDC') return tzs * TZS_TO_USDC_RATE;
        if (currency === 'KES') return tzs * TZS_TO_KES_RATE;
        return tzs;
      },
      fromDisplay: (amount: number) => {
        const { currency } = get();
        if (currency === 'USDC') return Math.round(amount * USDC_TO_TZS_RATE);
        if (currency === 'KES') return Math.round(amount * KES_TO_TZS_RATE);
        return Math.round(amount);
      },
      format: (tzs: number) => {
        const { currency } = get();
        if (currency === 'USDC') return `$${(tzs * TZS_TO_USDC_RATE).toFixed(2)}`;
        if (currency === 'KES') return `KES ${Math.round(tzs * TZS_TO_KES_RATE).toLocaleString()}`;
        return `TSh ${tzs.toLocaleString()}`;
      },
      formatRaw: (amount: number) => {
        const { currency } = get();
        if (currency === 'USDC') return `$${amount.toFixed(2)}`;
        if (currency === 'KES') return `KES ${Math.round(amount).toLocaleString()}`;
        return `TSh ${Math.round(amount).toLocaleString()}`;
      },
    }),
    { name: 'guap-currency' }
  )
);

export function useExchangeRate() {
  return {
    tzsToUsdc: TZS_TO_USDC_RATE,
    usdcToTzs: USDC_TO_TZS_RATE,
    tzsToKes: TZS_TO_KES_RATE,
    kesToTzs: KES_TO_TZS_RATE,
    rateDisplay: `1 USDC = ${USDC_TO_TZS_RATE.toLocaleString()} TZS`,
  };
}
