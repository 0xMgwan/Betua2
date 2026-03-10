"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
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
  redeemed: boolean;
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
  const { t, locale } = useLanguage();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"positions" | "history">("positions");
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setPositions(d.positions || []);
        setTrades(d.trades || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRedeem = async (positionId: string) => {
    setRedeeming(positionId);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || (locale === "sw" ? "Imeshindwa" : "Failed"));
        return;
      }

      // Update position in state
      setPositions((prev) =>
        prev.map((p) => (p.id === positionId ? { ...p, redeemed: true } : p))
      );

      // Refresh user balance
      if (user) {
        window.location.reload();
      }
    } catch (err) {
      alert(locale === "sw" ? "Kosa la mtandao" : "Network error");
    } finally {
      setRedeeming(null);
    }
  };

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalInvested = trades.reduce((sum, t) => sum + t.amountTzs, 0);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-32">
          <p className="text-[var(--muted)] mb-4 font-mono">{t.portfolio.signInToView}</p>
          <Link href="/auth/login" className="px-6 py-2.5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase">
            {t.nav.signIn}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{t.portfolio.title}</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: t.portfolio.walletBalance, value: formatTZS(user.balanceTzs || 0), color: "text-[var(--accent)]" },
            { label: t.portfolio.openPositionsValue, value: formatTZS(Math.round(totalValue)), color: "" },
            { label: t.portfolio.totalInvested, value: formatTZS(totalInvested), color: "" },
            { label: t.portfolio.openPositions, value: String(positions.length), color: "" },
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
          {(["positions", "history"] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={cn(
                "px-4 py-3 text-sm font-medium capitalize transition-all",
                tab === tb
                  ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {tb === "positions" ? `${t.portfolio.openPositions} (${positions.length})` : `${t.portfolio.tradeHistory} (${trades.length})`}
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
              <p className="text-lg font-medium mb-2">{t.portfolio.noOpenPositions}</p>
              <p className="text-sm mb-6">{t.portfolio.startTrading}</p>
              <Link href="/markets" className="px-6 py-2.5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase">
                {t.portfolio.browseMarkets}
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
                                  {won ? `✓ ${t.portfolio.won}` : `✗ ${t.portfolio.lost}`}
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
                            <div className="text-xs text-[var(--muted)] mt-0.5">{t.portfolio.currentValue}</div>
                            <div className="flex items-center justify-end gap-1 text-xs mt-1">
                              <Clock size={10} className="text-[var(--muted)]" />
                              <span className={isResolved ? "text-blue-400" : "text-[var(--muted)]"}>
                                {isResolved ? t.portfolio.resolved : t.portfolio.open}
                              </span>
                            </div>
                            {isResolved && won && !p.redeemed && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRedeem(p.id);
                                }}
                                disabled={redeeming === p.id}
                                className="mt-2 w-full py-1.5 px-3 bg-[var(--accent)] text-black rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                {redeeming === p.id
                                  ? (locale === "sw" ? "Inakomboa..." : "Redeeming...")
                                  : (locale === "sw" ? "Komboa" : "Redeem")}
                              </button>
                            )}
                            {p.redeemed && (
                              <div className="mt-2 text-xs text-[var(--accent)] font-medium">
                                ✓ {locale === "sw" ? "Imekombowa" : "Redeemed"}
                              </div>
                            )}
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
              <p className="text-center text-[var(--muted)] py-16">{t.portfolio.noTrades}</p>
            ) : (
              trades.map((tr, i) => (
                <motion.div
                  key={tr.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/markets/${tr.market.id}`}>
                    <div className="flex items-center justify-between py-3 px-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl hover:border-[var(--accent)]/30 transition-all text-sm">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold",
                            tr.side === "YES" ? "yes-pill" : "no-pill"
                          )}
                        >
                          {tr.side}
                        </span>
                        <span className="font-medium line-clamp-1 max-w-xs">{tr.market.title}</span>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-bold">{formatTZS(tr.amountTzs)}</div>
                        <div className="text-[var(--muted)]">{tr.shares} {t.portfolio.shares}</div>
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
