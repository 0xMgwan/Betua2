"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayCurrency = 'TZS' | 'USDC';

// Exchange rate: 1 USDC ≈ 2,630 TZS
const TZS_TO_USDC_RATE = 1 / 2630;
const USDC_TO_TZS_RATE = 2630;

interface CurrencyStore {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  toggleCurrency: () => void;
  
  // Conversion helpers
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
        currency: state.currency === 'TZS' ? 'USDC' : 'TZS' 
      })),
      
      // Convert TZS amount to display currency
      toDisplay: (tzs: number) => {
        const { currency } = get();
        if (currency === 'USDC') {
          return tzs * TZS_TO_USDC_RATE;
        }
        return tzs;
      },
      
      // Convert display currency amount back to TZS
      fromDisplay: (amount: number) => {
        const { currency } = get();
        if (currency === 'USDC') {
          return Math.round(amount * USDC_TO_TZS_RATE);
        }
        return Math.round(amount);
      },
      
      // Format TZS amount in display currency
      format: (tzs: number) => {
        const { currency } = get();
        if (currency === 'USDC') {
          const usdc = tzs * TZS_TO_USDC_RATE;
          return `$${usdc.toFixed(2)}`;
        }
        return `TSh ${tzs.toLocaleString()}`;
      },
      
      // Format raw amount (already in display currency)
      formatRaw: (amount: number) => {
        const { currency } = get();
        if (currency === 'USDC') {
          return `$${amount.toFixed(2)}`;
        }
        return `TSh ${Math.round(amount).toLocaleString()}`;
      },
    }),
    {
      name: 'guap-currency',
    }
  )
);

// Hook for getting rate info
export function useExchangeRate() {
  return {
    tzsToUsdc: TZS_TO_USDC_RATE,
    usdcToTzs: USDC_TO_TZS_RATE,
    rateDisplay: `1 USDC = ${USDC_TO_TZS_RATE.toLocaleString()} TZS`,
  };
}
