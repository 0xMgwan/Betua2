"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { formatTZS, formatNumber, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { TrendUp, Clock } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Position {
  id: string;
  yesShares: number;
  noShares: number;
  currentValue: number;
  price: { yes: number; no: number };
  market: {
    id: string;
    title: string;
    status: string;
    resolvesAt: string;
    outcome?: number | null;
    category: string;
  };
}

interface Trade {
  id: string;
  side: string;
  amountTzs: number;
  shares: number;
  price: number;
  createdAt: string;
  market: { id: string; title: string; status: string };
}

export default function PortfolioPage() {
  const { user } = useUser();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"positions" | "history">("positions");

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setPositions(d.positions || []);
        setTrades(d.trades || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalInvested = trades.reduce((sum, t) => sum + t.amountTzs, 0);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-32">
          <p className="text-[var(--muted)] mb-4 font-mono">Sign in to view your portfolio</p>
          <Link href="/auth/login" className="px-6 py-2.5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Portfolio</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Wallet Balance", value: formatTZS(user.balanceTzs || 0), color: "text-[var(--accent)]" },
            { label: "Open Positions Value", value: formatTZS(Math.round(totalValue)), color: "" },
            { label: "Total Invested", value: formatTZS(totalInvested), color: "" },
            { label: "Open Positions", value: String(positions.length), color: "" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5"
            >
              <div className={cn("text-2xl font-bold mb-1", s.color)}>{s.value}</div>
              <div className="text-xs text-[var(--muted)]">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--card-border)] mb-6">
          {(["positions", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-3 text-sm font-medium capitalize transition-all",
                tab === t
                  ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {t === "positions" ? `Open Positions (${positions.length})` : `Trade History (${trades.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-[var(--card)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : tab === "positions" ? (
          positions.length === 0 ? (
            <div className="text-center py-24 text-[var(--muted)]">
              <TrendUp size={40} className="mx-auto mb-4 opacity-30" weight="duotone" />
              <p className="text-lg font-medium mb-2">No open positions</p>
              <p className="text-sm mb-6">Start trading to build your portfolio</p>
              <Link href="/markets" className="px-6 py-2.5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase">
                Browse Markets
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map((p, i) => {
                const isResolved = p.market.status === "RESOLVED";
                const won =
                  isResolved &&
                  ((p.market.outcome === 1 && p.yesShares > 0) ||
                    (p.market.outcome === 0 && p.noShares > 0));

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/markets/${p.market.id}`}>
                      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 hover:border-[var(--accent)]/30 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--card-border)] text-[var(--muted)]">
                                {p.market.category}
                              </span>
                              {isResolved && (
                                <span className={cn("text-xs font-medium", won ? "text-[var(--accent)]" : "text-red-400")}>
                                  {won ? "✓ Won" : "✗ Lost"}
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-sm line-clamp-1">{p.market.title}</p>
                            <div className="flex gap-4 mt-2 text-xs text-[var(--muted)]">
                              {p.yesShares > 0 && (
                                <span className="yes-pill px-2 py-0.5 rounded-full text-xs font-medium">
                                  {formatNumber(p.yesShares)} YES
                                </span>
                              )}
                              {p.noShares > 0 && (
                                <span className="no-pill px-2 py-0.5 rounded-full text-xs font-medium">
                                  {formatNumber(p.noShares)} NO
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-sm">{formatTZS(Math.round(p.currentValue))}</div>
                            <div className="text-xs text-[var(--muted)] mt-0.5">Current value</div>
                            <div className="flex items-center justify-end gap-1 text-xs mt-1">
                              <Clock size={10} className="text-[var(--muted)]" />
                              <span className={isResolved ? "text-blue-400" : "text-[var(--muted)]"}>
                                {isResolved ? "Resolved" : "Open"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {trades.length === 0 ? (
              <p className="text-center text-[var(--muted)] py-16">No trades yet</p>
            ) : (
              trades.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/markets/${t.market.id}`}>
                    <div className="flex items-center justify-between py-3 px-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl hover:border-[var(--accent)]/30 transition-all text-sm">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold",
                            t.side === "YES" ? "yes-pill" : "no-pill"
                          )}
                        >
                          {t.side}
                        </span>
                        <span className="font-medium line-clamp-1 max-w-xs">{t.market.title}</span>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold">{formatTZS(t.amountTzs)}</div>
                        <div className="text-[var(--muted)]">{t.shares} shares</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
