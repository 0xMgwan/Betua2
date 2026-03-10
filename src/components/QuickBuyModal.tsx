"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendUp, TrendDown } from "@phosphor-icons/react";
import { formatTZS } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";

interface QuickBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: {
    id: string;
    title: string;
    price: { yes: number; no: number };
  };
  side: "YES" | "NO";
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export function QuickBuyModal({ isOpen, onClose, market, side }: QuickBuyModalProps) {
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const price = side === "YES" ? market.price.yes : market.price.no;
  const shares = amount ? Math.floor(Number(amount) / price) : 0;
  const cost = shares * price;

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
          side,
          amountTzs: Number(amount),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || (locale === "sw" ? "Biashara imeshindwa" : "Trade failed"));
        return;
      }

      // Success - show message and redirect after 2 seconds
      setSuccess(true);
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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--card)] border border-[var(--card-border)] rounded-2xl shadow-2xl z-50 p-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                {side === "YES" ? (
                  <TrendUp size={24} className="text-[#00e5a0]" weight="bold" />
                ) : (
                  <TrendDown size={24} className="text-red-400" weight="bold" />
                )}
                <div>
                  <h3 className="font-bold text-lg">
                    {locale === "sw" ? "Nunua" : "Buy"} {side}
                  </h3>
                  <p className="text-xs text-[var(--muted)] line-clamp-1">{market.title}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[var(--background)] rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Price Info */}
            <div className="mb-4 p-3 bg-[var(--background)] rounded-xl">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">{locale === "sw" ? "Bei ya Hisa" : "Share Price"}</span>
                <span className="font-bold">{formatTZS(Math.round(price * 1000))}</span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">
                {locale === "sw" ? "Kiasi (TZS)" : "Amount (TZS)"}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors font-medium"
                placeholder="e.g. 500"
                min="500"
              />
            </div>

            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(String(a))}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    amount === String(a)
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--card-border)] hover:border-[var(--accent)]/40 text-[var(--muted)]"
                  }`}
                >
                  {a >= 1000 ? `${a / 1000}K` : a}
                </button>
              ))}
            </div>

            {/* Shares Estimate */}
            {shares > 0 && (
              <div className="mb-4 p-3 bg-[var(--background)] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{locale === "sw" ? "Hisa" : "Shares"}</span>
                  <span className="font-bold">~{shares}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{locale === "sw" ? "Gharama" : "Cost"}</span>
                  <span className="font-bold">{formatTZS(Math.round(cost))}</span>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-4 bg-[#00e5a0]/10 border border-[#00e5a0]/20 rounded-xl">
                <div className="flex items-center gap-2 text-[#00e5a0] mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-bold">
                    {locale === "sw" ? "Imefanikiwa!" : "Success!"}
                  </span>
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  {locale === "sw" 
                    ? `Umenunua hisa ${shares} za ${side}. Unaelekezwa...`
                    : `Bought ${shares} ${side} shares. Redirecting...`}
                </p>
              </div>
            )}

            {/* Error */}
            {error && !success && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            {!success && (
              <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 border border-[var(--card-border)] rounded-xl font-semibold text-sm hover:bg-[var(--background)] transition-colors"
              >
                {locale === "sw" ? "Ghairi" : "Cancel"}
              </button>
              <button
                onClick={handleBuy}
                disabled={loading || !amount || Number(amount) < 500}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 ${
                  side === "YES"
                    ? "bg-[#00e5a0] text-black hover:opacity-90"
                    : "bg-red-500 text-white hover:opacity-90"
                }`}
              >
                {loading
                  ? (locale === "sw" ? "Inaendelea..." : "Processing...")
                  : (locale === "sw" ? "Nunua" : "Buy") + ` ${side}`}
              </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
