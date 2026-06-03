"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendUp, TrendDown, ShoppingCart, CheckCircle, XCircle, WhatsappLogo, TelegramLogo, XLogo } from "@phosphor-icons/react";
import { formatTZS } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";
import { useCurrency } from "@/store/useCurrency";
import { useCart } from "@/store/useCart";
import { notifications } from "@/lib/notifications";
import { getSharesOut, getMultiOptionSharesOut, getPrice, getMultiOptionPrices } from "@/lib/amm";

interface QuickBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  market: {
    id: string;
    title: string;
    category?: string;
    price: { yes: number; no: number };
    optionPrices?: number[];
    yesPool: number;
    noPool: number;
    optionPools?: number[];
    resolvesAt?: string;
    status?: string;
    totalVolume?: number;
    totalYesShares?: number;
    totalNoShares?: number;
    totalOptionShares?: Record<string, number>;
  };
  side: string;
  optionIndex?: number;
  displaySide?: string;
}

const QUICK_AMOUNTS_TZS = [500, 1000, 2000, 5000, 10000];
const QUICK_AMOUNTS_KES = [50, 100, 200, 500, 1000];

export function QuickBuyModal({ isOpen, onClose, onSuccess, market, side, optionIndex, displaySide }: QuickBuyModalProps) {
  console.log('[QuickBuyModal] Received - side:', side, 'displaySide:', displaySide, 'optionIndex:', optionIndex);
  
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const { addItem, openCart } = useCart();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sharePayload, setSharePayload] = useState<{
    label: string; shares: number; amountTzs: number; payoutIfWin: number; oddsPrice: number;
  } | null>(null);
  
  // Hedge calculator state
  const [showHedge, setShowHedge] = useState(false);
  const [hedgeExposure, setHedgeExposure] = useState("");
  const [hedgeCurrency, setHedgeCurrency] = useState<"TZS"|"USD"|"EUR"|"GBP"|"AED"|"KES"|"CNY">("USD");
  const [hedgeCoverage, setHedgeCoverage] = useState(50);

  const isExpired = market.resolvesAt ? new Date(market.resolvesAt) < new Date() : false;
  const isResolved = market.status === "RESOLVED";
  const isTradeable = !isExpired && !isResolved;
  
  // Global currency preference
  const { format: formatAmount, currency: displayCurrency, fromDisplay } = useCurrency();
  const QUICK_AMOUNTS = displayCurrency === 'USDC' 
    ? [1, 2, 5, 10, 20] // USDC amounts
    : displayCurrency === 'KES'
    ? QUICK_AMOUNTS_KES
    : QUICK_AMOUNTS_TZS;
  const minAmount = displayCurrency === 'USDC' ? 0.5 : displayCurrency === 'KES' ? 50 : 500;

  // Fresh pool data fetched from API
  const [freshPools, setFreshPools] = useState<{
    yesPool: number;
    noPool: number;
    optionPools?: number[];
    price: { yes: number; no: number };
    optionPrices?: number[];
    totalVolume?: number;
    totalYesShares?: number;
    totalNoShares?: number;
    totalOptionShares?: Record<string, number>;
  } | null>(null);

  // Fetch fresh market data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await fetch(`/api/markets/${market.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const m = data.market;
        if (m) {
          setFreshPools({
            yesPool: m.yesPool,
            noPool: m.noPool,
            optionPools: m.optionPools || undefined,
            price: m.price,
            optionPrices: m.optionPrices || undefined,
            totalVolume: m.totalVolume || 0,
            totalYesShares: m.totalYesShares || 0,
            totalNoShares: m.totalNoShares || 0,
            totalOptionShares: m.totalOptionShares || undefined,
          });
        }
      } catch { /* use fallback props */ }
    })();
  }, [isOpen, market.id]);

  const isMultiOption = optionIndex !== undefined;
  const pools = freshPools || market;
  const price = isMultiOption && pools.optionPrices
    ? pools.optionPrices[optionIndex]
    : side === "YES" ? pools.price.yes : pools.price.no;

  // Use real AMM formula for accurate share estimates (matching trade API)
  const FEE_PERCENT = 0.05;
  const amountNum = Number(amount) || 0;
  // Convert user input to TZS for AMM calculations
  const amountInTzs = fromDisplay(amountNum);
  const feeAmount = Math.round(amountInTzs * FEE_PERCENT);
  const tradeAmount = amountInTzs - feeAmount; // Net amount after 5% fee, same as trade API
  let shares = 0;
  let avgPrice = 0;
  if (tradeAmount > 0) {
    if (isMultiOption && pools.optionPools && pools.optionPools.length > 0) {
      const result = getMultiOptionSharesOut(tradeAmount, optionIndex!, pools.optionPools);
      shares = Math.round(result.shares);
      avgPrice = result.avgPrice;
    } else {
      // Match trade API pool order: YES => (noPool, yesPool), NO => (yesPool, noPool)
      const result =
        side === "YES"
          ? getSharesOut(tradeAmount, pools.noPool, pools.yesPool)
          : getSharesOut(tradeAmount, pools.yesPool, pools.noPool);
      if (result.shares > 0) {
        shares = Math.round(result.shares);
        avgPrice = result.avgPrice;
      }
    }
  }
  const cost = amountNum;

  // Price-based payout: standard prediction market display
  // Shows what you'd win at current market odds (netAmount / probability × (1 - settlement fee))
  const netAmountIn = Math.round(amountInTzs * (1 - FEE_PERCENT));
  let currentOddsPrice: number;
  if (isMultiOption && pools.optionPools && pools.optionPools.length > 0) {
    const prices = getMultiOptionPrices(pools.optionPools);
    currentOddsPrice = prices[optionIndex ?? 0] ?? 0.5;
  } else {
    const prices = getPrice(pools.yesPool, pools.noPool);
    currentOddsPrice = side === "YES" ? prices.yes : prices.no;
  }
  const payoutIfWin = currentOddsPrice > 0
    ? Math.round(netAmountIn / currentOddsPrice * (1 - FEE_PERCENT))
    : 0;
  const netGain = payoutIfWin - amountNum;

  const handleAddToCart = () => {
    if (!amount || Number(amount) < minAmount) {
      const currLabel = displayCurrency === 'USDC' ? '$' : 'TSh';
      setError(locale === "sw" ? `Kiasi lazima kiwe angalau ${currLabel}${minAmount}` : `Amount must be at least ${currLabel}${minAmount}`);
      return;
    }

    addItem({
      marketId: market.id,
      marketTitle: market.title,
      side: side,
      optionIndex: optionIndex,
      amount: amountInTzs, // Store in TZS internally
      estimatedShares: shares,
      currentPrice: price,
      category: "Market",
    });

    onClose();
    openCart();
  };

  const handleBuy = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (!amount || Number(amount) < minAmount) {
      const currLabel = displayCurrency === 'USDC' ? '$' : 'TSh';
      setError(locale === "sw" ? `Kiasi lazima kiwe angalau ${currLabel}${minAmount}` : `Amount must be at least ${currLabel}${minAmount}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Send amountUsdc as float when USDC selected, otherwise amountTzs
      const tradeBody = {
        marketId: market.id,
        side: isMultiOption ? undefined : side,
        optionIndex: isMultiOption ? optionIndex : undefined,
        ...(displayCurrency === 'USDC' 
          ? { amountUsdc: amountNum } // Send as float (e.g., 1.50)
          : { amountTzs: amountInTzs }),
      };
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (locale === "sw" ? "Biashara imeshindwa" : "Trade failed"));
        return;
      }

      // Build share payload
      const oddsPrice = data.oddsPrice ?? (isMultiOption
        ? (getMultiOptionPrices(market.optionPools as number[])[optionIndex ?? 0] ?? 0.5)
        : (side === "YES" ? market.price.yes : market.price.no));
      setSharePayload({
        label: displaySide || side,
        shares: Math.round(data.shares),
        amountTzs: amountInTzs,
        payoutIfWin: data.payoutIfWin ?? 0,
        oddsPrice,
      });

      setSuccess(true);
      notifications.notifyTrade(market.title, side, Number(amount), market.id, locale);
      onSuccess?.();
    } catch (err) {
      setError(locale === "sw" ? "Kosa la mtandao" : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal - Terminal Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-full max-w-md bg-[var(--card)] border-2 border-[var(--accent)] rounded-none shadow-[0_0_30px_rgba(0,229,160,0.2)] z-50 overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Terminal Header Bar */}
            <div className="bg-[var(--background)] border-b-2 border-[var(--card-border)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70"></div>
                  <div className="w-3 h-3 rounded-full bg-[var(--accent)]/70"></div>
                </div>
                <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  [{locale === "sw" ? "NUNUA" : "BUY"}] {displaySide || side}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[var(--card)] transition-colors"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            {/* Scanline effect */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)] pointer-events-none"></div>

            <div className="p-4 sm:p-6 relative">
              {/* Market Title with cursor */}
              <div className="mb-3 sm:mb-4 font-mono text-xs sm:text-sm">
                <span className="text-[var(--accent)]">$</span> {market.title}
                <span className="inline-block w-2 h-3 sm:h-4 bg-[var(--accent)] ml-1 animate-pulse"></span>
              </div>

              {!success && <>
              {/* Price Info - Terminal Style */}
              <div className="mb-4 p-3 bg-[var(--background)] border-2 border-[var(--card-border)]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Bei ya Hisa" : "Share Price"}</span>
                  <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                  <span className="font-bold tabular-nums text-[var(--accent)]">{formatAmount(Math.round(price * 1000))}</span>
                </div>
              </div>

              {/* Amount Input - Terminal Style */}
              <div className="mb-4">
                <label className="block text-[10px] font-mono font-bold text-[var(--muted)] mb-2 uppercase tracking-widest">
                  &gt; {locale === "sw" ? `Kiasi (${displayCurrency})` : `Amount (${displayCurrency})`}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_10px_rgba(0,229,160,0.2)] transition-all font-mono font-bold tabular-nums"
                  placeholder={displayCurrency === 'USDC' ? "e.g. 5" : "e.g. 500"}
                  min={minAmount}
                  step={displayCurrency === 'USDC' ? "0.01" : "1"}
                />
              </div>

              {/* Quick Amounts - Terminal Style */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className={`py-2 text-xs font-mono font-bold rounded-none border-2 transition-all uppercase ${
                      amount === String(a)
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-[0_0_10px_rgba(0,229,160,0.2)]"
                        : "border-[var(--card-border)] hover:border-[var(--accent)]/40 text-[var(--muted)] hover:shadow-[0_0_5px_rgba(0,229,160,0.1)]"
                    }`}
                  >
                    {a >= 1000 ? `${a / 1000}K` : a}
                  </button>
                ))}
              </div>

              {/* Shares Estimate - Terminal Style */}
              {shares > 0 && (
                <div className="mb-4 p-3 bg-[var(--background)] border-2 border-[var(--card-border)] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Hisa" : "Shares"}</span>
                    <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                    <span className="font-bold tabular-nums">~{shares}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Gharama" : "Cost"}</span>
                    <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                    <span className="font-bold tabular-nums text-[var(--accent)]">{displayCurrency === 'USDC' ? `$${cost.toFixed(2)}` : formatTZS(Math.round(cost))}</span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-[var(--card-border)]"></div>

                  {/* Payout if win */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Ukishinda" : "If you win"}</span>
                    <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                    <span className="font-bold tabular-nums text-[#00e5a0]">{formatAmount(payoutIfWin)}</span>
                  </div>
                </div>
              )}

              {/* ── Hedge Calculator (FX & Commodities only) ── */}
              {market.category === "FX & Commodities" && !isMultiOption && !success && (() => {
                // TZS conversion rates (approximate mid-market)
                const RATES: Record<string, number> = { TZS: 1, USD: 2630, EUR: 2850, GBP: 3320, AED: 716, KES: 20, CNY: 362 };
                const rate = RATES[hedgeCurrency] ?? 2630;
                const yesPriceNow = pools.price.yes;
                const noPriceNow  = pools.price.no;

                const exposureAmt = parseFloat(hedgeExposure) || 0;
                // Full TZS equivalent of the exposure
                const exposureTzs = Math.round(exposureAmt * rate);
                // Coverage: what % of the exposure the user wants to insure
                const coverageTzs = Math.round(exposureTzs * hedgeCoverage / 100);

                // Correct formula:
                // target payout = coverageTzs
                // payoutIfWin  = grossCost × (1−fee)² / oddsPrice
                // → grossCost   = coverageTzs × oddsPrice / (1−fee)²
                const feeSq = (1 - FEE_PERCENT) ** 2;
                const yesCostGross = yesPriceNow > 0 ? Math.round(coverageTzs * yesPriceNow / feeSq) : 0;
                const noCostGross  = noPriceNow  > 0 ? Math.round(coverageTzs * noPriceNow  / feeSq) : 0;
                // Payout = coverage target (what they receive if the market resolves in their favour)
                const yesPayoutFinal = coverageTzs;
                const noPayoutFinal  = coverageTzs;

                const sw = locale === "sw";
                const CURRENCIES = ["TZS","USD","EUR","GBP","AED","KES","CNY"] as const;
                const coverageHint = hedgeCoverage === 100
                  ? (sw ? "Ulinzi kamili wa hasara yako" : "Full coverage of your exposure")
                  : hedgeCoverage <= 10
                  ? (sw ? "Bafa ndogo tu" : "Just a small buffer")
                  : `${hedgeCoverage}% ${sw ? "ya mwanga wako" : "of your exposure"}`;

                return (
                  <div className="mb-4 border-2 border-orange-500/30 bg-orange-500/5">
                    {/* Header toggle */}
                    <button
                      type="button"
                      onClick={() => setShowHedge(!showHedge)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono font-bold text-orange-400 uppercase tracking-wider hover:bg-orange-500/10 transition-colors"
                    >
                      <span>⚖ {sw ? "KIKOKOTOO CHA HEDGING" : "HEDGE CALCULATOR"}</span>
                      <span>{showHedge ? "▲" : "▼"}</span>
                    </button>

                    {showHedge && (
                      <div className="px-3 pb-3 space-y-3 border-t border-orange-500/20">

                        {/* Exposure input + currency selector */}
                        <div className="pt-2">
                          <label className="block text-[9px] font-mono text-[var(--muted)] mb-1 uppercase tracking-wider">
                            {sw ? "Mwanga wangu" : "My exposure"}
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={hedgeExposure}
                              onChange={(e) => setHedgeExposure(e.target.value)}
                              placeholder="e.g. 500"
                              className="flex-1 min-w-0 px-2 py-1.5 bg-[var(--background)] border-2 border-orange-500/20 text-sm font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                            />
                            <select
                              value={hedgeCurrency}
                              onChange={(e) => setHedgeCurrency(e.target.value as typeof hedgeCurrency)}
                              className="px-2 py-1.5 bg-[var(--card)] border-2 border-orange-500/30 text-[10px] font-mono font-bold text-orange-400 focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
                              style={{ appearance: "none", WebkitAppearance: "none" }}
                            >
                              {CURRENCIES.map(c => (
                                <option key={c} value={c} style={{ background: "var(--card)", color: c === hedgeCurrency ? "#fb923c" : "var(--foreground)" }}>{c}</option>
                              ))}
                            </select>
                          </div>
                          {exposureAmt > 0 && hedgeCurrency !== "TZS" && (
                            <p className="text-[9px] font-mono text-[var(--muted)] mt-1">
                              ≈ TSh {exposureTzs.toLocaleString()} {sw ? "kwa kiwango cha sasa" : "at current rate"}
                            </p>
                          )}
                        </div>

                        {/* Coverage slider */}
                        {exposureAmt > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                {sw ? "Kiwango cha ulinzi" : "Coverage level"}
                              </label>
                              <span className="text-[10px] font-mono font-bold text-orange-400">{hedgeCoverage}%</span>
                            </div>
                            <input
                              type="range"
                              min={5}
                              max={100}
                              step={5}
                              value={hedgeCoverage}
                              onChange={(e) => setHedgeCoverage(Number(e.target.value))}
                              className="w-full accent-orange-400 h-1.5 cursor-pointer"
                            />
                            <p className="text-[9px] font-mono text-[var(--muted)] mt-1">{coverageHint}</p>
                            <p className="text-[9px] font-mono text-orange-400/80 mt-0.5">
                              {sw ? "Kulinda kila kitu? Sogeza hadi 100%." : "Hedge everything? Move to 100%."}{" "}
                              {sw ? "Bafa ndogo tu? Sogeza hadi 10%." : "Just a small buffer? Move to 10%."}
                            </p>
                          </div>
                        )}

                        {/* YES / NO hedge blocks */}
                        {exposureAmt > 0 && coverageTzs > 0 && (
                          <div className="space-y-2">
                            {/* BUY YES */}
                            <div className="p-2 bg-[var(--background)] border border-[#00e5a0]/20 space-y-1">
                              <div className="text-[9px] font-mono font-bold text-[#00e5a0] uppercase mb-1">
                                {sw ? "NUNUA NDIYO (Hedge)" : "BUY YES hedge"}
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                                <span className="text-[var(--muted)]">{sw ? "Gharama" : "Total cost"}</span>
                                <span className="text-right font-bold">TSh {yesCostGross.toLocaleString()}</span>
                                <span className="text-[var(--muted)]">{sw ? "Malipo kama NDIYO" : "Payout if YES wins"}</span>
                                <span className="text-right font-bold text-[#00e5a0]">TSh {yesPayoutFinal.toLocaleString()}</span>
                                <span className="text-[var(--muted)]">{sw ? "Ada ya bima" : "Insurance premium"}</span>
                                <span className="text-right text-orange-400">TSh {yesCostGross.toLocaleString()}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setAmount(String(yesCostGross)); setShowHedge(false); }}
                                className="w-full mt-1.5 py-1.5 bg-[#00e5a0] text-black text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                              >
                                {sw ? "Tumia → Nunua NDIYO" : "Apply → Buy YES"}
                              </button>
                            </div>

                            {/* BUY NO */}
                            <div className="p-2 bg-[var(--background)] border border-red-500/20 space-y-1">
                              <div className="text-[9px] font-mono font-bold text-red-400 uppercase mb-1">
                                {sw ? "NUNUA HAPANA (Hedge)" : "BUY NO hedge"}
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                                <span className="text-[var(--muted)]">{sw ? "Gharama" : "Total cost"}</span>
                                <span className="text-right font-bold">TSh {noCostGross.toLocaleString()}</span>
                                <span className="text-[var(--muted)]">{sw ? "Malipo kama HAPANA" : "Payout if NO wins"}</span>
                                <span className="text-right font-bold text-red-400">TSh {noPayoutFinal.toLocaleString()}</span>
                                <span className="text-[var(--muted)]">{sw ? "Ada ya bima" : "Insurance premium"}</span>
                                <span className="text-right text-orange-400">TSh {noCostGross.toLocaleString()}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setAmount(String(noCostGross)); setShowHedge(false); }}
                                className="w-full mt-1.5 py-1.5 bg-red-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                              >
                                {sw ? "Tumia → Nunua HAPANA" : "Apply → Buy NO"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              </>}

              {/* Success / Share Block */}
              {success && sharePayload && (() => {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guap.gold";
                const marketUrl = `${appUrl}/markets/${market.id}`;
                const odds = `${Math.round(sharePayload.oddsPrice * 100)}%`;
                const betStr = formatTZS(sharePayload.amountTzs);
                const msg = `🔥 I just bet ${betStr} on *${sharePayload.label}* — "${market.title}"\nOdds: ${odds} | Payout if correct: ${formatTZS(sharePayload.payoutIfWin)}\n\nJoin me on Guap 👇\n${marketUrl}`;
                const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(marketUrl)}&text=${encodeURIComponent(`🔥 I just bet ${betStr} on ${sharePayload.label} — "${market.title}". Odds: ${odds}. Join me on Guap!`)}`;
                const xUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🔥 I just bet ${betStr} on "${market.title}" — ${sharePayload.label} @ ${odds}. Join me on Guap 👇`)}&url=${encodeURIComponent(marketUrl)}`;
                return (
                  <div className="mb-4 space-y-3">
                    {/* Confirmed bar */}
                    <div className="p-3 bg-[#00e5a0]/10 border-2 border-[#00e5a0] shadow-[0_0_20px_rgba(0,229,160,0.2)]">
                      <div className="flex items-center gap-2 text-[#00e5a0] mb-2 font-mono">
                        <CheckCircle size={16} weight="fill" />
                        <span className="font-bold uppercase tracking-wider text-xs">Trade Confirmed</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                        <div className="bg-[var(--background)] border border-[var(--card-border)] p-2 text-center">
                          <p className="text-[var(--muted)] uppercase mb-1">You bet</p>
                          <p className="font-bold text-[var(--foreground)]">{betStr}</p>
                        </div>
                        <div className="bg-[var(--background)] border border-[var(--accent)]/30 p-2 text-center">
                          <p className="text-[var(--muted)] uppercase mb-1">Position</p>
                          <p className="font-bold text-[var(--accent)] truncate">{sharePayload.label}</p>
                        </div>
                        <div className="bg-[var(--background)] border border-[var(--card-border)] p-2 text-center">
                          <p className="text-[var(--muted)] uppercase mb-1">Odds</p>
                          <p className="font-bold text-[var(--foreground)]">{odds}</p>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-[var(--background)] border border-[var(--accent)]/20 flex items-center justify-between font-mono text-[10px]">
                        <span className="text-[var(--muted)] uppercase">If correct, you get</span>
                        <div className="text-right">
                          <span className="font-black text-[#00e5a0]">{formatTZS(sharePayload.payoutIfWin)}</span>
                          <span className={`ml-2 ${sharePayload.payoutIfWin > sharePayload.amountTzs ? "text-[#00e5a0]" : "text-[var(--muted)]"}`}>
                            ({sharePayload.payoutIfWin > sharePayload.amountTzs ? "+" : ""}{formatTZS(sharePayload.payoutIfWin - sharePayload.amountTzs)})
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Share row */}
                    <div>
                      <p className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-mono mb-1.5">Share your call 🔥</p>
                      <div className="grid grid-cols-3 gap-2">
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1 py-2.5 border border-[#25D366]/30 bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors">
                          <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" />
                          <span className="text-[9px] font-mono font-bold text-[#25D366]">WhatsApp</span>
                        </a>
                        <a href={tgUrl} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1 py-2.5 border border-[#229ED9]/30 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 transition-colors">
                          <TelegramLogo size={18} weight="fill" className="text-[#229ED9]" />
                          <span className="text-[9px] font-mono font-bold text-[#229ED9]">Telegram</span>
                        </a>
                        <a href={xUrl} target="_blank" rel="noopener noreferrer"
                          className="flex flex-col items-center gap-1 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                          <XLogo size={18} weight="fill" className="text-white" />
                          <span className="text-[9px] font-mono font-bold text-white">X / Twitter</span>
                        </a>
                      </div>
                    </div>
                    <button onClick={onClose}
                      className="w-full py-2 font-mono text-[10px] font-bold text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--card-border)] uppercase tracking-widest transition-colors">
                      CLOSE
                    </button>
                  </div>
                );
              })()}

              {/* Error - Terminal Style */}
              {error && !success && (
                <div className="mb-4 p-3 bg-red-500/10 border-2 border-red-500 text-red-400 text-xs font-mono shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  <span className="font-bold">ERROR:</span> {error}
                </div>
              )}

              {/* Actions - Terminal Style */}
              {!success && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddToCart}
                      disabled={!amount || Number(amount) < minAmount || !isTradeable}
                      className="flex-1 py-3 px-3 border-2 border-[var(--accent)]/50 text-[var(--accent)] rounded-none font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-[var(--accent)]/10 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={14} weight="fill" />
                      {locale === "sw" ? "Ongeza" : "Add to Cart"}
                    </button>
                    <button
                      onClick={handleBuy}
                      disabled={loading || !amount || Number(amount) < minAmount || !isTradeable}
                      className={`flex-1 py-3 px-3 rounded-none font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all disabled:opacity-40 border-2 active:scale-95 ${
                        isMultiOption
                          ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/20 hover:shadow-[0_0_15px_rgba(0,229,160,0.3)]"
                        : side === "YES"
                        ? "bg-[#00e5a0]/10 border-[#00e5a0] text-[#00e5a0] hover:bg-[#00e5a0]/20 hover:shadow-[0_0_15px_rgba(0,229,160,0.3)]"
                        : "bg-red-500/10 border-red-500 text-red-400 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    }`}
                  >
                    {!isTradeable
                      ? (isResolved 
                          ? (locale === "sw" ? "Limetatuliwa" : "Resolved")
                          : (locale === "sw" ? "Limeisha" : "Expired"))
                      : loading
                      ? (locale === "sw" ? "Inaendelea..." : "Processing...")
                      : `> ${locale === "sw" ? "Nunua" : "Buy"} ${isMultiOption ? (displaySide || side).slice(0, 10) : (displaySide || side)}`}
                  </button>
                </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
