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
  optionImages?: string[] | null;
  _count?: { trades: number };
  creator?: { username: string };
}

// Polymarket-style semicircular probability gauge: arc fills with the YES
// probability, colored by likelihood, with the % and side label beneath.
function ProbGauge({ pct }: { pct: number }) {
  const rounded = Math.round(pct); // whole numbers only — decimals overflow the dial
  const color = rounded >= 50 ? "#00e5a0" : rounded >= 34 ? "#fbbf24" : "#f87171";
  const arcLen = Math.PI * 16; // r=16 semicircle length
  return (
    <div className="shrink-0 flex flex-col items-center w-[52px]" aria-label={`YES ${rounded}%`}>
      <div className="relative w-[52px] h-[30px]">
        <svg viewBox="0 0 40 22" className="w-full h-full overflow-visible">
          <path d="M 4 20 A 16 16 0 0 1 36 20" fill="none" stroke="var(--card-border)" strokeWidth="4" strokeLinecap="round" />
          <motion.path
            d="M 4 20 A 16 16 0 0 1 36 20"
            fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${arcLen}` }}
            animate={{ strokeDasharray: `${(Math.min(Math.max(rounded, 2), 100) / 100) * arcLen} ${arcLen}` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </svg>
        {/* % nested inside the dial opening so it can never overflow the card */}
        <span
          className="absolute inset-x-0 bottom-0 text-center text-[11px] font-mono font-black tabular-nums leading-none"
          style={{ color }}
        >
          {rounded}%
        </span>
      </div>
      <span className="text-[7px] font-mono font-bold uppercase tracking-widest text-[var(--muted)] mt-0.5">yes</span>
    </div>
  );
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

export function MarketCard({ market, index = 0, hero = false, compact = false }: { market: Market; index?: number; hero?: boolean; compact?: boolean }) {
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
  // Sports head-to-head layout (Limitless style): 2 teams, or 2 teams + a Draw.
  // 3-way without a draw (e.g. 3 contenders) falls through to the compact grid.
  const optionCount = market.options?.length ?? 0;
  const hasDrawOption = (market.options || []).some((o) => /\b(draw|tie)\b/i.test(o));
  const isSportsMatch = market.category === "Sports" && isMultiOption && (optionCount === 2 || (optionCount === 3 && hasDrawOption));
  const catColor = CATEGORY_COLORS[market.category] || "#94a3b8";
  const hasImage = market.imageUrl && !imageError;
  const isExpired = new Date(market.resolvesAt) < new Date();
  const isTradeable = market.status === "OPEN" && !isExpired;
  // Ending within 24h — timer turns amber with a pulsing dot (Limitless-style urgency)
  const endingSoon = isTradeable && new Date(market.resolvesAt).getTime() - Date.now() < 24 * 3600 * 1000;

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
      /* Polymarket-style outcome rows: name + % + thin progress bar, multiplier
         pill and cart on the right. Capped at 4 rows — the card links to the
         full market for the rest. */
      <div className="space-y-1.5 mb-2">
        {displayOptions!.slice(0, 4).map((option, idx) => {
          const colors = ["#00e5a0", "#00b4d8", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];
          const c = colors[idx % colors.length];
          const optPrice = market.optionPrices?.[idx] || 0;
          const pct = Math.round(optPrice * 100);
          const originalOption = market.options?.[idx] || option;
          const isAdded = cartAdded === `${originalOption}-${idx}`;
          return (
            <button
              key={idx}
              onClick={(e) => handleQuickBuy(e, originalOption, idx)}
              className="w-full flex items-center gap-2 font-mono transition-all active:scale-[0.99] group/row"
            >
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between leading-none mb-1">
                  <span className="text-[11px] font-bold truncate pr-2 text-left">{option}</span>
                  <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: c }}>{pct}%</span>
                </span>
                <span className="block h-1 rounded-full bg-[var(--background)] border border-[var(--card-border)]/40 overflow-hidden">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pct, 2)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.06 }}
                    className="block h-full rounded-full"
                    style={{ backgroundColor: c }}
                  />
                </span>
              </span>
              <span
                className="shrink-0 px-2 py-1.5 rounded-lg text-xs font-black leading-none tabular-nums border transition-all group-hover/row:opacity-90"
                style={{ color: c, borderColor: `${c}44`, backgroundColor: `${c}14` }}
              >
                {optPrice > 0 ? (1 / optPrice).toFixed(1) : '∞'}<span className="text-[9px]">x</span>
              </span>
              <span
                onClick={(e) => handleAddToCart(e, originalOption, idx)}
                className="shrink-0 p-1.5 rounded-lg border transition-all active:scale-95"
                style={{ borderColor: isAdded ? '#00e5a0' : `${c}44`, color: isAdded ? '#000' : c, backgroundColor: isAdded ? '#00e5a0' : 'transparent' }}
                title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
              >
                {isAdded ? <Check size={11} weight="bold" /> : <ShoppingCart size={11} weight="bold" />}
              </span>
            </button>
          );
        })}
        {displayOptions!.length > 4 && (
          <div className="text-[10px] font-mono font-bold text-[var(--muted)] text-center pt-0.5">
            +{displayOptions!.length - 4} {locale === "sw" ? "zaidi" : "more"} →
          </div>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="relative">
          <button
            onClick={(e) => handleQuickBuy(e, "YES")}
            className="w-full py-3.5 px-3 rounded-xl bg-[#00e5a0]/10 border-2 border-[#00e5a0]/50 text-[#00e5a0] font-mono transition-all hover:bg-[#00e5a0]/20 hover:border-[#00e5a0] active:scale-[0.97] flex flex-col items-center gap-0.5"
          >
            {market.optionImages?.[0] && <img src={market.optionImages[0]} alt="" className="w-8 h-8 rounded-full object-cover border border-[#00e5a0]/30 mb-0.5" />}
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{locale === "sw" ? "Nunua" : "Buy"} YES ↑</span>
            <span className="text-xl font-black leading-none">{(1 / market.price.yes).toFixed(2)}<span className="text-xs">x</span></span>
            <span className="text-[10px] font-bold opacity-60">{yesPct}%</span>
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
            className="w-full py-3.5 px-3 rounded-xl bg-red-500/10 border-2 border-red-500/50 text-red-400 font-mono transition-all hover:bg-red-500/20 hover:border-red-500 active:scale-[0.97] flex flex-col items-center gap-0.5"
          >
            {market.optionImages?.[1] && <img src={market.optionImages[1]} alt="" className="w-8 h-8 rounded-full object-cover border border-red-500/30 mb-0.5" />}
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{locale === "sw" ? "Nunua" : "Buy"} NO ↓</span>
            <span className="text-xl font-black leading-none">{(1 / market.price.no).toFixed(2)}<span className="text-xs">x</span></span>
            <span className="text-[10px] font-bold opacity-60">{noPct}%</span>
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
          className="group relative bg-[var(--card)] border-2 border-[var(--card-border)] overflow-hidden hover:border-[var(--accent)]/60 transition-all cursor-pointer rounded-2xl"
        >
          {/* Full-bleed hero image header (Limitless style) */}
          <div className="relative h-44 w-full overflow-hidden bg-[var(--background)]">
            {hasImage ? (
              <img src={market.imageUrl!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={() => setImageError(true)} />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${catColor}40, var(--background))` }} />
            )}
            {/* Dark gradient for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/40" />
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
            {/* Title overlaid at bottom (leaves room for the gauge chip on binary) */}
            <h3 className={cn(
              "absolute bottom-2 left-3 font-mono text-base font-black text-white leading-tight line-clamp-2 drop-shadow-lg",
              !isMultiOption ? "right-[76px]" : "right-3"
            )}>
              {displayTitle}
            </h3>
            {/* Probability gauge in a glass chip over the image */}
            {!isMultiOption && (
              <div className="absolute bottom-2 right-2 px-1.5 pt-1.5 pb-1 rounded-xl bg-black/45 backdrop-blur-md border border-white/15">
                <ProbGauge pct={yesPct} />
              </div>
            )}
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

  // ── Compact card — dense layout for dedicated category pages ──────────────
  if (compact) {
    const subInfo = market.subCategory ? SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory) : null;
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.25 }}>
        <div
          onClick={() => router.push(`/markets/${market.id}`)}
          className="group relative bg-[var(--card)] border border-[var(--card-border)] hover:border-[var(--accent)]/50 transition-all cursor-pointer rounded-lg overflow-hidden"
        >
          <div className="p-2.5">
            {/* Header: tags + timer */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {hasImage ? (
                  <img src={market.imageUrl!} alt="" className="shrink-0 w-5 h-5 rounded object-cover" onError={() => setImageError(true)} />
                ) : subInfo?.icon?.startsWith('/') ? (
                  <Image src={subInfo.icon} alt="" width={16} height={16} className="shrink-0 object-contain" />
                ) : null}
                <span className="text-[8px] font-mono font-bold uppercase tracking-wider truncate" style={{ color: catColor }}>
                  {market.subCategory || market.category}
                </span>
              </div>
              <span className="shrink-0 flex items-center gap-1 text-[8px] font-mono text-[var(--muted)]">
                <Timer size={9} weight="bold" />
                {market.status === "OPEN" ? timeUntil(market.resolvesAt) : "Ended"}
              </span>
            </div>

            {/* Title — single line, clamped */}
            <h3 className="font-mono text-xs font-bold leading-tight line-clamp-2 mb-2 group-hover:text-[var(--accent)] transition-colors min-h-[2rem]">
              {displayTitle}
            </h3>

            {/* Buy options — compact */}
            {isTradeable && (
              isMultiOption ? (
                /* Multi-option: tight horizontal scroll of small pills (label + odds) */
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
                  {displayOptions!.map((option, idx) => {
                    const colors = ["#00e5a0", "#00b4d8", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
                    const c = colors[idx % colors.length];
                    const optPrice = market.optionPrices?.[idx] || 0;
                    const originalOption = market.options?.[idx] || option;
                    return (
                      <button
                        key={idx}
                        onClick={(e) => handleQuickBuy(e, originalOption, idx)}
                        className="shrink-0 px-2 py-1.5 border font-mono transition-all active:scale-95 flex flex-col items-center leading-none gap-0.5 min-w-[58px]"
                        style={{ borderColor: `${c}50`, color: c, backgroundColor: `${c}10` }}
                      >
                        <span className="text-[8px] font-bold uppercase truncate max-w-[54px]">{option.length > 8 ? option.slice(0, 8) + "." : option}</span>
                        <span className="text-sm font-black">{optPrice > 0 ? (1 / optPrice).toFixed(1) : '∞'}<span className="text-[8px]">x</span></span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Binary: two compact buttons side by side */
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={(e) => handleQuickBuy(e, "YES")}
                    className="py-1.5 bg-[#00e5a0]/10 border border-[#00e5a0]/50 text-[#00e5a0] font-mono transition-all hover:bg-[#00e5a0]/20 active:scale-[0.97] flex items-center justify-center gap-1.5"
                  >
                    <span className="text-[9px] font-bold uppercase">YES</span>
                    <span className="text-sm font-black leading-none">{(1 / market.price.yes).toFixed(2)}<span className="text-[8px]">x</span></span>
                  </button>
                  <button
                    onClick={(e) => handleQuickBuy(e, "NO")}
                    className="py-1.5 bg-red-500/10 border border-red-500/50 text-red-400 font-mono transition-all hover:bg-red-500/20 active:scale-[0.97] flex items-center justify-center gap-1.5"
                  >
                    <span className="text-[9px] font-bold uppercase">NO</span>
                    <span className="text-sm font-black leading-none">{(1 / market.price.no).toFixed(2)}<span className="text-[8px]">x</span></span>
                  </button>
                </div>
              )
            )}
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

  // ── Sports match body (Limitless style) — Team · time · Team, %-box + multiplier ──
  let matchBody: React.ReactNode = null;
  if (isSportsMatch) {
    const fmtPct = (p: number) => {
      const v = p * 100;
      return v % 1 === 0 ? Math.round(v) : parseFloat(v.toFixed(1));
    };
    // Build outcomes with their original index, detect the Draw
    const outcomes = displayOptions!.map((label, idx) => ({
      label,
      original: market.options?.[idx] || label,
      idx,
      price: market.optionPrices?.[idx] || 0,
      isDraw: /\b(draw|tie)\b/i.test(market.options?.[idx] || label),
    }));
    const draw = outcomes.find((o) => o.isDraw) || null;
    const teams = outcomes.filter((o) => !o.isDraw).slice(0, 2);
    const matchDate = new Date(market.resolvesAt);
    const dateStr = matchDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const timeStr = matchDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    const teamColors = ["#00e5a0", "#00b4d8"];
    const drawColor = "#94a3b8";

    // One outcome cell: %-box (button when tradeable) + multiplier underneath
    const OutcomeCell = (o: typeof outcomes[number], color: string, withLabel: boolean) => {
      const pct = fmtPct(o.price);
      const mult = o.price > 0 ? (1 / o.price).toFixed(2) : "∞";
      const isAdded = cartAdded === `${o.original}-${o.idx}`;
      return (
        <div className="flex flex-col items-center gap-1">
          {isTradeable ? (
            <button
              onClick={(e) => handleQuickBuy(e, o.original, o.idx)}
              className="relative w-full py-2 px-1 border-2 font-mono transition-all active:scale-[0.97] hover:opacity-90 text-center"
              style={{ borderColor: `${color}55`, color, backgroundColor: `${color}1a` }}
            >
              {/* Multiplier in the bolded box */}
              <span className="text-base font-black tabular-nums leading-none">{mult}<span className="text-[10px]">x</span></span>
              <span
                onClick={(e) => handleAddToCart(e, o.original, o.idx)}
                className="absolute top-0.5 right-0.5 p-0.5 border transition-all active:scale-95"
                style={{ borderColor: isAdded ? "#00e5a0" : `${color}40`, color: isAdded ? "#000" : color, backgroundColor: isAdded ? "#00e5a0" : "transparent" }}
                title={locale === "sw" ? "Ongeza kwenye mkoba" : "Add to cart"}
              >
                {isAdded ? <Check size={10} weight="bold" /> : <ShoppingCart size={10} weight="bold" />}
              </span>
            </button>
          ) : (
            <div className="w-full py-2 px-1 border-2 font-mono text-center" style={{ borderColor: `${color}40`, color, backgroundColor: `${color}10` }}>
              <span className="text-base font-black tabular-nums leading-none">{mult}<span className="text-[10px]">x</span></span>
            </div>
          )}
          {/* Probability outside, as the small label */}
          <span className="text-[11px] font-bold opacity-60 tabular-nums">{withLabel && <span className="uppercase opacity-80 mr-0.5">Draw</span>}{pct}%</span>
        </div>
      );
    };

    matchBody = (
      <div className="mb-2.5">
        {/* Teams + center time/status */}
        <div className="grid grid-cols-3 gap-2 items-start mb-2">
          <div className="flex flex-col items-center text-center gap-1.5">
            {(() => { const img = market.optionImages?.[teams[0]?.idx ?? -1] || market.imageUrl; return img ? <img src={img} alt="" className="w-9 h-9 rounded object-cover border border-[var(--card-border)]" onError={() => setImageError(true)} /> : null; })()}
            <span className="text-xs font-bold leading-tight line-clamp-2">{teams[0]?.label}</span>
          </div>
          <div className="flex flex-col items-center text-center justify-start pt-1 gap-0.5">
            {isTradeable ? (
              <>
                <span className="text-[10px] font-mono text-[var(--muted)] leading-none">{dateStr}</span>
                <span className="text-sm font-mono font-black leading-tight">{timeStr}</span>
              </>
            ) : (
              <span className="text-[11px] font-mono font-bold text-blue-400 leading-tight">{market.status === "RESOLVED" ? (locale === "sw" ? "Imekamilika" : "Resolved") : (locale === "sw" ? "Imeisha" : "Ended")}</span>
            )}
          </div>
          <div className="flex flex-col items-center text-center gap-1.5">
            {(() => { const img = market.optionImages?.[teams[1]?.idx ?? -1] || market.imageUrl; return img ? <img src={img} alt="" className="w-9 h-9 rounded object-cover border border-[var(--card-border)]" onError={() => setImageError(true)} /> : null; })()}
            <span className="text-xs font-bold leading-tight line-clamp-2">{teams[1]?.label}</span>
          </div>
        </div>
        {/* Outcome boxes: Team · Draw · Team */}
        <div className="grid grid-cols-3 gap-2">
          {teams[0] && OutcomeCell(teams[0], teamColors[0], false)}
          {draw ? OutcomeCell(draw, drawColor, true) : <div />}
          {teams[1] && OutcomeCell(teams[1], teamColors[1], false)}
        </div>
      </div>
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
        className="group relative bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden hover:border-[var(--accent)]/60 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,229,160,0.1)] cursor-pointer"
      >
          {/* Accent top line */}
          <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${catColor}, transparent)` }} />

          <div className="p-3">
            {/* Top row: Category + Subcategory + Status + Timer */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <a
                  href={`/markets?category=${market.category}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/markets?category=${market.category}`, { scroll: false });
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
                      router.push(`/markets?category=${market.category}&subCategory=${market.subCategory}`, { scroll: false });
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
                endingSoon ? "text-amber-400 font-bold" : market.status === "OPEN" ? "text-[var(--muted)]" : "text-blue-400"
              )}>
                {endingSoon && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                <Timer size={10} weight="bold" />
                {market.status === "OPEN" ? timeUntil(market.resolvesAt) : "Ended"}
              </span>
            </div>

            {/* Title row with optional thumbnail (hidden for sports match — teams shown instead).
                Binary markets get a Polymarket-style probability gauge on the right. */}
            {!isSportsMatch && (
            <div className="flex gap-2.5 mb-2.5 items-center">
              {hasImage && (
                <div className="shrink-0 w-10 h-10 rounded-lg border border-[var(--card-border)] overflow-hidden relative">
                  <img
                    src={market.imageUrl!}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_4px)] pointer-events-none" />
                </div>
              )}
              <h3 className="flex-1 min-w-0 font-mono text-[13px] sm:text-sm font-bold leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">
                {displayTitle}
              </h3>
              {!isMultiOption && <ProbGauge pct={yesPct} />}
            </div>
            )}

            {/* Quick Buy Buttons (sports markets get the match-style body) */}
            {isSportsMatch ? matchBody : buyButtons}

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
