"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { formatTZS, formatNumber } from "@/lib/utils";
import { motion } from "framer-motion";
import { Trophy, Crown, Medal } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";

interface LeaderEntry {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  totalVolume: number;
  totalTrades: number;
  marketsCreated: number;
  rank: number;
}

const RANK_ICONS = [
  <Crown key={1} size={18} className="text-yellow-400" />,
  <Medal key={2} size={18} className="text-gray-300" />,
  <Medal key={3} size={18} className="text-amber-600" />,
];

export default function LeaderboardPage() {
  const { user } = useUser();
  const { t, locale } = useLanguage();
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaders(d.leaderboard || []))
      .finally(() => setLoading(false));
  }, []);

  const userRank = leaders.find((l) => l.id === user?.id);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} className="text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t.leaderboard.title}</h1>
          <p className="text-[var(--muted)]">{t.leaderboard.subtitle}</p>
        </div>

        {/* User rank highlight */}
        {userRank && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-[var(--accent)]">#{userRank.rank}</span>
              <div>
                <p className="font-semibold text-sm">{t.leaderboard.yourRanking}</p>
                <p className="text-xs text-[var(--muted)]">{formatTZS(userRank.totalVolume)} {t.leaderboard.volume}</p>
              </div>
            </div>
            <span className="text-sm text-[var(--muted)]">{userRank.totalTrades} {t.leaderboard.trades}</span>
          </motion.div>
        )}

        {/* Top 3 */}
        {leaders.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[leaders[1], leaders[0], leaders[2]].map((l, visualIdx) => {
              const rank = visualIdx === 1 ? 1 : visualIdx === 0 ? 2 : 3;
              const actualLeader = l;
              if (!actualLeader) return null;
              return (
                <motion.div
                  key={actualLeader.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: visualIdx * 0.1 }}
                  className={cn(
                    "bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 text-center",
                    visualIdx === 1 && "ring-2 ring-yellow-400/40 bg-yellow-400/5"
                  )}
                >
                  <div className="flex justify-center mb-2">
                    {RANK_ICONS[rank - 1]}
                  </div>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-black text-lg mx-auto mb-2",
                      visualIdx === 1 && "w-14 h-14 text-xl"
                    )}
                  >
                    {actualLeader.username[0].toUpperCase()}
                  </div>
                  <p className="font-bold text-sm">{actualLeader.displayName || actualLeader.username}</p>
                  <p className="text-xs text-[var(--muted)] mb-1">@{actualLeader.username}</p>
                  <p className="text-xs font-medium text-[var(--accent)]">
                    {formatTZS(actualLeader.totalVolume)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-14 bg-[var(--card)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 px-4 py-2.5 text-xs font-medium text-[var(--muted)] border-b border-[var(--card-border)]">
              <span>{t.leaderboard.rank}</span>
              <span className="col-span-2">{t.leaderboard.trader}</span>
              <span className="text-right">{t.market.volume}</span>
            </div>
            {leaders.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "grid grid-cols-4 px-4 py-3 items-center border-b border-[var(--card-border)] last:border-0 hover:bg-[var(--background)] transition-colors",
                  l.id === user?.id && "bg-[var(--accent)]/5"
                )}
              >
                <div className="flex items-center gap-2">
                  {l.rank <= 3 ? (
                    RANK_ICONS[l.rank - 1]
                  ) : (
                    <span className="text-sm font-bold text-[var(--muted)] w-5 text-center">#{l.rank}</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-bold text-xs">
                    {l.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {l.displayName || l.username}
                      {l.id === user?.id && <span className="ml-1 text-xs text-[var(--accent)]">({t.leaderboard.you})</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{l.totalTrades} {t.leaderboard.trades}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{formatTZS(l.totalVolume)}</p>
                  <p className="text-xs text-[var(--muted)]">{l.marketsCreated} {t.leaderboard.markets}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
