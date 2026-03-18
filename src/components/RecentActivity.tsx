"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  type: "TRADE" | "RESOLUTION";
  timestamp: string;
  user: { username: string; avatarUrl: string | null };
  market: { id: string; title: string };
  details: {
    side?: string;
    shares?: number;
    amountTzs?: number;
    outcome?: string;
  };
}

interface RecentActivityProps {
  marketId?: string;
  limit?: number;
  compact?: boolean;
  className?: string;
}

function formatTimeAgo(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (locale === "sw") {
    if (diffSec < 60) return "sasa hivi";
    if (diffMin < 60) return `dakika ${diffMin} zilizopita`;
    if (diffHr < 24) return `saa ${diffHr} zilizopita`;
    return `siku ${diffDay} zilizopita`;
  }

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function formatTZS(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

export function RecentActivity({
  marketId,
  limit = 10,
  compact = false,
  className,
}: RecentActivityProps) {
  const { locale } = useLanguage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const params = new URLSearchParams();
        if (marketId) params.set("marketId", marketId);
        params.set("limit", String(limit));

        const res = await fetch(`/api/activity?${params}`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (err) {
        console.error("Failed to fetch activity:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [marketId, limit]);

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-[var(--card-border)]/20 animate-pulse rounded"
          />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-6 text-[var(--muted)] text-sm font-mono", className)}>
        {locale === "sw" ? "Hakuna shughuli bado" : "No activity yet"}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <AnimatePresence mode="popLayout">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: index * 0.03 }}
          >
            <ActivityItem activity={activity} compact={compact} locale={locale} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ActivityItem({
  activity,
  compact,
  locale,
}: {
  activity: Activity;
  compact: boolean;
  locale: string;
}) {
  const isTrade = activity.type === "TRADE";
  const isBuy = isTrade && !activity.details.side?.startsWith("SELL");
  const side = activity.details.side || "";

  // Determine colors based on side
  const sideColors: Record<string, string> = {
    YES: "text-[#00e5a0] border-[#00e5a0]/30",
    NO: "text-red-400 border-red-500/30",
  };
  const sideColor = sideColors[side] || "text-[#00b4d8] border-[#00b4d8]/30";

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-[var(--card-border)]/10 transition-colors text-xs font-mono">
        {isTrade ? (
          <>
            <span className="text-[var(--muted)]">@{activity.user.username}</span>
            <span className={cn("font-bold", isBuy ? "text-[var(--accent)]" : "text-red-400")}>
              {isBuy ? (locale === "sw" ? "alinunua" : "bought") : (locale === "sw" ? "aliuza" : "sold")}
            </span>
            <span className={cn("px-1 py-0.5 border text-[9px]", sideColor)}>
              {side}
            </span>
          </>
        ) : (
          <>
            <CheckCircle size={12} weight="fill" className="text-[var(--accent)]" />
            <span className="text-[var(--muted)] truncate max-w-[120px]">
              {activity.market.title}
            </span>
            <span className="text-[var(--accent)] font-bold">→ {activity.details.outcome}</span>
          </>
        )}
        <span className="text-[var(--muted)]/60 ml-auto text-[10px]">
          {formatTimeAgo(new Date(activity.timestamp), locale)}
        </span>
      </div>
    );
  }

  return (
    <Link href={`/markets/${activity.market.id}`}>
      <div className="py-2 px-3 hover:bg-[var(--background)] border-b border-[var(--card-border)]/50 transition-colors font-mono">
        {/* Top row: user action + amount */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[10px] text-[var(--muted)]">&gt;</span>
            <span className="text-[11px] text-[var(--foreground)] font-medium truncate">
              @{activity.user.username}
            </span>
            <span className={cn("text-[11px] font-bold", isBuy ? "text-[var(--accent)]" : "text-red-400")}>
              {isTrade 
                ? (isBuy ? (locale === "sw" ? "alinunua" : "bought") : (locale === "sw" ? "aliuza" : "sold"))
                : (locale === "sw" ? "alitatua" : "resolved")
              }
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isTrade && activity.details.amountTzs && (
              <span className={cn("text-[11px] font-bold", isBuy ? "text-[var(--accent)]" : "text-red-400")}>
                {isBuy ? "+" : "-"}{formatTZS(activity.details.amountTzs)}
              </span>
            )}
            <span className="text-[9px] text-[var(--muted)]">
              {formatTimeAgo(new Date(activity.timestamp), locale)}
            </span>
          </div>
        </div>

        {/* Bottom row: side pill + market title */}
        <div className="flex items-center gap-2">
          {isTrade ? (
            <span className={cn(
              "px-1.5 py-0.5 border text-[9px] font-bold shrink-0",
              sideColor
            )}>
              {side}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 border border-purple-500/30 text-purple-400 text-[9px] font-bold shrink-0">
              {activity.details.outcome}
            </span>
          )}
          <span className="text-[10px] text-[var(--muted)] truncate">
            {activity.market.title}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Compact header component for the activity feed
export function ActivityFeedHeader({ className }: { className?: string }) {
  const { locale } = useLanguage();

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-[var(--card-border)] bg-[var(--background)]", className)}>
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-red-500/70" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
        <div className="w-2 h-2 rounded-full bg-[var(--accent)]/70" />
      </div>
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
        {locale === "sw" ? "SHUGHULI.log" : "ACTIVITY.log"}
      </span>
      <span className="w-1.5 h-1.5 bg-[var(--accent)] animate-pulse ml-auto" />
    </div>
  );
}
