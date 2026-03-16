"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string; // unique ID for cart item
  marketId: string;
  marketTitle: string;
  side: string; // "YES", "NO", or option name
  optionIndex?: number;
  amount: number;
  estimatedShares: number;
  currentPrice: number;
  imageUrl?: string | null;
  category: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateAmount: (id: string, amount: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getTotalAmount: () => number;
  getTotalShares: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const id = `${item.marketId}-${item.side}-${Date.now()}`;
        set((state) => ({
          items: [...state.items, { ...item, id }],
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateAmount: (id, amount) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === id) {
              // Recalculate estimated shares based on new amount and current price
              const estimatedShares = item.currentPrice > 0 
                ? Math.round(amount / (item.currentPrice * 1000))
                : item.estimatedShares;
              return { ...item, amount, estimatedShares };
            }
            return item;
          }),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      openCart: () => {
        set({ isOpen: true });
      },

      closeCart: () => {
        set({ isOpen: false });
      },

      getTotalAmount: () => {
        return get().items.reduce((sum, item) => sum + item.amount, 0);
      },

      getTotalShares: () => {
        return get().items.reduce((sum, item) => sum + item.estimatedShares, 0);
      },
    }),
    {
      name: "betua-cart",
    }
  )
);
