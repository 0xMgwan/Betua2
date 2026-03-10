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
  optionShares?: Record<string, number> | null;
  currentValue: number;
  redeemed: boolean;
  price: { yes: number; no: number };
  optionPrices?: number[] | null;
  market: {
    id: string;
    title: string;
    status: string;
    resolvesAt: string;
    outcome?: number | null;
    outcomeLabel?: string | null;
    options?: string[] | null;
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
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

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

      // Show success message
      setRedeemSuccess(positionId);
      
      // Update position in state to mark as redeemed
      setPositions((prev) =>
        prev.map((p) => (p.id === positionId ? { ...p, redeemed: true } : p))
      );

      // Auto-hide success message after 3 seconds
      setTimeout(() => setRedeemSuccess(null), 3000);

      // Refresh portfolio data to get updated balance
      fetch("/api/portfolio")
        .then((r) => r.json())
        .then((d) => {
          setPositions(d.positions || []);
          setTrades(d.trades || []);
        });
    } catch (err) {
      alert(locale === "sw" ? "Kosa la mtandao" : "Network error");
    } finally {
      setRedeeming(null);
    }
  };

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalInvested = trades.reduce((sum, t) => sum + t.amountTzs, 0);

  // Total potential payout: sum of shares across all open positions
  // Each share pays 1 TZS if the outcome is correct
  const totalPayout = positions
    .filter((p) => p.market.status === "OPEN")
    .reduce((sum, p) => {
      const isMultiOpt = !!(p.market.options && p.market.options.length >= 2);
      if (isMultiOpt && p.optionShares) {
        // Sum of all option shares (best case: all correct)
        return sum + Object.values(p.optionShares).reduce((s, v) => s + v, 0);
      }
      return sum + p.yesShares + p.noShares;
    }, 0);

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
            { label: locale === "sw" ? "Malipo Yanayowezekana" : "Potential Payout", value: formatTZS(Math.round(totalPayout)), color: "text-yellow-400" },
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
            <div className="space-y-4">
              {positions.map((p, i) => {
                const isResolved = p.market.status === "RESOLVED";
                const isMultiOpt = !!(p.market.options && p.market.options.length >= 2);
                const won = isResolved && (
                  isMultiOpt
                    ? !!(p.optionShares && p.market.outcome !== null && p.optionShares[String(p.market.outcome)] > 0)
                    : ((p.market.outcome === 1 && p.yesShares > 0) || (p.market.outcome === 0 && p.noShares > 0))
                );

                // Potential payout if correct (each share = 1 TZS)
                const positionPayout = isMultiOpt && p.optionShares
                  ? Object.values(p.optionShares).reduce((s, v) => s + v, 0)
                  : p.yesShares + p.noShares;

                // Value as % of payout for progress bar
                const valuePct = positionPayout > 0 ? Math.min((p.currentValue / positionPayout) * 100, 100) : 0;

                // Border color based on status
                const borderColor = isResolved
                  ? won ? "border-l-[var(--accent)]" : "border-l-red-500"
                  : "border-l-yellow-400";

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <Link href={`/markets/${p.market.id}`}>
                      <div className={cn(
                        "bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden hover:border-[var(--accent)]/30 hover:shadow-lg hover:shadow-[var(--accent)]/5 transition-all",
                        "border-l-4", borderColor
                      )}>
                        {/* Top section */}
                        <div className="p-5 pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--card-border)] text-[var(--muted)] uppercase tracking-wider">
                                  {p.market.category}
                                </span>
                                {isResolved && (
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                    won ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-red-500/10 text-red-400"
                                  )}>
                                    {won ? `✓ ${t.portfolio.won}` : `✗ ${t.portfolio.lost}`}
                                  </span>
                                )}
                                {!isResolved && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                                    {t.portfolio.open}
                                  </span>
                                )}
                              </div>
                              <p className="font-bold text-sm line-clamp-2 leading-snug">{p.market.title}</p>
                            </div>
                          </div>

                          {/* Share pills */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {isMultiOpt && p.optionShares ? (
                              Object.entries(p.optionShares).filter(([, s]) => s > 0).map(([idx, shares]) => {
                                const optColors = ["bg-[#00e5a0]/10 text-[#00e5a0] border-[#00e5a0]/20", "bg-[#00b4d8]/10 text-[#00b4d8] border-[#00b4d8]/20", "bg-orange-500/10 text-orange-400 border-orange-500/20"];
                                return (
                                  <span key={idx} className={cn("px-2.5 py-1 rounded-lg text-xs font-bold border", optColors[Number(idx) % optColors.length])}>
                                    {formatNumber(shares)} {p.market.options![Number(idx)] || `Option ${idx}`}
                                  </span>
                                );
                              })
                            ) : (
                              <>
                                {p.yesShares > 0 && (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#00e5a0]/10 text-[#00e5a0] border border-[#00e5a0]/20">
                                    {formatNumber(p.yesShares)} YES
                                  </span>
                                )}
                                {p.noShares > 0 && (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                    {formatNumber(p.noShares)} NO
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Bottom section with value + payout */}
                        <div className="px-5 pb-4">
                          {/* Progress bar */}
                          {!isResolved && (
                            <div className="mb-3">
                              <div className="w-full h-1.5 rounded-full bg-[var(--background)] overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${valuePct}%` }}
                                  transition={{ delay: i * 0.06 + 0.3, duration: 0.6, ease: "easeOut" }}
                                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-yellow-400"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-xs text-[var(--muted)] mb-0.5">{t.portfolio.currentValue}</div>
                              <div className="text-lg font-black tabular-nums">{formatTZS(Math.round(p.currentValue))}</div>
                            </div>

                            {!isResolved ? (
                              <div className="text-right">
                                <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">
                                  {locale === "sw" ? "Malipo" : "If correct"}
                                </div>
                                <div className="text-lg font-black tabular-nums text-yellow-400">
                                  {formatTZS(Math.round(positionPayout))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-right">
                                {won && !p.redeemed && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleRedeem(p.id);
                                    }}
                                    disabled={redeeming === p.id}
                                    className="py-2 px-5 bg-[var(--accent)] text-[var(--background)] rounded-xl text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-[var(--accent)]/20"
                                  >
                                    {redeeming === p.id
                                      ? (locale === "sw" ? "Inakomboa..." : "Redeeming...")
                                      : (locale === "sw" ? "💰 Komboa" : "💰 Redeem")}
                                  </button>
                                )}
                                {redeemSuccess === p.id && (
                                  <div className="text-sm text-[var(--accent)] font-bold animate-pulse">
                                    ✓ {locale === "sw" ? "Imefanikiwa!" : "Redeemed!"}
                                  </div>
                                )}
                                {p.redeemed && redeemSuccess !== p.id && (
                                  <div className="text-xs text-[var(--muted)] font-medium">
                                    ✓ {locale === "sw" ? "Imekombowa" : "Redeemed"}
                                  </div>
                                )}
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
