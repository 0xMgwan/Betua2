"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
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

function formatTZS(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

export function ActivityTicker({ className }: { className?: string }) {
  const { locale } = useLanguage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch("/api/activity?limit=10");
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
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, []);

  // Rotate through activities
  useEffect(() => {
    if (activities.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activities.length]);

  if (loading || activities.length === 0) {
    return null;
  }

  const activity = activities[currentIndex];
  const isTrade = activity.type === "TRADE";
  const isBuy = isTrade && !activity.details.side?.startsWith("SELL");
  const side = activity.details.side || "";

  return (
    <div className={cn("bg-[var(--card)] border border-[var(--card-border)] overflow-hidden", className)}>
      {/* Terminal header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--card-border)] bg-[var(--background)]">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/70" />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/70" />
        </div>
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--accent)]">
          LIVE
        </span>
        <span className="w-1.5 h-1.5 bg-[var(--accent)] animate-pulse ml-auto" />
      </div>

      {/* Activity content */}
      <Link href={`/markets/${activity.market.id}`}>
        <div className="px-3 py-2 font-mono">
          <AnimatePresence mode="wait">
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[10px] text-[var(--muted)]">&gt;</span>
                <span className="text-[11px] text-[var(--foreground)] font-medium truncate">
                  @{activity.user.username}
                </span>
                {isTrade ? (
                  <>
                    <span className={cn("text-[11px] font-bold shrink-0", isBuy ? "text-[var(--accent)]" : "text-red-400")}>
                      {isBuy ? (locale === "sw" ? "alinunua" : "bought") : (locale === "sw" ? "aliuza" : "sold")}
                    </span>
                    <span className={cn(
                      "px-1 py-0.5 border text-[8px] font-bold shrink-0",
                      side === "YES" ? "border-[#00e5a0]/30 text-[#00e5a0]"
                        : side === "NO" ? "border-red-500/30 text-red-400"
                        : "border-[#00b4d8]/30 text-[#00b4d8]"
                    )}>
                      {side}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-purple-400 font-bold shrink-0">
                    {locale === "sw" ? "alitatua" : "resolved"} → {activity.details.outcome}
                  </span>
                )}
              </div>
              {isTrade && activity.details.amountTzs && (
                <span className={cn("text-[11px] font-bold shrink-0", isBuy ? "text-[var(--accent)]" : "text-red-400")}>
                  {isBuy ? "+" : "-"}{formatTZS(activity.details.amountTzs)}
                </span>
              )}
            </motion.div>
          </AnimatePresence>
          
          {/* Market title */}
          <div className="text-[9px] text-[var(--muted)] truncate mt-0.5 pl-3">
            {activity.market.title}
          </div>
        </div>
      </Link>

      {/* Progress dots */}
      <div className="flex justify-center gap-1 pb-1.5">
        {activities.slice(0, 5).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1 h-1 rounded-full transition-all",
              i === currentIndex % 5 ? "bg-[var(--accent)]" : "bg-[var(--card-border)]"
            )}
          />
        ))}
      </div>
    </div>
  );
}
