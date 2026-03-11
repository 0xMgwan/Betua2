"use client";
import { useState, useEffect, useCallback } from "react";
import { formatTZS } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendUp, ChartBar, Crosshair, CalendarBlank } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface UserProfile {
  id: string;
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  totalVolume: number;
  marketsTraded: number;
  _count: { trades: number; marketsCreated: number; comments: number };
  trades: { amountTzs: number; side: string; createdAt: string; market: { title: string; id: string } }[];
}

interface UserProfileModalProps {
  username: string | null;
  onClose: () => void;
}

export function UserProfileModal({ username, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (uname: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${uname}`);
      if (!res.ok) throw new Error("User not found");
      const data = await res.json();
      setProfile(data.user);
    } catch {
      setError("User not found");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (username) {
      setProfile(null);
      loadProfile(username);
    }
  }, [username, loadProfile]);

  if (!username) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-[var(--background)] border-2 border-[var(--card-border)] w-full sm:w-[420px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-t-xl sm:rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[var(--card-border)] bg-[var(--card)]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00e5a0]" />
              <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">USER.PROFILE</span>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-[var(--background)] transition-colors border border-transparent hover:border-[var(--card-border)]">
              <X size={14} className="text-[var(--muted)]" />
            </button>
          </div>

          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center py-1.5">
            <div className="w-8 h-0.5 bg-[var(--muted)]/30" />
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 border-2 border-[var(--card-border)] mx-auto mb-4 animate-pulse" />
              <div className="h-3 bg-[var(--card)] w-28 mx-auto mb-2 animate-pulse" />
              <div className="h-2 bg-[var(--card)] w-20 mx-auto animate-pulse" />
            </div>
          ) : error ? (
            <div className="p-8 text-center font-mono text-sm text-[var(--muted)]">
              <span className="text-red-400">ERR:</span> {error}
            </div>
          ) : profile ? (
            <div>
              {/* Avatar + name */}
              <div className="px-4 pt-5 pb-4 text-center">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-[var(--foreground)]"
                  />
                ) : (
                  <div className="w-20 h-20 border-2 border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] font-black text-3xl font-mono mx-auto mb-3">
                    {profile.username[0].toUpperCase()}
                  </div>
                )}
                <h3 className="font-black text-xl font-mono">{profile.displayName || profile.username}</h3>
                <p className="text-[var(--muted)] text-xs font-mono">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-xs mt-2 text-[var(--muted)] leading-relaxed max-w-xs mx-auto font-mono">{profile.bio}</p>
                )}
                <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-[var(--muted)] font-mono uppercase tracking-wider">
                  <CalendarBlank size={10} />
                  Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </div>
              </div>

              {/* Stats grid - terminal style */}
              <div className="grid grid-cols-3 border-y-2 border-[var(--card-border)]">
                {[
                  { value: formatTZS(profile.totalVolume), label: "VOLUME", icon: TrendUp },
                  { value: profile._count.trades, label: "TRADES", icon: ChartBar },
                  { value: profile.marketsTraded, label: "MARKETS", icon: Crosshair },
                ].map((stat, i) => (
                  <div key={stat.label} className={cn("p-3 text-center", i < 2 && "border-r-2 border-[var(--card-border)]")}>
                    <p className="font-black text-base font-mono">{stat.value}</p>
                    <p className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-wider flex items-center justify-center gap-1">
                      <stat.icon size={9} /> {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Recent trades */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-px bg-[var(--foreground)]" />
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted)]">Recent Trades</h4>
                  <div className="flex-1 h-px bg-[var(--card-border)]" />
                </div>
                {profile.trades.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] text-center py-4 font-mono">No trades yet</p>
                ) : (
                  <div className="space-y-1">
                    {profile.trades.map((tr, i) => (
                      <Link
                        key={i}
                        href={`/markets/${tr.market.id}`}
                        onClick={onClose}
                        className="flex items-center justify-between py-2 px-2 text-sm border border-transparent hover:border-[var(--card-border)] hover:bg-[var(--card)] transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-mono">{tr.market.title}</p>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 text-[9px] font-black font-mono mt-0.5 inline-block border",
                              tr.side === "YES"
                                ? "border-[var(--foreground)] text-[var(--foreground)]"
                                : "border-[var(--muted)] text-[var(--muted)]"
                            )}
                          >
                            {tr.side}
                          </span>
                        </div>
                        <span className="font-black text-xs font-mono ml-2">{formatTZS(tr.amountTzs)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Terminal footer */}
              <div className="px-4 py-2 border-t border-[var(--card-border)] flex items-center justify-between">
                <span className="text-[8px] font-mono text-[var(--muted)]/50 uppercase">GUAP.PROFILE.V1</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-[#00e5a0] animate-pulse" />
                  <div className="w-1 h-1 bg-[var(--muted)]/30" />
                  <div className="w-1 h-1 bg-[var(--muted)]/30" />
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
