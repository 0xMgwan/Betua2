"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS, formatNumber, formatPercent } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  TrendUp, Clock, Terminal, Lightning, Wallet, ChartLineUp,
  CurrencyDollar, Trophy, Eye, ArrowRight, CheckCircle, XCircle,
  Pulse, WarningCircle, ShareNetwork, CaretDown,
} from "@phosphor-icons/react";
import { getPayoutForShares, getMultiOptionPayoutForShares, getPrice, getMultiOptionPrices } from "@/lib/amm";
import { cn } from "@/lib/utils";
import { ShareCardButton } from "@/components/ShareCard";

interface Position {
  id: string;
  yesShares: number;
  noShares: number;
  optionShares?: Record<string, number> | null;
  currentValue: number;
  totalInvested: number;
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
    imageUrl?: string | null;
    yesPool: number;
    noPool: number;
    optionPools?: number[] | null;
    totalVolume: number;
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

interface CreatedMarket {
  id: string;
  title: string;
  status: string;
  category: string;
  imageUrl?: string | null;
  resolvesAt: string;
  totalVolume: number;
  createdAt: string;
  yesPool: number;
  noPool: number;
  options?: string[] | null;
  optionPools?: number[] | null;
  _count: { trades: number };
}

export default function PortfolioPage() {
  const { user } = useUser();
  const { t, locale } = useLanguage();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [createdMarkets, setCreatedMarkets] = useState<CreatedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"positions" | "history" | "created">("positions");
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [createdMarketFilter, setCreatedMarketFilter] = useState<"all" | "OPEN" | "EXPIRED" | "RESOLVED">("all");

  // Sell state
  const [sellOpen, setSellOpen] = useState<string | null>(null); // position id
  const [sellSide, setSellSide] = useState<string>("");
  const [sellShares, setSellShares] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");
  const [sellSuccess, setSellSuccess] = useState("");

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setPositions(d.positions || []);
        setTrades(d.trades || []);
        setCreatedMarkets(d.createdMarkets || []);
      })
      .finally(() => setLoading(false));

    // Silent background refresh every 30s (no loading spinner)
    const interval = setInterval(() => {
      fetch("/api/portfolio")
        .then((r) => r.json())
        .then((d) => {
          setPositions(d.positions || []);
          setTrades(d.trades || []);
          setCreatedMarkets(d.createdMarkets || []);
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

      // Refresh portfolio data and user balance
      Promise.all([
        fetch("/api/portfolio").then((r) => r.json()),
        fetch("/api/auth/me").then((r) => r.json())
      ]).then(([portfolioData, userData]) => {
        setPositions(portfolioData.positions || []);
        setTrades(portfolioData.trades || []);
        if (userData.user) {
          useUser.getState().setUser(userData.user);
        }
      });
    } catch (err) {
      alert(locale === "sw" ? "Kosa la mtandao" : "Network error");
    } finally {
      setRedeeming(null);
    }
  };

  const handleSell = async (position: Position) => {
    if (!sellShares || Number(sellShares) < 1) return;
    setSellLoading(true);
    setSellError("");
    setSellSuccess("");
    try {
      const isMultiOpt = !!(position.market.options && position.market.options.length >= 2);
      const body = isMultiOpt
        ? { marketId: position.market.id, optionIndex: Number(sellSide), sharesToSell: Number(sellShares) }
        : { marketId: position.market.id, side: sellSide, sharesToSell: Number(sellShares) };

      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSellError(data.error || "Sell failed");
      } else {
        setSellSuccess(`Sold for ${formatTZS(data.netPayout)}!`);
        setSellShares("");
        // Refresh portfolio
        fetch("/api/portfolio")
          .then((r) => r.json())
          .then((d) => { setPositions(d.positions || []); setTrades(d.trades || []); });
        setTimeout(() => { setSellSuccess(""); setSellOpen(null); }, 3000);
      }
    } catch {
      setSellError("Network error");
    } finally {
      setSellLoading(false);
    }
  };

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  // Total invested: only count trades for currently open positions (matches payout scope)
  const openMarketIds = new Set(positions.map(p => p.market.id));
  const totalInvested = trades
    .filter(t => !t.side.startsWith("SELL_") && openMarketIds.has(t.market.id))
    .reduce((sum, t) => sum + t.amountTzs, 0);

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
                {(["positions", "history", ...(createdMarkets.length > 0 ? ["created" as const] : [])] as const).map((tb) => (
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
                      : tb === "history"
                      ? `> ${t.portfolio.tradeHistory} (${trades.length})`
                      : `> ${locale === "sw" ? "SOKO ZAKO" : "CREATED"} (${createdMarkets.length})`}
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
                                    <div className="flex items-end gap-3">
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          if (sellOpen === p.id) {
                                            setSellOpen(null);
                                          } else {
                                            setSellOpen(p.id);
                                            setSellError("");
                                            setSellSuccess("");
                                            setSellShares("");
                                            // Auto-select first available side
                                            if (isMultiOpt && p.optionShares) {
                                              const firstIdx = Object.entries(p.optionShares).find(([, s]) => s > 0)?.[0] || "0";
                                              setSellSide(firstIdx);
                                            } else {
                                              setSellSide(p.yesShares > 0 ? "YES" : "NO");
                                            }
                                          }
                                        }}
                                        className="py-1.5 px-3 border-2 border-[#ff4d6a] text-[#ff4d6a] font-mono font-bold text-[10px] hover:bg-[#ff4d6a] hover:text-white transition-all tracking-wider uppercase"
                                      >
                                        {locale === "sw" ? "UZA" : "SELL"}
                                      </button>
                                      <div className="text-right">
                                        <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                          {locale === "sw" ? "Malipo" : "If correct"}
                                        </div>
                                        <div className="text-base font-mono font-bold tabular-nums text-yellow-400">
                                          {formatTZS(Math.round(positionPayout))}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <div onClick={(e) => e.preventDefault()}>
                                        <ShareCardButton
                                          marketTitle={p.market.title}
                                          category={p.market.category}
                                          imageUrl={p.market.imageUrl}
                                          outcome={
                                            isMultiOpt && p.optionShares && p.market.outcome !== null && typeof p.market.outcome === 'number'
                                              ? p.market.options![p.market.outcome] || "Option"
                                              : p.market.outcome === 1 ? "YES" : "NO"
                                          }
                                          won={won}
                                          payout={p.currentValue}
                                          invested={p.totalInvested}
                                          username={user?.username || ""}
                                          shares={
                                            isMultiOpt && p.optionShares && p.market.outcome !== null
                                              ? p.optionShares[String(p.market.outcome)] || 0
                                              : p.market.outcome === 1 ? p.yesShares : p.noShares
                                          }
                                          marketUrl={`/markets/${p.market.id}`}
                                        />
                                      </div>
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
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>

                          {/* Inline sell panel */}
                          <AnimatePresence>
                            {sellOpen === p.id && !isResolved && (() => {
                              // Determine available shares for selected side
                              let availShares = 0;
                              let sideLabel = "";
                              if (isMultiOpt && p.optionShares) {
                                availShares = p.optionShares[sellSide] || 0;
                                sideLabel = p.market.options?.[Number(sellSide)] || `Option ${sellSide}`;
                              } else {
                                availShares = sellSide === "YES" ? p.yesShares : p.noShares;
                                sideLabel = sellSide;
                              }

                              // Estimate payout
                              let estPayout = 0;
                              const FEE = 0.05;
                              if (sellShares && Number(sellShares) >= 1) {
                                try {
                                  if (isMultiOpt && p.market.optionPools) {
                                    const r = getMultiOptionPayoutForShares(Number(sellShares), Number(sellSide), p.market.optionPools);
                                    estPayout = Math.round(r.payout * (1 - FEE));
                                  } else {
                                    const r = sellSide === "YES"
                                      ? getPayoutForShares(Number(sellShares), p.market.yesPool, p.market.noPool)
                                      : getPayoutForShares(Number(sellShares), p.market.noPool, p.market.yesPool);
                                    estPayout = Math.round(r.payout * (1 - FEE));
                                  }
                                } catch {}
                              }

                              return (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="bg-[var(--card)] border border-[var(--card-border)] border-t-0 p-4 space-y-3">
                                    {/* Side selector */}
                                    {isMultiOpt && p.optionShares ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(p.optionShares).filter(([, s]) => s > 0).map(([idx, shares]) => (
                                          <button
                                            key={idx}
                                            onClick={() => { setSellSide(idx); setSellShares(""); }}
                                            className={cn(
                                              "px-3 py-1.5 text-xs font-mono font-bold border transition-all",
                                              sellSide === idx
                                                ? "border-[#ff4d6a] text-[#ff4d6a] bg-[#ff4d6a]/10"
                                                : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]"
                                            )}
                                          >
                                            {p.market.options?.[Number(idx)] || `Opt ${idx}`} ({shares})
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex gap-2">
                                        {p.yesShares > 0 && (
                                          <button
                                            onClick={() => { setSellSide("YES"); setSellShares(""); }}
                                            className={cn(
                                              "flex-1 py-1.5 text-xs font-mono font-bold border transition-all",
                                              sellSide === "YES"
                                                ? "border-[#00e5a0] text-[#00e5a0] bg-[#00e5a0]/10"
                                                : "border-[var(--card-border)] text-[var(--muted)]"
                                            )}
                                          >
                                            YES ({p.yesShares})
                                          </button>
                                        )}
                                        {p.noShares > 0 && (
                                          <button
                                            onClick={() => { setSellSide("NO"); setSellShares(""); }}
                                            className={cn(
                                              "flex-1 py-1.5 text-xs font-mono font-bold border transition-all",
                                              sellSide === "NO"
                                                ? "border-red-400 text-red-400 bg-red-500/10"
                                                : "border-[var(--card-border)] text-[var(--muted)]"
                                            )}
                                          >
                                            NO ({p.noShares})
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Shares input */}
                                    <div>
                                      <input
                                        type="number"
                                        value={sellShares}
                                        onChange={(e) => setSellShares(e.target.value)}
                                        placeholder={`${locale === "sw" ? "Hisa" : "Shares"} (max ${availShares})`}
                                        min="1"
                                        max={availShares}
                                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[#ff4d6a] transition-colors"
                                      />
                                      <div className="flex gap-1.5 mt-1.5">
                                        {[25, 50, 75, 100].map((pct) => {
                                          const qty = Math.floor(availShares * pct / 100);
                                          return (
                                            <button
                                              key={pct}
                                              onClick={() => setSellShares(String(qty))}
                                              disabled={qty < 1}
                                              className="flex-1 py-1 text-[10px] font-mono border border-[var(--card-border)] hover:border-[#ff4d6a] transition-colors disabled:opacity-30"
                                            >
                                              {pct}%
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Estimate */}
                                    {estPayout > 0 && (
                                      <div className="flex justify-between text-xs font-mono">
                                        <span className="text-[var(--muted)]">{locale === "sw" ? "Utapata" : "You receive"}</span>
                                        <span className="font-bold text-[#00e5a0]">{formatTZS(estPayout)}</span>
                                      </div>
                                    )}

                                    {/* Error / Success */}
                                    {sellError && <p className="text-red-400 text-xs font-mono text-center">{sellError}</p>}
                                    {sellSuccess && (
                                      <p className="text-[#00e5a0] text-xs font-mono text-center flex items-center justify-center gap-1">
                                        <CheckCircle size={12} weight="fill" />
                                        {sellSuccess}
                                      </p>
                                    )}

                                    {/* Sell button */}
                                    <button
                                      onClick={() => handleSell(p)}
                                      disabled={sellLoading || !sellShares || Number(sellShares) < 1 || Number(sellShares) > availShares}
                                      className="w-full py-2.5 font-mono font-bold text-xs bg-[#ff4d6a] text-white hover:opacity-90 transition-all disabled:opacity-50 tracking-wider uppercase"
                                    >
                                      {sellLoading
                                        ? (locale === "sw" ? "INACHAKATA..." : "SELLING...")
                                        : `${locale === "sw" ? "UZA" : "SELL"} ${sellShares || 0} ${sideLabel}`
                                      }
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })()}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}

                    {/* ═══ Total Payout Summary ═══ */}
                    <div className="mt-4 bg-[var(--background)] border-2 border-[var(--card-border)] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Trophy size={16} weight="fill" className="text-yellow-400" />
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--muted)]">
                          {locale === "sw" ? "Muhtasari wa Malipo" : "Payout Summary"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[var(--muted)]">{locale === "sw" ? "Jumla uwekezaji" : "Total invested"}</span>
                          <span className="font-bold">{formatTZS(totalInvested)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[var(--muted)]">{locale === "sw" ? "Thamani ya sasa" : "Current value"}</span>
                          <span className="font-bold">{formatTZS(Math.round(totalValue))}</span>
                        </div>
                        <div className="flex justify-between text-sm font-mono">
                          <span className="text-[var(--muted)]">{locale === "sw" ? "Malipo ukishinda" : "Max payout (if all correct)"}</span>
                          <span className="font-bold text-yellow-400">{formatTZS(Math.round(totalPayout))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : tab === "created" ? (
                <div className="space-y-4">
                  {/* Filter buttons */}
                  <div className="flex flex-wrap gap-2">
                    {(["all", "OPEN", "EXPIRED", "RESOLVED"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setCreatedMarketFilter(filter)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-mono font-bold border transition-all uppercase tracking-wider",
                          createdMarketFilter === filter
                            ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                            : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        )}
                      >
                        {filter === "all" 
                          ? (locale === "sw" ? "ZOTE" : "ALL")
                          : filter === "OPEN"
                          ? (locale === "sw" ? "WAZI" : "OPEN")
                          : filter === "EXPIRED"
                          ? (locale === "sw" ? "IMEISHA" : "EXPIRED")
                          : (locale === "sw" ? "IMETATULIWA" : "RESOLVED")
                        }
                        {" "}
                        ({createdMarketFilter === "all" 
                          ? createdMarkets.length 
                          : createdMarkets.filter(m => m.status === filter).length
                        })
                      </button>
                    ))}
                  </div>

                  {/* Markets list */}
                  <div className="space-y-2">
                  {(() => {
                    const filteredMarkets = createdMarkets.filter(
                      market => createdMarketFilter === "all" || market.status === createdMarketFilter
                    );

                    if (filteredMarkets.length === 0) {
                      return (
                        <div className="text-center py-16">
                          <p className="text-sm font-mono text-[var(--muted)]">
                            [EMPTY] {locale === "sw" ? "Hakuna soko" : "No markets"} {createdMarketFilter !== "all" && `(${createdMarketFilter})`}
                          </p>
                        </div>
                      );
                    }

                    return filteredMarkets.map((market, i) => {
                      const isMultiOption = Array.isArray(market.options) && market.options.length >= 2;
                      const price = getPrice(market.yesPool, market.noPool);
                      const prices = isMultiOption && market.optionPools ? getMultiOptionPrices(market.optionPools) : [];
                      
                      return (
                        <motion.div
                          key={market.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <Link href={`/markets/${market.id}`}>
                            <div className="bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent)]/40 hover:shadow-[0_0_15px_rgba(0,229,160,0.05)] transition-all">
                              <div className="px-4 py-3">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 border border-[var(--card-border)] text-[var(--muted)] uppercase tracking-wider">
                                        [{market.category}]
                                      </span>
                                      <span className={cn(
                                        "text-[10px] font-mono font-bold px-1.5 py-0.5 border uppercase tracking-wider",
                                        market.status === "RESOLVED" 
                                          ? "border-blue-500/30 text-blue-400"
                                          : market.status === "OPEN"
                                          ? "border-[var(--accent)]/30 text-[var(--accent)]"
                                          : "border-yellow-500/30 text-yellow-400"
                                      )}>
                                        {market.status}
                                      </span>
                                    </div>
                                    <p className="font-bold text-sm line-clamp-1 leading-snug">{market.title}</p>
                                  </div>
                                </div>

                                {/* Market stats */}
                                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-[var(--card-border)]">
                                  <div>
                                    <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                      {locale === "sw" ? "Kiasi" : "Volume"}
                                    </div>
                                    <div className="text-sm font-mono font-bold tabular-nums">
                                      {formatTZS(market.totalVolume)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                      {locale === "sw" ? "Biashara" : "Trades"}
                                    </div>
                                    <div className="text-sm font-mono font-bold tabular-nums">
                                      {market._count.trades}
                                    </div>
                                  </div>
                                  {!isMultiOption && (
                                    <div>
                                      <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                        YES / NO
                                      </div>
                                      <div className="text-sm font-mono font-bold tabular-nums">
                                        {formatPercent(price.yes)} / {formatPercent(price.no)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    });
                  })()}
                  </div>
                </div>
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
                      {trades.map((tr, i) => {
                        const isSell = tr.side.startsWith("SELL_");
                        const displaySide = isSell ? tr.side.slice(5) : tr.side;
                        const displayAmount = isSell ? Math.abs(tr.amountTzs) : tr.amountTzs;
                        const displayShares = Math.abs(tr.shares);
                        return (
                        <motion.div
                          key={tr.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                        >
                          <Link href={`/markets/${tr.market.id}`}>
                            <div className="flex items-center justify-between py-2.5 px-4 bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent)]/30 transition-all">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {isSell && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold border border-[#ff4d6a]/30 text-[#ff4d6a]">
                                      SELL
                                    </span>
                                  )}
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 text-[10px] font-mono font-bold border",
                                      displaySide === "YES" ? "text-[#00e5a0] border-[#00e5a0]/30" : displaySide === "NO" ? "text-red-400 border-red-500/30" : "text-purple-400 border-purple-500/30"
                                    )}
                                  >
                                    {displaySide}
                                  </span>
                                </div>
                                <span className="text-sm font-medium line-clamp-1">{tr.market.title}</span>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <div className={cn("text-sm font-mono font-bold tabular-nums", isSell ? "text-[#ff4d6a]" : "")}>
                                  {isSell ? `+${formatTZS(displayAmount)}` : formatTZS(displayAmount)}
                                </div>
                                <div className="text-[10px] font-mono text-[var(--muted)]">{displayShares} {t.portfolio.shares}</div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                        );
                      })}
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
      <Footer />
    </div>
  );
}
