"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendUp, TrendDown } from "@phosphor-icons/react";
import { formatTZS } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { notifications } from "@/lib/notifications";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";

interface QuickBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: {
    id: string;
    title: string;
    price: { yes: number; no: number };
    optionPrices?: number[];
    yesPool: number;
    noPool: number;
    optionPools?: number[];
  };
  side: string;
  optionIndex?: number;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export function QuickBuyModal({ isOpen, onClose, market, side, optionIndex }: QuickBuyModalProps) {
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fresh pool data fetched from API
  const [freshPools, setFreshPools] = useState<{
    yesPool: number;
    noPool: number;
    optionPools?: number[];
    price: { yes: number; no: number };
    optionPrices?: number[];
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
  const feeAmount = Math.round(amountNum * FEE_PERCENT);
  const tradeAmount = amountNum - feeAmount; // Net amount after 5% fee, same as trade API
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

  const handleBuy = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (!amount || Number(amount) < 500) {
      setError(locale === "sw" ? "Kiasi lazima kiwe angalau TZS 500" : "Amount must be at least TZS 500");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          side: isMultiOption ? undefined : side,
          optionIndex: isMultiOption ? optionIndex : undefined,
          amountTzs: Number(amount),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (locale === "sw" ? "Biashara imeshindwa" : "Trade failed"));
        return;
      }

      // Success - show message, send notification, and redirect after 2 seconds
      setSuccess(true);
      
      // Send push notification
      notifications.notifyTrade(market.title, side, Number(amount), market.id);
      
      setTimeout(() => {
        router.push(`/markets/${market.id}`);
        onClose();
      }, 2000);
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
                  [{locale === "sw" ? "NUNUA" : "BUY"}] {side}
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

              {/* Price Info - Terminal Style */}
              <div className="mb-4 p-3 bg-[var(--background)] border-2 border-[var(--card-border)]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Bei ya Hisa" : "Share Price"}</span>
                  <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                  <span className="font-bold tabular-nums text-[var(--accent)]">{formatTZS(Math.round(price * 1000))}</span>
                </div>
              </div>

              {/* Amount Input - Terminal Style */}
              <div className="mb-4">
                <label className="block text-[10px] font-mono font-bold text-[var(--muted)] mb-2 uppercase tracking-widest">
                  &gt; {locale === "sw" ? "Kiasi (TZS)" : "Amount (TZS)"}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-none text-sm focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_10px_rgba(0,229,160,0.2)] transition-all font-mono font-bold tabular-nums"
                  placeholder="e.g. 500"
                  min="500"
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
                    <span className="font-bold tabular-nums text-[var(--accent)]">{formatTZS(Math.round(cost))}</span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-[var(--card-border)]"></div>

                  {/* Payout if win */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Ukishinda" : "If you win"}</span>
                    <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                    <span className="font-bold tabular-nums text-[#00e5a0]">{formatTZS(shares)}</span>
                  </div>

                  {/* Potential net gain */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Faida halisi" : "Net gain"}</span>
                    <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                    <span className={`font-bold tabular-nums ${shares - cost >= 0 ? "text-[#00e5a0]" : "text-yellow-400"}`}>
                      {shares - cost >= 0 ? `+${formatTZS(shares - cost)}` : `${formatTZS(shares - cost)} (${locale === "sw" ? "ada" : "fee"})`}
                    </span>
                  </div>
                </div>
              )}

              {/* Success Message - Terminal Style */}
              {success && (
                <div className="mb-4 p-4 bg-[#00e5a0]/10 border-2 border-[#00e5a0] shadow-[0_0_20px_rgba(0,229,160,0.3)]">
                  <div className="flex items-center gap-2 text-[#00e5a0] mb-2 font-mono">
                    <span className="text-lg">✓</span>
                    <span className="font-bold uppercase tracking-wider">
                      {locale === "sw" ? "Imefanikiwa!" : "Success!"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--foreground)]">
                    {locale === "sw" 
                      ? `Umenunua hisa ${shares} za ${side}. Unaelekezwa...`
                      : `Bought ${shares} ${side} shares. Redirecting...`}
                  </p>
                </div>
              )}

              {/* Error - Terminal Style */}
              {error && !success && (
                <div className="mb-4 p-3 bg-red-500/10 border-2 border-red-500 text-red-400 text-xs font-mono shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  <span className="font-bold">ERROR:</span> {error}
                </div>
              )}

              {/* Actions - Terminal Style */}
              {!success && (
                <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-2 border-t-2 border-[var(--card-border)]">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 sm:py-3 px-3 sm:px-4 border-2 border-[var(--card-border)] rounded-none font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider hover:bg-[var(--background)] hover:border-[var(--accent)]/40 transition-all active:scale-95"
                  >
                    {locale === "sw" ? "Ghairi" : "Cancel"}
                  </button>
                  <button
                    onClick={handleBuy}
                    disabled={loading || !amount || Number(amount) < 500}
                    className={`flex-1 py-3 sm:py-3 px-3 sm:px-4 rounded-none font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all disabled:opacity-40 border-2 active:scale-95 ${
                      isMultiOption
                        ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/20 hover:shadow-[0_0_15px_rgba(0,229,160,0.3)]"
                        : side === "YES"
                        ? "bg-[#00e5a0]/10 border-[#00e5a0] text-[#00e5a0] hover:bg-[#00e5a0]/20 hover:shadow-[0_0_15px_rgba(0,229,160,0.3)]"
                        : "bg-red-500/10 border-red-500 text-red-400 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    }`}
                  >
                    {loading
                      ? (locale === "sw" ? "Inaendelea..." : "Processing...")
                      : `> ${locale === "sw" ? "Nunua" : "Buy"} ${isMultiOption ? side.slice(0, 10) : side}`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
