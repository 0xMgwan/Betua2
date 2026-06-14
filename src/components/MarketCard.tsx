"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, TrendUp, UsersThree, Lightning, Timer, ChartLineUp, ShoppingCart, Check, QrCode } from "@phosphor-icons/react";
import { formatTZS, formatNumber, timeUntil, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/store/useCart";
import { useUser } from "@/store/useUser";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";
import { useCurrency } from "@/store/useCurrency";
import { QuickBuyModal } from "./QuickBuyModal";
import { QRCodeModal } from "./QRCodeModal";
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
  fxRate?: number | null;
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

export function MarketCard({ market, index = 0, hero = false }: { market: Market; index?: number; hero?: boolean }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { addItem, openCart } = useCart();
  const { user } = useUser();
  
  // Global currency preference
  const { currency: displayCurrency, format } = useCurrency();
  
  // Format price in user's preferred currency (TZS price * 1000 for display)
  const formatPrice = (priceRatio: number) => {
    const priceTzs = Math.round(priceRatio * 1000);
    if (displayCurrency === 'USDC') {
      const priceUsdc = priceTzs / 2630;
      return `$${priceUsdc.toFixed(2)}`;
    }
    if (displayCurrency === 'KES') {
      const priceKes = Math.round(priceTzs / 18.5);
      return `KES ${priceKes.toLocaleString()}`;
    }
    return `TSh ${priceTzs.toLocaleString()}`;
  };
  const [imageError, setImageError] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [selectedDisplaySide, setSelectedDisplaySide] = useState<string | null>(null);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedOptions, setTranslatedOptions] = useState<string[] | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [cartAdded, setCartAdded] = useState<string | null>(null); // Track which option was just added

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
      // Estimate shares: amount / price (price is 0–1 decimal)
      estimatedShares = currentPrice > 0 ? Math.round(defaultAmount / currentPrice) : defaultAmount * 2;
    } else {
      currentPrice = side === "YES" ? market.price.yes : market.price.no;
      estimatedShares = currentPrice > 0 ? Math.round(defaultAmount / currentPrice) : defaultAmount * 2;
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
    
    // Show visual feedback
    const key = optionIndex !== undefined ? `${side}-${optionIndex}` : side;
    setCartAdded(key);
    setTimeout(() => setCartAdded(null), 1500);
  };

  // Shared big-bold odds buttons (used by both normal and hero layouts)
  const buyButtons = isTradeable && (
    isMultiOption ? (
      <div className="grid grid-cols-2 gap-2 mb-2">
        {displayOptions!.slice(0, 4).map((option, idx) => {
          const colors = ["#00e5a0", "#00b4d8", "#f59e0b", "#ef4444"];
          const c = colors[idx % colors.length];
          const optPrice = market.optionPrices?.[idx] || 0;
          const originalOption = market.options?.[idx] || option;
          const isAdded = cartAdded === `${originalOption}-${idx}`;
          return (
            <div key={idx} className="relative">
              <button
                onClick={(e) => handleQuickBuy(e, originalOption, idx)}
                className="w-full py-3.5 px-3 border-2 font-mono transition-all active:scale-[0.97] flex flex-col items-center gap-0.5"
                style={{ borderColor: `${c}55`, color: c, backgroundColor: `${c}12` }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 truncate max-w-full">
                  {option.length > 10 ? option.slice(0, 10) + ".." : option}
                </span>
                <span className="text-xl font-black leading-none">{optPrice > 0 ? (1 / optPrice).toFixed(1) : '∞'}<span className="text-xs">x</span></span>
              </button>
              <button
                onClick={(e) => handleAddToCart(e, originalOption, idx)}
                className="absolute top-1 right-1 p-1 border transition-all active:scale-95"
                style={{ borderColor: isAdded ? '#00e5a0' : `${c}55`, color: isAdded ? '#000' : c, backgroundColor: isAdded ? '#00e5a0' : 'var(--background)' }}
                title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
              >
                {isAdded ? <Check size={12} weight="bold" /> : <ShoppingCart size={12} weight="bold" />}
              </button>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="relative">
          <button
            onClick={(e) => handleQuickBuy(e, "YES")}
            className="w-full py-3.5 px-3 bg-[#00e5a0]/10 border-2 border-[#00e5a0]/50 text-[#00e5a0] font-mono transition-all hover:bg-[#00e5a0]/20 hover:border-[#00e5a0] active:scale-[0.97] flex flex-col items-center gap-0.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">YES</span>
            <span className="text-xl font-black leading-none">{(1 / market.price.yes).toFixed(2)}<span className="text-xs">x</span></span>
          </button>
          <button
            onClick={(e) => handleAddToCart(e, "YES")}
            className={`absolute top-1 right-1 p-1 border transition-all active:scale-95 ${cartAdded === 'YES' ? 'bg-[#00e5a0] border-[#00e5a0] text-black' : 'bg-[var(--background)]/60 border-[#00e5a0]/40 text-[#00e5a0] hover:bg-[#00e5a0]/15'}`}
            title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
          >
            {cartAdded === 'YES' ? <Check size={12} weight="bold" /> : <ShoppingCart size={12} weight="bold" />}
          </button>
        </div>
        <div className="relative">
          <button
            onClick={(e) => handleQuickBuy(e, "NO")}
            className="w-full py-3.5 px-3 bg-red-500/10 border-2 border-red-500/50 text-red-400 font-mono transition-all hover:bg-red-500/20 hover:border-red-500 active:scale-[0.97] flex flex-col items-center gap-0.5"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">NO</span>
            <span className="text-xl font-black leading-none">{(1 / market.price.no).toFixed(2)}<span className="text-xs">x</span></span>
          </button>
          <button
            onClick={(e) => handleAddToCart(e, "NO")}
            className={`absolute top-1 right-1 p-1 border transition-all active:scale-95 ${cartAdded === 'NO' ? 'bg-[#00e5a0] border-[#00e5a0] text-black' : 'bg-[var(--background)]/60 border-red-500/40 text-red-400 hover:bg-red-500/15'}`}
            title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
          >
            {cartAdded === 'NO' ? <Check size={12} weight="bold" /> : <ShoppingCart size={12} weight="bold" />}
          </button>
        </div>
      </div>
    )
  );

  // ── Hero card — image-forward featured layout (Limitless style) ──────────
  if (hero) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
        <div
          onClick={() => router.push(`/markets/${market.id}`)}
          className="group relative bg-[var(--card)] border-2 border-[var(--card-border)] overflow-hidden hover:border-[var(--accent)]/60 transition-all cursor-pointer rounded-xl"
        >
          {/* Hero image header */}
          <div className="relative h-36 w-full overflow-hidden bg-[var(--background)]">
            {hasImage ? (
              <img src={market.imageUrl!} alt="" className="w-full h-full object-cover" onError={() => setImageError(true)} />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${catColor}40, var(--background))` }} />
            )}
            {/* Dark gradient for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40" />
            {/* Top badges */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 backdrop-blur-sm" style={{ color: catColor, backgroundColor: `${catColor}25`, border: `1px solid ${catColor}60` }}>
                  {market.category}
                </span>
                {market.subCategory && (
                  <span className="text-[9px] font-mono font-bold text-white uppercase tracking-wider px-1.5 py-0.5 bg-white/15 border border-white/30 backdrop-blur-sm flex items-center gap-1">
                    {SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)?.icon.startsWith('/') ? (
                      <Image src={SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)!.icon} alt="" width={10} height={10} className="object-contain" />
                    ) : (<span>{SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)?.icon}</span>)}
                    {market.subCategory}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-[9px] font-mono text-white/90 px-1.5 py-0.5 bg-black/40 backdrop-blur-sm">
                <Timer size={10} weight="bold" />
                {market.status === "OPEN" ? timeUntil(market.resolvesAt) : "Ended"}
              </span>
            </div>
            {/* Title overlaid at bottom */}
            <h3 className="absolute bottom-2 left-3 right-3 font-mono text-base font-black text-white leading-tight line-clamp-2 drop-shadow-lg">
              {displayTitle}
            </h3>
          </div>

          {/* Odds buttons */}
          <div className="p-3">
            {buyButtons}
            {/* Volume + trades footer */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--muted)] pt-2 border-t border-[var(--card-border)]/50">
              <span className="flex items-center gap-1">
                <ChartLineUp size={10} weight="bold" className="text-[var(--accent)]" />
                <img src={displayCurrency === 'USDC' ? '/usdc.png' : '/ntzs.png'} alt={displayCurrency} className="w-2.5 h-2.5 inline-block opacity-60" />
                {displayCurrency === 'USDC'
                  ? `$${(market.totalVolume / 2630).toFixed(0)}`
                  : market.totalVolume >= 1000000 ? `${(market.totalVolume / 1000000).toFixed(1)}M`
                  : market.totalVolume >= 1000 ? `${(market.totalVolume / 1000).toFixed(1)}K`
                  : market.totalVolume}
              </span>
              {market._count && (
                <span className="flex items-center gap-1">
                  <Lightning size={10} weight="fill" className="text-[var(--accent)]" />
                  {market._count.trades} {locale === "sw" ? "biashara" : "trades"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Buy Modal (shared) */}
        {showBuyModal && selectedSide && (
          <QuickBuyModal
            isOpen={showBuyModal}
            onClose={() => { setShowBuyModal(false); setSelectedSide(null); setSelectedOptionIndex(null); setSelectedDisplaySide(null); }}
            market={{
              id: market.id, title: displayTitle, category: market.category, fxRate: market.fxRate,
              price: market.price, optionPrices: market.optionPrices || undefined,
              yesPool: market.yesPool, noPool: market.noPool, resolvesAt: market.resolvesAt,
              status: market.status, totalVolume: market.totalVolume,
            }}
            side={selectedSide}
            optionIndex={selectedOptionIndex ?? undefined}
            displaySide={selectedDisplaySide ?? undefined}
          />
        )}
      </motion.div>
    );
  }

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

          <div className="p-3">
            {/* Top row: Category + Status + Timer */}
            <div className="flex items-center justify-between mb-2">
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
            <div className="flex gap-2.5 mb-2.5 items-center">
              {hasImage && (
                <div className="shrink-0 w-10 h-10 border border-[var(--card-border)] overflow-hidden relative">
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
              <div className="mb-2">
                {/* Combined YES/NO bar */}
                <div className="flex items-center justify-between mb-1 font-mono text-[10px]">
                  <span className="text-[#00e5a0] font-bold">YES {yesPct}%</span>
                  <span className="text-red-400 font-bold">NO {noPct}%</span>
                </div>
                <div className="h-1.5 bg-[var(--background)] border border-[var(--card-border)]/50 overflow-hidden flex">
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
            {buyButtons}

            {/* Footer stats */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--muted)] pt-2 border-t border-[var(--card-border)]/50">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <ChartLineUp size={10} weight="bold" className="text-[var(--accent)]" />
                  <img src={displayCurrency === 'USDC' ? '/usdc.png' : '/ntzs.png'} alt={displayCurrency} className="w-2.5 h-2.5 inline-block opacity-60" />
                  {displayCurrency === 'USDC' 
                    ? `$${(market.totalVolume / 2630).toFixed(0)}`
                    : market.totalVolume >= 1000000
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
              <div className="flex items-center gap-2">
                {market.creator && (
                  <span className="text-[var(--muted)]/70 truncate max-w-[80px]">
                    @{market.creator.username}
                  </span>
                )}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQR(true); }}
                  className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                  title="Get QR code"
                >
                  <QrCode size={13} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || ''}/markets/${market.id}`}
        title={market.title}
      />

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
            category: market.category,
            fxRate: market.fxRate,
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
