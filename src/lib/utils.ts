import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTZS(amount: number): string {
  return new Intl.NumberFormat("sw-TZ", {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function timeUntil(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export const CATEGORIES = [
  "Politics",
  "Sports",
  "Business",
  "Entertainment",
  "Technology",
  "Science",
  "Crypto",
  "Weather",
  "Other",
];

export const SPORTS_SUBCATEGORIES = [
  { value: "EPL", label: "Premier League", icon: "⚽" },
  { value: "La Liga", label: "La Liga", icon: "⚽" },
  { value: "Serie A", label: "Serie A", icon: "⚽" },
  { value: "UCL", label: "Champions League", icon: "🏆" },
  { value: "NBC PL", label: "NBC PL", icon: "⚽" },
  { value: "Other Sports", label: "Other", icon: "🏅" },
];
