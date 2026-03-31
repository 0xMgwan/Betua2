"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Trash, Lightning } from "@phosphor-icons/react";
import { useCart } from "@/store/useCart";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useUser } from "@/store/useUser";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";

export function CartButton() {
  const { items, toggleCart } = useCart();
  const itemCount = items.length;

  if (itemCount === 0) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      onClick={toggleCart}
      className="fixed bottom-6 right-6 z-50 bg-[var(--accent)] text-[var(--background)] p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95"
    >
      <ShoppingCart size={24} weight="fill" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </motion.button>
  );
}

export function CartModal() {
  const { items, isOpen, closeCart, removeItem, updateAmount, clearCart, getTotalAmount } = useCart();
  const { locale } = useLanguage();
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Currency detection for Kenya/Tanzania users
  const userCurrency: Currency = getUserCurrency(user?.country, user?.phone);
  const isKenya = userCurrency === 'KES';
  
  // Format amount in user's currency
  const formatAmount = (amountTzs: number) => {
    if (isKenya) {
      const amountKes = convertCurrency(amountTzs, 'TZS', 'KES');
      return `KSh ${amountKes.toLocaleString()}`;
    }
    return formatTZS(amountTzs);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/trades/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: items.map((item) => ({
            marketId: item.marketId,
            side: item.side,
            // Convert KES to TZS for API if user is Kenyan
            ...(isKenya ? { amountKes: item.amount } : { amountTzs: item.amount }),
            optionIndex: item.optionIndex,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process trades");
      }

      // Success - clear cart and redirect to portfolio
      clearCart();
      closeCart();
      router.push("/portfolio");
    } catch (err: any) {
      setError(err.message || "Failed to process trades");
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
            onClick={closeCart}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Cart Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-[var(--background)] border-l border-[var(--card-border)] z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} weight="fill" className="text-[var(--accent)]" />
                <h2 className="font-mono font-bold text-lg">
                  {locale === "sw" ? "Mkoba" : "Prediction Slip"}
                </h2>
                <span className="text-xs font-mono text-[var(--muted)]">
                  ({items.length})
                </span>
              </div>
              <button
                onClick={closeCart}
                className="p-2 hover:bg-[var(--card)] rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart size={48} className="mx-auto text-[var(--muted)] mb-4" />
                  <p className="text-sm font-mono text-[var(--muted)]">
                    {locale === "sw" ? "Mkoba mtupu" : "Cart is empty"}
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    className="bg-[var(--card)] border border-[var(--card-border)] p-2 sm:p-3 rounded"
                  >
                    <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] sm:text-xs font-mono text-[var(--muted)] mb-0.5 sm:mb-1">
                          {item.category}
                        </p>
                        <p className="text-xs sm:text-sm font-bold line-clamp-2 mb-0.5 sm:mb-1">
                          {item.marketTitle}
                        </p>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--accent)] px-1.5 sm:px-2 py-0.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded">
                            {item.side}
                          </span>
                          <span className="text-[10px] sm:text-xs font-mono text-[var(--muted)]">
                            ~{item.estimatedShares.toFixed(0)} {locale === "sw" ? "hisa" : "shares"}
                          </span>
                          <span className="text-[10px] sm:text-xs font-mono text-[#00e5a0]">
                            → {formatAmount(Math.round(item.estimatedShares * 1000 * 0.95))}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-red-500/10 rounded transition-colors text-red-400"
                      >
                        <Trash size={16} />
                      </button>
                    </div>

                    {/* Amount Input */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.amount || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          updateAmount(item.id, val === '' ? 0 : Number(val));
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="100"
                        className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-xs sm:text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                      />
                      <span className="text-xs sm:text-sm font-mono font-bold whitespace-nowrap">
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-[var(--card-border)] space-y-2 sm:space-y-3">
                {error && (
                  <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs sm:text-sm text-[var(--muted)]">
                    {locale === "sw" ? "Jumla" : "Total"}
                  </span>
                  <span className="text-base sm:text-lg font-bold">
                    {formatAmount(getTotalAmount())}
                  </span>
                </div>

                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs sm:text-sm text-[var(--muted)]">
                    {locale === "sw" ? "Ukishinda" : "If correct"}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-[#00e5a0]">
                    {formatAmount(Math.round(items.reduce((sum, item) => sum + item.estimatedShares * 1000 * 0.95, 0)))}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={clearCart}
                    className="flex-1 px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)] font-mono font-bold text-sm uppercase tracking-wider hover:bg-[var(--background)] transition-all"
                  >
                    {locale === "sw" ? "Futa" : "Clear"}
                  </button>
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-[var(--accent)] text-[var(--background)] font-mono font-bold text-sm uppercase tracking-wider hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span>{locale === "sw" ? "Inachakata..." : "Processing..."}</span>
                    ) : (
                      <>
                        <Lightning size={16} weight="fill" />
                        {locale === "sw" ? "Nunua Zote" : "Buy All"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
