"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS, formatNumber, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  TrendUp, Clock, Terminal, Lightning, Wallet, ChartLineUp,
  CurrencyDollar, Trophy, Eye, ArrowRight, CheckCircle, XCircle,
  Pulse, WarningCircle,
} from "@phosphor-icons/react";
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

    // Silent background refresh every 30s (no loading spinner)
    const interval = setInterval(() => {
      fetch("/api/portfolio")
        .then((r) => r.json())
        .then((d) => {
          setPositions(d.positions || []);
          setTrades(d.trades || []);
        })
        .catch(() => {}); // silently ignore errors
    }, 30000);
    return () => clearInterval(interval);
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
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-[var(--card)] border-2 border-[var(--card-border)]">
            <div className="bg-[var(--background)] border-b-2 border-[var(--card-border)] px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-[var(--accent)]/70" />
              </div>
              <span className="text-xs font-mono text-[var(--muted)] tracking-wider">PORTFOLIO.exe</span>
            </div>
            <div className="text-center py-16 px-6">
              <WarningCircle size={32} className="mx-auto mb-4 text-yellow-500" weight="fill" />
              <p className="text-sm font-mono text-[var(--muted)] mb-6">[AUTH] {t.portfolio.signInToView}</p>
              <Link href="/auth/login" className="inline-flex items-center gap-2 px-6 py-2.5 border-2 border-[var(--accent)] text-[var(--accent)] font-mono font-bold text-sm hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all tracking-wider uppercase">
                <Lightning size={14} weight="fill" />
                {t.nav.signIn}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Main terminal window */}
          <div className="bg-[var(--card)] border-2 border-[var(--card-border)] overflow-hidden">

            {/* Terminal title bar */}
            <div className="bg-[var(--background)] border-b-2 border-[var(--card-border)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-[var(--accent)]/70" />
                </div>
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[var(--accent)]" />
                  <span className="text-xs font-mono text-[var(--accent)] tracking-wider">PORTFOLIO.exe</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pulse size={12} weight="fill" className="text-[var(--accent)] animate-pulse" />
                <span className="text-[10px] font-mono text-[var(--muted)]">
                  {locale === "sw" ? "ADA" : "LIVE"}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">

              {/* Boot header */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6 font-mono"
              >
                <p className="text-[var(--accent)] text-xs mb-1">
                  <span className="text-[var(--muted)]">[SYS]</span> {t.portfolio.title}
                </p>
                <p className="text-[var(--muted)] text-[10px]">@{user.username || user.email}</p>
                <div className="h-px bg-gradient-to-r from-[var(--accent)]/50 via-[var(--accent)]/20 to-transparent mt-3" />
              </motion.div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                {[
                  { label: t.portfolio.walletBalance, value: formatTZS(user.balanceTzs || 0), color: "text-[var(--accent)]", border: "border-[var(--accent)]/30", icon: <Wallet size={14} weight="fill" className="text-[var(--accent)]" /> },
                  { label: t.portfolio.openPositionsValue, value: formatTZS(Math.round(totalValue)), color: "text-[var(--foreground)]", border: "border-[var(--card-border)]", icon: <ChartLineUp size={14} weight="fill" className="text-[#00b4d8]" /> },
                  { label: t.portfolio.totalInvested, value: formatTZS(totalInvested), color: "text-[var(--foreground)]", border: "border-[var(--card-border)]", icon: <CurrencyDollar size={14} weight="fill" className="text-orange-400" /> },
                  { label: locale === "sw" ? "Malipo" : "Payout", value: formatTZS(Math.round(totalPayout)), color: "text-yellow-400", border: "border-yellow-500/30", icon: <Trophy size={14} weight="fill" className="text-yellow-400" /> },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn("bg-[var(--background)] border p-4", s.border)}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      {s.icon}
                      <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">{s.label}</span>
                    </div>
                    <div className={cn("text-xl font-mono font-bold tabular-nums", s.color)}>{s.value}</div>
                  </motion.div>
                ))}
              </div>

              {/* Tabs — terminal style */}
              <div className="flex border-b-2 border-[var(--card-border)] mb-6">
                {(["positions", "history"] as const).map((tb) => (
                  <button
                    key={tb}
                    onClick={() => setTab(tb)}
                    className={cn(
                      "px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all",
                      tab === tb
                        ? "border-b-2 border-[var(--accent)] text-[var(--accent)] -mb-[2px]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {tb === "positions"
                      ? `> ${t.portfolio.openPositions} (${positions.length})`
                      : `> ${t.portfolio.tradeHistory} (${trades.length})`}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-[var(--background)] border border-[var(--card-border)] animate-pulse" />
                  ))}
                </div>
              ) : tab === "positions" ? (
                positions.length === 0 ? (
                  <div className="text-center py-16">
                    <TrendUp size={32} className="mx-auto mb-3 text-[var(--muted)] opacity-30" weight="duotone" />
                    <p className="text-sm font-mono text-[var(--muted)] mb-1">[EMPTY] {t.portfolio.noOpenPositions}</p>
                    <p className="text-[10px] font-mono text-[var(--muted)] mb-6">{t.portfolio.startTrading}</p>
                    <Link href="/markets" className="inline-flex items-center gap-2 px-5 py-2 border-2 border-[var(--accent)] text-[var(--accent)] font-mono font-bold text-xs hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all tracking-wider uppercase">
                      <ArrowRight size={12} weight="bold" />
                      {t.portfolio.browseMarkets}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.map((p, i) => {
                      const isResolved = p.market.status === "RESOLVED";
                      const isMultiOpt = !!(p.market.options && p.market.options.length >= 2);
                      const won = isResolved && (
                        isMultiOpt
                          ? !!(p.optionShares && p.market.outcome !== null && p.optionShares[String(p.market.outcome)] > 0)
                          : ((p.market.outcome === 1 && p.yesShares > 0) || (p.market.outcome === 0 && p.noShares > 0))
                      );

                      const positionPayout = isMultiOpt && p.optionShares
                        ? Object.values(p.optionShares).reduce((s, v) => s + v, 0)
                        : p.yesShares + p.noShares;

                      const valuePct = positionPayout > 0 ? Math.min((p.currentValue / positionPayout) * 100, 100) : 0;

                      // Left accent color
                      const accentColor = isResolved
                        ? won ? "border-l-[var(--accent)]" : "border-l-red-500"
                        : "border-l-yellow-400";

                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <Link href={`/markets/${p.market.id}`}>
                            <div className={cn(
                              "bg-[var(--background)] border border-[var(--card-border)] border-l-4 hover:border-[var(--accent)]/40 hover:shadow-[0_0_15px_rgba(0,229,160,0.05)] transition-all",
                              accentColor
                            )}>
                              {/* Position header */}
                              <div className="px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 border border-[var(--card-border)] text-[var(--muted)] uppercase tracking-wider">
                                        [{p.market.category}]
                                      </span>
                                      {isResolved ? (
                                        <span className={cn(
                                          "text-[10px] font-mono font-bold px-1.5 py-0.5 border uppercase tracking-wider flex items-center gap-1",
                                          won ? "border-[var(--accent)]/30 text-[var(--accent)]" : "border-red-500/30 text-red-400"
                                        )}>
                                          {won ? <CheckCircle size={10} weight="fill" /> : <XCircle size={10} weight="fill" />}
                                          {won ? t.portfolio.won : t.portfolio.lost}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 border border-yellow-500/30 text-yellow-400 uppercase tracking-wider flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                                          {t.portfolio.open}
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-bold text-sm line-clamp-1 leading-snug">{p.market.title}</p>
                                  </div>
                                </div>

                                {/* Share pills */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {isMultiOpt && p.optionShares ? (
                                    Object.entries(p.optionShares).filter(([, s]) => s > 0).map(([idx, shares]) => {
                                      const pillColors = ["text-[#00e5a0] border-[#00e5a0]/30", "text-[#00b4d8] border-[#00b4d8]/30", "text-orange-400 border-orange-500/30", "text-pink-400 border-pink-500/30", "text-purple-400 border-purple-500/30"];
                                      return (
                                        <span key={idx} className={cn("px-2 py-0.5 text-[10px] font-mono font-bold border", pillColors[Number(idx) % pillColors.length])}>
                                          {formatNumber(shares)} {p.market.options![Number(idx)] || `OPT_${idx}`}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <>
                                      {p.yesShares > 0 && (
                                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold border border-[#00e5a0]/30 text-[#00e5a0]">
                                          {formatNumber(p.yesShares)} YES
                                        </span>
                                      )}
                                      {p.noShares > 0 && (
                                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold border border-red-500/30 text-red-400">
                                          {formatNumber(p.noShares)} NO
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Progress bar for open positions */}
                                {!isResolved && (
                                  <div className="mt-3">
                                    <div className="w-full h-1 bg-[var(--card)] overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${valuePct}%` }}
                                        transition={{ delay: i * 0.04 + 0.3, duration: 0.5, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-[var(--accent)] to-yellow-400"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Value row */}
                                <div className="flex items-end justify-between mt-3 pt-2 border-t border-[var(--card-border)]">
                                  <div>
                                    <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">{t.portfolio.currentValue}</div>
                                    <div className="text-base font-mono font-bold tabular-nums">{formatTZS(Math.round(p.currentValue))}</div>
                                  </div>

                                  {!isResolved ? (
                                    <div className="text-right">
                                      <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                        {locale === "sw" ? "Malipo" : "If correct"}
                                      </div>
                                      <div className="text-base font-mono font-bold tabular-nums text-yellow-400">
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
                                          className="py-1.5 px-4 border-2 border-[var(--accent)] text-[var(--accent)] font-mono font-bold text-xs hover:bg-[var(--accent)] hover:text-[var(--background)] transition-all disabled:opacity-50 tracking-wider uppercase shadow-[0_0_15px_rgba(0,229,160,0.1)]"
                                        >
                                          {redeeming === p.id
                                            ? (locale === "sw" ? "INAKOMBOA..." : "REDEEMING...")
                                            : (locale === "sw" ? "KOMBOA" : "REDEEM")}
                                        </button>
                                      )}
                                      {redeemSuccess === p.id && (
                                        <div className="text-xs font-mono text-[var(--accent)] font-bold animate-pulse flex items-center gap-1 justify-end">
                                          <CheckCircle size={12} weight="fill" />
                                          {locale === "sw" ? "IMEFANIKIWA" : "REDEEMED"}
                                        </div>
                                      )}
                                      {p.redeemed && redeemSuccess !== p.id && (
                                        <div className="text-[10px] font-mono text-[var(--muted)] flex items-center gap-1 justify-end">
                                          <CheckCircle size={10} weight="fill" />
                                          {locale === "sw" ? "Imekombowa" : "Redeemed"}
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
                <div className="space-y-1">
                  {trades.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-sm font-mono text-[var(--muted)]">[EMPTY] {t.portfolio.noTrades}</p>
                    </div>
                  ) : (
                    <>
                      {/* Table header */}
                      <div className="flex items-center justify-between px-4 py-2 text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider border-b border-[var(--card-border)]">
                        <span>Side / Market</span>
                        <span>Amount / Shares</span>
                      </div>
                      {trades.map((tr, i) => (
                        <motion.div
                          key={tr.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                        >
                          <Link href={`/markets/${tr.market.id}`}>
                            <div className="flex items-center justify-between py-2.5 px-4 bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent)]/30 transition-all">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] font-mono font-bold border",
                                    tr.side === "YES" ? "text-[#00e5a0] border-[#00e5a0]/30" : tr.side === "NO" ? "text-red-400 border-red-500/30" : "text-purple-400 border-purple-500/30"
                                  )}
                                >
                                  {tr.side}
                                </span>
                                <span className="text-sm font-medium line-clamp-1">{tr.market.title}</span>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <div className="text-sm font-mono font-bold tabular-nums">{formatTZS(tr.amountTzs)}</div>
                                <div className="text-[10px] font-mono text-[var(--muted)]">{tr.shares} {t.portfolio.shares}</div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </>
                  )}
                </div>
              )}

            </div>

            {/* Terminal footer */}
            <div className="bg-[var(--background)] border-t-2 border-[var(--card-border)] px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--muted)]">
                [{positions.length} POS] [{trades.length} TRADES] [{tab.toUpperCase()}]
              </span>
              <span className="text-[10px] font-mono text-[var(--accent)]">
                ● {locale === "sw" ? "TAYARI" : "ONLINE"}
              </span>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
