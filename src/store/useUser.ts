"use client";
import { create } from "zustand";

interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  walletAddress?: string | null;
  ntzsUserId?: string | null;
  country?: string | null;
  balanceTzs: number;
  balanceKes: number;
}

interface UserStore {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  setLoading: (l: boolean) => void;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUser = create<UserStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  fetchUser: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
    window.location.href = "/";
  },
}));
