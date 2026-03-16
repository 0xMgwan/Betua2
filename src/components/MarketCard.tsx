"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, TrendUp, UsersThree, Lightning, Timer, ChartLineUp, ShoppingCart } from "@phosphor-icons/react";
import { formatTZS, formatNumber, timeUntil, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/store/useCart";
import { QuickBuyModal } from "./QuickBuyModal";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";

interface Market {
  id: string;
  title: string;
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  resolvesAt: string;
  status: string;
  price: { yes: number; no: number };
  options?: string[] | null;
  optionPrices?: number[] | null;
  _count?: { trades: number };
  creator?: { username: string };
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: "#f59e0b",
  Geopolitics: "#6366f1",
  Sports: "#00b4d8",
  Entertainment: "#ec4899",
  Crypto: "#00e5a0",
  Business: "#8b5cf6",
  Science: "#14b8a6",
  Weather: "#818cf8",
  Technology: "#f97316",
  Other: "#94a3b8",
};

export function MarketCard({ market, index = 0 }: { market: Market; index?: number }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { addItem, openCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [selectedDisplaySide, setSelectedDisplaySide] = useState<string | null>(null);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedOptions, setTranslatedOptions] = useState<string[] | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const yesPctRaw = market.price.yes * 100;
  const noPctRaw = market.price.no * 100;
  const yesPct = yesPctRaw % 1 === 0 ? Math.round(yesPctRaw) : parseFloat(yesPctRaw.toFixed(1));
  const noPct = noPctRaw % 1 === 0 ? Math.round(noPctRaw) : parseFloat(noPctRaw.toFixed(1));
  const isMultiOption = market.options && market.options.length >= 2;
  const catColor = CATEGORY_COLORS[market.category] || "#94a3b8";
  const hasImage = market.imageUrl && !imageError;
  const isExpired = new Date(market.resolvesAt) < new Date();
  const isTradeable = market.status === "OPEN" && !isExpired;

  // Fetch translation when locale is Swahili
  useEffect(() => {
    if (locale === "sw" && !translatedTitle && !isTranslating) {
      console.log(`[Translation] Fetching translation for market ${market.id}`);
      setIsTranslating(true);
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, language: "sw" }),
      })
        .then((r) => r.json())
        .then((data) => {
          console.log(`[Translation] Received translation:`, data);
          if (data.title) setTranslatedTitle(data.title);
          if (data.options) setTranslatedOptions(data.options);
        })
        .catch((err) => console.error("[Translation] Error:", err))
        .finally(() => setIsTranslating(false));
    } else if (locale === "en") {
      // Reset to original when switching back to English
      setTranslatedTitle(null);
      setTranslatedOptions(null);
    }
  }, [locale, market.id, translatedTitle, isTranslating]);

  // Use translated content if available, otherwise use original
  const displayTitle = locale === "sw" && translatedTitle ? translatedTitle : market.title;
  const displayOptions = locale === "sw" && translatedOptions ? translatedOptions : market.options;

  const handleQuickBuy = (e: React.MouseEvent, side: string, optionIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSide(side);
    setSelectedOptionIndex(optionIndex ?? null);
    // Set display side (translated if available)
    if (optionIndex !== undefined && displayOptions) {
      const displaySide = displayOptions[optionIndex];
      console.log('[MarketCard] Setting display side:', displaySide, 'for original:', side);
      setSelectedDisplaySide(displaySide);
    } else {
      setSelectedDisplaySide(side);
    }
    setShowBuyModal(true);
  };

  const handleAddToCart = (e: React.MouseEvent, side: string, optionIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const defaultAmount = 500; // Default amount for quick add
    let estimatedShares = 0;
    let currentPrice = 0;
    
    if (isMultiOption && optionIndex !== undefined && market.optionPrices) {
      currentPrice = market.optionPrices[optionIndex];
      // Estimate shares (simplified - actual calculation happens at checkout)
      estimatedShares = Math.round(defaultAmount / (currentPrice * 1000));
    } else {
      currentPrice = side === "YES" ? market.price.yes : market.price.no;
      estimatedShares = Math.round(defaultAmount / (currentPrice * 1000));
    }
    
    addItem({
      marketId: market.id,
      marketTitle: displayTitle,
      side: side,
      optionIndex: optionIndex,
      amount: defaultAmount,
      estimatedShares: estimatedShares,
      currentPrice: currentPrice,
      category: market.category,
      imageUrl: market.imageUrl,
    });
    
    // Don't auto-open cart - let user click cart button to view
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div 
        onClick={() => router.push(`/markets/${market.id}`)}
        className="group relative bg-[var(--card)] border border-[var(--card-border)] overflow-hidden hover:border-[var(--accent)]/60 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,229,160,0.1)] cursor-pointer"
      >
          {/* Accent top line */}
          <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${catColor}, transparent)` }} />

          <div className="p-3 sm:p-4">
            {/* Top row: Category + Status + Timer */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <a
                  href={`/markets?category=${market.category}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/markets?category=${market.category}`);
                  }}
                  className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ borderColor: `${catColor}50`, color: catColor, backgroundColor: `${catColor}10` }}
                >
                  {market.category}
                </a>
                {market.status === "RESOLVED" && (
                  <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-wider px-1.5 py-0.5 border border-blue-400/30 bg-blue-400/10">
                    Resolved
                  </span>
                )}
                {market.subCategory && (
                  <a
                    href={`/markets?category=${market.category}&subCategory=${market.subCategory}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/markets?category=${market.category}&subCategory=${market.subCategory}`);
                    }}
                    className="text-[9px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider px-1.5 py-0.5 border border-[var(--accent)]/30 bg-[var(--accent)]/10 flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    {SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)?.icon.startsWith('/') ? (
                      <Image 
                        src={SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)!.icon} 
                        alt={market.subCategory} 
                        width={10} 
                        height={10} 
                        className="object-contain" 
                      />
                    ) : (
                      <span>{SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)?.icon}</span>
                    )}
                    {market.subCategory}
                  </a>
                )}
              </div>
              <span className={cn(
                "flex items-center gap-1 text-[9px] font-mono",
                market.status === "OPEN" ? "text-[var(--muted)]" : "text-blue-400"
              )}>
                <Timer size={10} weight="bold" />
                {market.status === "OPEN" ? timeUntil(market.resolvesAt) : "Ended"}
              </span>
            </div>

            {/* Title row with optional thumbnail */}
            <div className="flex gap-3 mb-3">
              {hasImage && (
                <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 border border-[var(--card-border)] overflow-hidden relative">
                  <img
                    src={market.imageUrl!}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_4px)] pointer-events-none" />
                </div>
              )}
              <h3 className="font-mono text-[13px] sm:text-sm font-bold leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2 flex-1">
                {displayTitle}
              </h3>
            </div>

            {/* Price bars */}
            {isMultiOption ? (
              <div className="space-y-1.5 mb-3">
                {displayOptions!.map((opt, i) => {
                  const pctRaw = (market.optionPrices![i] || 0) * 100;
                  const pct = pctRaw % 1 === 0 ? Math.round(pctRaw) : parseFloat(pctRaw.toFixed(1));
                  const colors = ["#00e5a0", "#00b4d8", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];
                  const c = colors[i % colors.length];
                  return (
                    <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="w-[70px] truncate font-bold" style={{ color: c }}>
                        {opt}
                      </span>
                      <div className="flex-1 h-[6px] bg-[var(--background)] border border-[var(--card-border)]/50 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: index * 0.05 + i * 0.1 }}
                          className="h-full"
                          style={{ backgroundColor: c }}
                        />
                      </div>
                      <span className="w-8 text-right font-bold tabular-nums" style={{ color: c }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mb-3">
                {/* Combined YES/NO bar */}
                <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
                  <span className="text-[#00e5a0] font-bold">YES {yesPct}%</span>
                  <span className="text-red-400 font-bold">NO {noPct}%</span>
                </div>
                <div className="h-2 bg-[var(--background)] border border-[var(--card-border)]/50 overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${yesPct}%` }}
                    transition={{ duration: 0.6, delay: index * 0.05 }}
                    className="h-full bg-[#00e5a0] relative"
                  >
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.15)_3px,rgba(0,0,0,0.15)_4px)]" />
                  </motion.div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${noPct}%` }}
                    transition={{ duration: 0.6, delay: index * 0.05 + 0.1 }}
                    className="h-full bg-red-400/80 relative"
                  >
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,rgba(0,0,0,0.15)_3px,rgba(0,0,0,0.15)_4px)]" />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Quick Buy Buttons */}
            {isTradeable && (
              isMultiOption ? (
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {displayOptions!.slice(0, 4).map((option, idx) => {
                    const colors = ["#00e5a0", "#00b4d8", "#f59e0b", "#ef4444"];
                    const c = colors[idx % colors.length];
                    const optPrice = market.optionPrices?.[idx] || 0;
                    const pricePerShare = Math.round(optPrice * 1000);
                    const originalOption = market.options?.[idx] || option;
                    return (
                      <div key={idx} className="flex gap-1">
                        <button
                          onClick={(e) => handleQuickBuy(e, originalOption, idx)}
                          className="flex-1 py-2 px-2 border font-mono font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95"
                          style={{
                            borderColor: `${c}60`,
                            color: c,
                            backgroundColor: `${c}08`,
                          }}
                        >
                          {option.length > 8 ? option.slice(0, 8) + ".." : option} @ {pricePerShare}
                        </button>
                        <button
                          onClick={(e) => handleAddToCart(e, originalOption, idx)}
                          className="px-2 border transition-all active:scale-95 hover:bg-[var(--accent)]/10"
                          style={{
                            borderColor: `${c}60`,
                            color: c,
                          }}
                          title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
                        >
                          <ShoppingCart size={14} weight="bold" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleQuickBuy(e, "YES")}
                      className="flex-1 py-2 px-2 bg-[#00e5a0]/8 border border-[#00e5a0]/50 text-[#00e5a0] font-mono font-bold text-[10px] uppercase tracking-wider transition-all hover:bg-[#00e5a0]/15 hover:border-[#00e5a0] active:scale-[0.97]"
                    >
                      Yes @ {Math.round(market.price.yes * 1000)}
                    </button>
                    <button
                      onClick={(e) => handleAddToCart(e, "YES")}
                      className="px-2 bg-[#00e5a0]/8 border border-[#00e5a0]/50 text-[#00e5a0] transition-all hover:bg-[#00e5a0]/15 active:scale-95"
                      title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
                    >
                      <ShoppingCart size={14} weight="bold" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleQuickBuy(e, "NO")}
                      className="flex-1 py-2 px-2 bg-red-500/8 border border-red-500/50 text-red-400 font-mono font-bold text-[10px] uppercase tracking-wider transition-all hover:bg-red-500/15 hover:border-red-500 active:scale-[0.97]"
                    >
                      No @ {Math.round(market.price.no * 1000)}
                    </button>
                    <button
                      onClick={(e) => handleAddToCart(e, "NO")}
                      className="px-2 bg-red-500/8 border border-red-500/50 text-red-400 transition-all hover:bg-red-500/15 active:scale-95"
                      title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
                    >
                      <ShoppingCart size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Footer stats */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--muted)] pt-2 border-t border-[var(--card-border)]/50">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ChartLineUp size={10} weight="bold" className="text-[var(--accent)]" />
                  <img src="/ntzs.png" alt="nTZS" className="w-2.5 h-2.5 inline-block opacity-60" />
                  {market.totalVolume >= 1000000
                    ? `${(market.totalVolume / 1000000).toFixed(1)}M`
                    : market.totalVolume >= 1000
                    ? `${(market.totalVolume / 1000).toFixed(1)}K`
                    : market.totalVolume}
                </span>
                {market._count && (
                  <span className="flex items-center gap-1">
                    <Lightning size={10} weight="fill" className="text-[var(--accent)]" />
                    {market._count.trades}
                  </span>
                )}
              </div>
              {market.creator && (
                <span className="text-[var(--muted)]/70 truncate max-w-[80px]">
                  @{market.creator.username}
                </span>
              )}
            </div>
          </div>
        </div>

      {/* Quick Buy Modal */}
      {showBuyModal && selectedSide && (
        <QuickBuyModal
          isOpen={showBuyModal}
          onClose={() => {
            setShowBuyModal(false);
            setSelectedSide(null);
            setSelectedOptionIndex(null);
            setSelectedDisplaySide(null);
          }}
          market={{
            id: market.id,
            title: displayTitle,
            price: market.price,
            optionPrices: market.optionPrices || undefined,
            yesPool: market.yesPool,
            noPool: market.noPool,
            resolvesAt: market.resolvesAt,
            status: market.status,
            totalVolume: market.totalVolume,
          }}
          side={selectedSide}
          optionIndex={selectedOptionIndex ?? undefined}
          displaySide={selectedDisplaySide ?? undefined}
        />
      )}
    </motion.div>
  );
}
