"use client";
import { useState, useEffect, useCallback } from "react";
import { formatTZS } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChartBar, TrendUp, ChatCircle, CalendarBlank } from "@phosphor-icons/react";
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
            <h2 className="font-bold text-lg">Profile</h2>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[var(--background)] transition-colors">
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--background)] animate-pulse mx-auto mb-4" />
              <div className="h-4 bg-[var(--background)] rounded animate-pulse w-32 mx-auto mb-2" />
              <div className="h-3 bg-[var(--background)] rounded animate-pulse w-24 mx-auto" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-[var(--muted)]">{error}</div>
          ) : profile ? (
            <div>
              {/* Avatar + name */}
              <div className="p-6 text-center">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-[var(--accent)]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-black text-3xl mx-auto mb-3">
                    {profile.username[0].toUpperCase()}
                  </div>
                )}
                <h3 className="font-bold text-xl">{profile.displayName || profile.username}</h3>
                <p className="text-[var(--muted)] text-sm">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-sm mt-2 text-[var(--muted)] leading-relaxed max-w-xs mx-auto">{profile.bio}</p>
                )}
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-[var(--muted)]">
                  <CalendarBlank size={12} />
                  Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-px bg-[var(--card-border)] border-y border-[var(--card-border)]">
                <div className="bg-[var(--card)] p-3 text-center">
                  <p className="font-bold text-lg">{formatTZS(profile.totalVolume)}</p>
                  <p className="text-xs text-[var(--muted)] flex items-center justify-center gap-1"><TrendUp size={11} /> Volume</p>
                </div>
                <div className="bg-[var(--card)] p-3 text-center">
                  <p className="font-bold text-lg">{profile._count.trades}</p>
                  <p className="text-xs text-[var(--muted)] flex items-center justify-center gap-1"><ChartBar size={11} /> Trades</p>
                </div>
                <div className="bg-[var(--card)] p-3 text-center">
                  <p className="font-bold text-lg">{profile.marketsTraded}</p>
                  <p className="text-xs text-[var(--muted)] flex items-center justify-center gap-1"><ChatCircle size={11} /> Markets</p>
                </div>
              </div>

              {/* Recent trades */}
              <div className="p-4">
                <h4 className="text-sm font-semibold mb-3 text-[var(--muted)]">Recent Trades</h4>
                {profile.trades.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] text-center py-4">No trades yet</p>
                ) : (
                  <div className="space-y-2">
                    {profile.trades.map((tr, i) => (
                      <Link
                        key={i}
                        href={`/markets/${tr.market.id}`}
                        onClick={onClose}
                        className="flex items-center justify-between py-2 text-sm border-b border-[var(--card-border)] last:border-0 hover:bg-[var(--background)] -mx-1 px-1 rounded transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs">{tr.market.title}</p>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 inline-block",
                              tr.side === "YES" ? "yes-pill" : "no-pill"
                            )}
                          >
                            {tr.side}
                          </span>
                        </div>
                        <span className="font-medium text-xs ml-2">{formatTZS(tr.amountTzs)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
