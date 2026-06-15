"use client";
import { useEffect, useState, useRef, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { MarketCard } from "@/components/MarketCard";
import { OnboardingPopup } from "@/components/OnboardingPopup";
import { QuickBuyModal } from "@/components/QuickBuyModal";
import { QRCodeModal } from "@/components/QRCodeModal";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, Plus, Funnel, Stack, CaretRight, ShoppingCart, CaretDown, Lightning, Check, QrCode, ArrowDownLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { CATEGORIES, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/store/useCurrency";
import { useCart } from "@/store/useCart";
import { Footer } from "@/components/Footer";
import { ActivityTicker } from "@/components/ActivityTicker";
import { FirstDepositPrompt } from "@/components/FirstDepositPrompt";
import { FeaturedDeck } from "@/components/FeaturedDeck";
import { ReferralBanner } from "@/components/ReferralBanner";
import { CreatorRewardsBanner } from "@/components/CreatorRewardsBanner";
import { EmailSubscribe } from "@/components/EmailSubscribe";

// Event Card Component with Quick Buy
interface EventMarket {
  id: string;
  title: string;
  category?: string;
  fxRate?: number | null;
  price?: { yes: number; no: number } | number; // Can be object or number
  yesPool?: number;
  noPool?: number;
  options?: string[];
  optionPools?: number[];
  optionPrices?: number[];
  totalVolume?: number;
  status?: string;
  resolvesAt?: string;
  _count?: { trades: number };
}

// Helper to get yes/no prices from market
function getMarketPrices(m: EventMarket): { yes: number; no: number } {
  if (typeof m.price === 'object' && m.price !== null) {
    return { yes: m.price.yes || 0.5, no: m.price.no || 0.5 };
  }
  if (typeof m.price === 'number' && !isNaN(m.price)) {
    return { yes: m.price, no: 1 - m.price };
  }
  // Calculate from pools if available
  if (m.yesPool && m.noPool) {
    const total = m.yesPool + m.noPool;
    if (total > 0) {
      return { yes: m.noPool / total, no: m.yesPool / total };
    }
  }
  return { yes: 0.5, no: 0.5 };
}

interface EventCardProps {
  eventId: string;
  eventTitle: string;
  markets: EventMarket[];
  category: string;
  subCategory?: string;
  imageUrl?: string;
  index: number;
}

function EventCard({ eventId, eventTitle, markets, category, subCategory, imageUrl, index }: EventCardProps) {
  const { locale } = useLanguage();
  const { format: formatAmount, currency } = useCurrency();
  const { addItem } = useCart();
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<EventMarket | null>(null);
  const [selectedSide, setSelectedSide] = useState<string>("yes");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | undefined>();
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<string | null>(null); // Track which item was just added
  const [showQR, setShowQR] = useState(false);

  const totalVolume = markets.reduce((sum, m) => sum + (m.totalVolume || 0), 0);
  const totalTrades = markets.reduce((sum, m) => sum + (m._count?.trades || 0), 0);

  // Format volume as K/M
  const formatVolume = (vol: number) => {
    if (currency === 'USDC') {
      const usdVol = vol / 2630;
      return usdVol >= 1000 ? `$${(usdVol / 1000).toFixed(1)}K` : `$${usdVol.toFixed(0)}`;
    }
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
    return vol.toString();
  };

  const handleBuyClick = (market: EventMarket, side: string, optionIdx?: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSelectedMarket(market);
    setSelectedSide(side);
    setSelectedOptionIndex(optionIdx);
    setQuickBuyOpen(true);
  };

  const handleAddToCart = (market: EventMarket, side: string, optionIdx?: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const prices = getMarketPrices(market);
    const price = optionIdx !== undefined 
      ? (market.optionPrices?.[optionIdx] || 0.25)
      : (side === "yes" ? prices.yes : prices.no);
    
    const cartKey = `${market.id}-${side}-${optionIdx ?? ''}`;
    setAddedToCart(cartKey);
    setTimeout(() => setAddedToCart(null), 1500); // Reset after 1.5s
    
    addItem({
      marketId: market.id,
      marketTitle: market.title,
      side: optionIdx !== undefined ? (market.options?.[optionIdx] || `Option ${optionIdx}`) : side.toUpperCase(),
      optionIndex: optionIdx,
      amount: 1000,
      estimatedShares: 1000 / (price || 0.5),
      currentPrice: price,
      category: category,
    });
  };

  const toggleExpand = (marketId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMarket(expandedMarket === marketId ? null : marketId);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all"
      >
        {/* Tags row */}
        <div className="px-3 pt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Stack size={10} weight="fill" className="inline mr-1" />
            {markets.length} markets
          </span>
          <Link 
            href={`/markets?category=${category}`}
            className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-[#00e5a0]/10 text-[#00e5a0] border border-[#00e5a0]/30 hover:bg-[#00e5a0]/20 transition-colors"
          >
            {category}
          </Link>
          {subCategory && (() => {
            const subCatInfo = SPORTS_SUBCATEGORIES.find(s => s.value === subCategory);
            return (
              <Link 
                href={`/markets?category=${category}&subCategory=${subCategory}`}
                className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors flex items-center gap-1"
              >
                {subCatInfo?.icon?.startsWith('/') ? (
                  <Image src={subCatInfo.icon} alt={subCategory} width={12} height={12} className="object-contain" />
                ) : (
                  <span>{subCatInfo?.icon}</span>
                )}
                {subCategory}
              </Link>
            );
          })()}
        </div>
        
        {/* Image + Title - Clickable to event page */}
        <Link href={`/events/${eventId}`}>
          <div className="p-3 flex gap-3 group">
            {imageUrl && (
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--card-border)]">
                <Image
                  src={imageUrl}
                  alt={eventTitle}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h3 className="font-bold text-sm group-hover:text-orange-400 transition-colors line-clamp-2 flex-1">
              {eventTitle}
            </h3>
          </div>
        </Link>
        
        {/* Markets with Buy Options */}
        <div className="px-3 pb-2 space-y-2">
          {markets.slice(0, 3).map((m) => {
            const isMultiOption = m.options && m.options.length >= 2;
            const prices = getMarketPrices(m);
            const yesPrice = prices.yes;
            const noPrice = prices.no;
            const isExpanded = expandedMarket === m.id;
            
            return (
              <div key={m.id} className="bg-[var(--background)] rounded-lg p-2">
                <Link href={`/markets/${m.id}`}>
                  <p className="text-xs font-medium mb-2 hover:text-[var(--accent)] transition-colors truncate">
                    {m.title}
                  </p>
                </Link>
                
                {isMultiOption ? (
                  // Multi-option with dropdown
                  <div>
                    <button
                      onClick={(e) => toggleExpand(m.id, e)}
                      className="w-full flex items-center justify-between px-2 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs"
                    >
                      <span className="text-purple-400 font-mono">{m.options?.length} options</span>
                      <CaretDown 
                        size={12} 
                        className={cn("text-purple-400 transition-transform", isExpanded && "rotate-180")} 
                      />
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 space-y-1">
                            {m.options?.slice(0, 4).map((opt, i) => {
                              const optPrice = m.optionPrices?.[i] || (1 / (m.options?.length || 4));
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                                  <span className="truncate flex-1 text-[var(--muted)]">{opt}</span>
                                  <span className="font-mono text-purple-400">{Math.round(optPrice * 100)}%</span>
                                  <button
                                    onClick={(e) => handleBuyClick(m, `option_${i}`, i, e)}
                                    className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 font-bold"
                                  >
                                    BUY
                                  </button>
                                  <button
                                    onClick={(e) => handleAddToCart(m, `option_${i}`, i, e)}
                                    className={cn(
                                      "p-0.5 rounded transition-all",
                                      addedToCart === `${m.id}-option_${i}-${i}`
                                        ? "bg-green-500/30 text-green-400"
                                        : "text-purple-400 hover:bg-purple-500/20"
                                    )}
                                  >
                                    {addedToCart === `${m.id}-option_${i}-${i}` ? <Check size={10} weight="bold" /> : <ShoppingCart size={10} />}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  // Binary YES/NO
                  <div className="flex gap-1.5">
                    <div className="flex-1 flex items-center gap-1">
                      <button
                        onClick={(e) => handleBuyClick(m, "yes", undefined, e)}
                        className="flex-1 py-1 text-[10px] font-bold bg-[#00e5a0]/20 text-[#00e5a0] border border-[#00e5a0]/30 hover:bg-[#00e5a0]/30"
                      >
                        YES {Math.round(yesPrice * 100)}%
                      </button>
                      <button
                        onClick={(e) => handleAddToCart(m, "yes", undefined, e)}
                        className={cn(
                          "p-1 border transition-all",
                          addedToCart === `${m.id}-yes-`
                            ? "bg-green-500/30 text-green-400 border-green-500/30"
                            : "bg-[#00e5a0]/10 text-[#00e5a0] hover:bg-[#00e5a0]/20 border-[#00e5a0]/30"
                        )}
                      >
                        {addedToCart === `${m.id}-yes-` ? <Check size={10} weight="bold" /> : <ShoppingCart size={10} />}
                      </button>
                    </div>
                    <div className="flex-1 flex items-center gap-1">
                      <button
                        onClick={(e) => handleBuyClick(m, "no", undefined, e)}
                        className="flex-1 py-1 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                      >
                        NO {Math.round(noPrice * 100)}%
                      </button>
                      <button
                        onClick={(e) => handleAddToCart(m, "no", undefined, e)}
                        className={cn(
                          "p-1 border transition-all",
                          addedToCart === `${m.id}-no-`
                            ? "bg-green-500/30 text-green-400 border-green-500/30"
                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30"
                        )}
                      >
                        {addedToCart === `${m.id}-no-` ? <Check size={10} weight="bold" /> : <ShoppingCart size={10} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {markets.length > 3 && (
            <Link href={`/events/${eventId}`} className="block text-[10px] text-orange-400 text-center hover:underline">
              +{markets.length - 3} more markets →
            </Link>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-3 py-2 border-t border-[var(--card-border)] flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <img 
                src={currency === 'USDC' ? '/usdc.png' : '/ntzs.png'} 
                alt={currency} 
                className="w-3 h-3" 
              />
              {formatVolume(totalVolume)}
            </span>
            <span className="flex items-center gap-1">
              <Lightning size={10} weight="fill" className="text-yellow-400" />
              {totalTrades}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQR(true); }}
              className="p-1 rounded text-[var(--muted)] hover:text-orange-400 hover:bg-orange-400/10 transition-all"
              title="Get QR code"
            >
              <QrCode size={13} weight="bold" />
            </button>
            <Link href={`/events/${eventId}`}>
              <CaretRight size={14} className="text-orange-400 hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || ''}/events/${eventId}`}
        title={eventTitle}
      />

      {/* Quick Buy Modal */}
      {selectedMarket && (() => {
        const modalPrices = getMarketPrices(selectedMarket);
        return (
          <QuickBuyModal
            isOpen={quickBuyOpen}
            onClose={() => setQuickBuyOpen(false)}
            market={{
              id: selectedMarket.id,
              title: selectedMarket.title,
              category: selectedMarket.category,
              fxRate: selectedMarket.fxRate,
              price: modalPrices,
              optionPrices: selectedMarket.optionPrices,
              yesPool: selectedMarket.yesPool || 10000,
              noPool: selectedMarket.noPool || 10000,
              optionPools: selectedMarket.optionPools,
              resolvesAt: selectedMarket.resolvesAt,
              status: selectedMarket.status,
              totalVolume: selectedMarket.totalVolume,
            }}
            side={selectedSide}
            optionIndex={selectedOptionIndex}
            displaySide={selectedOptionIndex !== undefined ? selectedMarket.options?.[selectedOptionIndex] : selectedSide.toUpperCase()}
          />
        );
      })()}
    </>
  );
}

function MarketsContent() {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();

  const [markets, setMarkets] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [subCategory, setSubCategory] = useState(searchParams.get("subCategory") || "all");
  const [sort, setSort] = useState("new");

  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Category tab order: All, Sports, Business, Entertainment, FX & Commodities, then the rest
  const PRIORITY_CATS = ["Sports", "Business", "Entertainment", "FX & Commodities"];
  const orderedCategories = ["all", ...PRIORITY_CATS, ...CATEGORIES.filter((c) => !PRIORITY_CATS.includes(c))];

  const SORT_OPTIONS = [
    { value: "volume", label: locale === "sw" ? "Maarufu" : "Trending" },
    { value: "ending", label: locale === "sw" ? "Inamalizika" : "Ending Soon" },
    { value: "new", label: locale === "sw" ? "Mpya" : "Newest" },
  ];
  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label || SORT_OPTIONS[0].label;

  // Sync filters from the URL so in-card category/subcategory links filter
  // in place (no full page redirect) when the query string changes.
  const spString = searchParams.toString();
  useEffect(() => {
    const c = searchParams.get("category") || "all";
    const s = searchParams.get("subCategory") || "all";
    setCategory(c);
    setSubCategory(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spString]);

  // Only show the skeleton on the very first load; on filter changes keep the
  // current cards visible and swap them in when the fetch resolves (smooth, no flash/jump)
  const didInitialLoad = useRef(false);
  useEffect(() => {
    if (!didInitialLoad.current) setLoading(true);
    const params = new URLSearchParams({ status: "OPEN", sort });
    if (category !== "all") params.set("category", category);
    if (category === "Sports" && subCategory !== "all") params.set("subCategory", subCategory);
    if (search) params.set("q", search);

    fetch(`/api/markets?${params}`)
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets || []))
      .finally(() => { setLoading(false); didInitialLoad.current = true; });
  }, [category, subCategory, sort, search]);

  return (
    <div className="min-h-screen">
      {/* Live activity ticker — single line, pinned at the very top above the navbar */}
      <ActivityTicker compact />
      <Navbar />

      {/* Category tabs — directly below the navbar, single-line swipe (Limitless style) */}
      <div className="sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur-xl border-b border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto scrollbar-none snap-x px-3">
          {/* Trending tab */}
          <button
            onClick={() => { setSort("volume"); setCategory("all"); setSubCategory("all"); }}
            className={cn(
              "shrink-0 snap-start px-3 py-2.5 text-[13px] font-mono font-bold whitespace-nowrap border-b-2 transition-colors",
              category === "all" && sort === "volume"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            🔥 {locale === "sw" ? "Maarufu" : "Trending"}
          </button>
          {orderedCategories.map((c) => (
            <button
              key={c}
              onClick={() => { setCategory(c); setSubCategory("all"); if (c !== "all") setSort("new"); }}
              className={cn(
                "shrink-0 snap-start px-3 py-2.5 text-[13px] font-mono font-bold whitespace-nowrap border-b-2 transition-colors",
                category === c && !(c === "all" && sort === "volume")
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {c === "all" ? (locale === "sw" ? "Zote" : "All") : (locale === "sw" ? (t.markets.categories as Record<string, string>)[c.toLowerCase()] || c : c)}
            </button>
          ))}
        </div>

        {/* Sub-category chips — shown under the Sports tab (Limitless style) */}
        {category === "Sports" && (
          <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto scrollbar-none snap-x px-3 pb-2 pt-1 border-t border-[var(--card-border)]/50">
            <button
              onClick={() => setSubCategory("all")}
              className={cn(
                "shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-mono font-bold whitespace-nowrap border transition-colors flex items-center gap-1.5",
                subCategory === "all"
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              🏟️ {locale === "sw" ? "Zote" : "All"}
            </button>
            {SPORTS_SUBCATEGORIES.map((sub) => (
              <button
                key={sub.value}
                onClick={() => setSubCategory(sub.value)}
                className={cn(
                  "shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-mono font-bold whitespace-nowrap border transition-colors flex items-center gap-1.5",
                  subCategory === sub.value
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                {sub.icon.startsWith('/') ? (
                  <Image src={sub.icon} alt={sub.label} width={14} height={14} className="object-contain" />
                ) : (
                  <span>{sub.icon}</span>
                )}
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <OnboardingPopup />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* First-deposit prompt for funded-less users */}
        <FirstDepositPrompt />

        {/* Header — title on left, Deposit + Create inline on the right */}
        <div className="flex items-start justify-between gap-2 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">{t.markets.title}</h1>
            <p className="text-[var(--muted)] text-xs sm:text-sm mt-1">{markets.length} {locale === "sw" ? "masoko" : "markets found"}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/wallet"
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-[#00e5a0] text-black font-black text-xs sm:text-sm hover:opacity-90 transition-all font-mono tracking-wider uppercase active:scale-95 shadow-[0_0_15px_rgba(0,229,160,0.25)]"
            >
              <ArrowDownLeft size={15} weight="bold" />
              {locale === "sw" ? "Weka" : "Deposit"}
            </Link>
            <Link
              href="/markets/create"
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-xs sm:text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">{t.markets.create}</span>
              <span className="sm:hidden">{locale === "sw" ? "Unda" : "Create"}</span>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4 mb-8">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" weight="bold" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "sw" ? "Tafuta masoko…" : "Search markets…"}
              className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Toolbar: Categories dropdown + Sort dropdown (Limitless style) — shown on all views */}
          {(
            <div className="flex items-center justify-between gap-2">
              {/* Categories dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setCatDropdownOpen(!catDropdownOpen); setSortDropdownOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[var(--foreground)] text-[var(--background)] font-mono font-bold text-sm rounded-lg active:scale-95 transition-transform"
                >
                  <Stack size={15} weight="bold" />
                  {locale === "sw" ? "Aina" : "Categories"}
                  <CaretDown size={13} weight="bold" className={cn("transition-transform", catDropdownOpen && "rotate-180")} />
                </button>
                {catDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setCatDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-64 max-h-[60vh] overflow-y-auto bg-[var(--background)] border-2 border-[var(--card-border)] rounded-xl shadow-2xl py-1">
                      {/* Categories list */}
                      {orderedCategories.filter(c => c !== "all").map((c) => (
                        <button
                          key={c}
                          onClick={() => { setCategory(c); setSubCategory("all"); setCatDropdownOpen(false); }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2.5 text-sm font-mono text-left transition-colors",
                            category === c ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--foreground)] hover:bg-[var(--card)]"
                          )}
                        >
                          {locale === "sw" ? (t.markets.categories as Record<string, string>)[c.toLowerCase()] || c : c}
                          {category === c && <Check size={14} weight="bold" />}
                        </button>
                      ))}
                      {/* Subcategories for Sports */}
                      {category === "Sports" && (
                        <>
                          <div className="border-t border-[var(--card-border)] my-1" />
                          <p className="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted)]">{locale === "sw" ? "Ligi" : "Leagues"}</p>
                          <button
                            onClick={() => { setSubCategory("all"); setCatDropdownOpen(false); }}
                            className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-mono transition-colors", subCategory === "all" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--foreground)] hover:bg-[var(--card)]")}
                          >
                            🏟️ {locale === "sw" ? "Zote" : "All"}
                            <span className="text-xs text-[var(--muted)]">{markets.length}</span>
                          </button>
                          {SPORTS_SUBCATEGORIES.map((sub) => {
                            const count = (markets as { subCategory?: string }[]).filter(m => m.subCategory === sub.value).length;
                            if (count === 0 && subCategory !== sub.value) return null;
                            return (
                              <button
                                key={sub.value}
                                onClick={() => { setSubCategory(sub.value); setCatDropdownOpen(false); }}
                                className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-mono transition-colors", subCategory === sub.value ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--foreground)] hover:bg-[var(--card)]")}
                              >
                                <span className="flex items-center gap-2">
                                  {sub.icon.startsWith('/') ? <Image src={sub.icon} alt="" width={16} height={16} className="object-contain" /> : <span>{sub.icon}</span>}
                                  {sub.label}
                                </span>
                                <span className="text-xs text-[var(--muted)]">{count}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setSortDropdownOpen(!sortDropdownOpen); setCatDropdownOpen(false); }}
                  className="flex items-center gap-1.5 text-sm font-mono text-[var(--muted)]"
                >
                  {locale === "sw" ? "Panga:" : "Sort by:"} <span className="font-bold text-[var(--foreground)]">{sortLabel}</span>
                  <CaretDown size={13} weight="bold" className={cn("transition-transform", sortDropdownOpen && "rotate-180")} />
                </button>
                {sortDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-xl shadow-2xl py-1">
                      {SORT_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => { setSort(s.value); setSortDropdownOpen(false); }}
                          className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-mono transition-colors", sort === s.value ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--foreground)] hover:bg-[var(--card)]")}
                        >
                          {s.label}
                          {sort === s.value && <Check size={14} weight="bold" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Persistent subcategory chips while viewing Sports — always available to switch */}
          {category === "Sports" && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x pb-1">
              <button
                onClick={() => setSubCategory("all")}
                className={cn(
                  "shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-mono font-bold whitespace-nowrap border transition-colors flex items-center gap-1.5",
                  subCategory === "all"
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                🏟️ {locale === "sw" ? "Zote" : "All"}
              </button>
              {SPORTS_SUBCATEGORIES.map((sub) => (
                <button
                  key={sub.value}
                  onClick={() => setSubCategory(sub.value)}
                  className={cn(
                    "shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-mono font-bold whitespace-nowrap border transition-colors flex items-center gap-1.5",
                    subCategory === sub.value
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {sub.icon.startsWith('/') ? (
                    <Image src={sub.icon} alt={sub.label} width={14} height={14} className="object-contain" />
                  ) : (<span>{sub.icon}</span>)}
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Markets Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-[var(--card)] border border-[var(--card-border)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-24 text-[var(--muted)]">
            <Funnel size={40} weight="duotone" className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">{t.markets.empty}</p>
            <p className="text-sm mb-6">{locale === "sw" ? "Jaribu kubadilisha vichujio au uunde la kwanza" : "Try adjusting your filters or create the first one"}</p>
            <Link href="/markets/create" className="px-6 py-2.5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase">
              {t.markets.create}
            </Link>
          </div>
        ) : (
          (() => {
            // Group markets by event
            interface MarketWithEvent {
              id: string;
              eventId?: string | null;
              event?: { id: string; title: string; imageUrl?: string; category?: string; subCategory?: string } | null;
              title: string;
              imageUrl?: string;
              category: string;
              subCategory?: string;
              price: { yes: number; no: number };
              yesPool?: number;
              noPool?: number;
              options?: string[];
              optionPools?: number[];
              optionPrices?: number[];
              totalVolume: number;
              resolvesAt: string;
              _count?: { trades: number };
            }
            
            const eventGroups = new Map<string, { event: { id: string; title: string; imageUrl?: string; category?: string; subCategory?: string }; markets: MarketWithEvent[] }>();
            const standaloneMarkets: MarketWithEvent[] = [];
            
            (markets as MarketWithEvent[]).forEach((m) => {
              if (m.eventId && m.event) {
                if (!eventGroups.has(m.eventId)) {
                  eventGroups.set(m.eventId, { event: m.event, markets: [] });
                }
                eventGroups.get(m.eventId)!.markets.push(m);
              } else {
                standaloneMarkets.push(m);
              }
            });

            const allItems: Array<{ type: 'event'; eventId: string; event: { id: string; title: string; imageUrl?: string; category?: string; subCategory?: string }; markets: MarketWithEvent[] } | { type: 'market'; market: MarketWithEvent }> = [];
            
            // Add events first
            eventGroups.forEach((group, eventId) => {
              allItems.push({ type: 'event', eventId, ...group });
            });
            
            // Add standalone markets
            standaloneMarkets.forEach((m) => {
              allItems.push({ type: 'market', market: m });
            });

            const renderItem = (item: typeof allItems[number], i: number, asHero = false, asCompact = false): ReactNode => {
              if (item.type === 'event') {
                const firstMarket = item.markets[0];
                const eventData = item.event as { id: string; title: string; imageUrl?: string; category?: string; subCategory?: string };
                const eventImage = eventData.imageUrl || firstMarket.imageUrl;
                const eventCategory = eventData.category || firstMarket.category;
                const eventSubCategory = eventData.subCategory || firstMarket.subCategory;
                return (
                  <EventCard
                    eventId={item.eventId}
                    eventTitle={eventData.title}
                    markets={item.markets as EventMarket[]}
                    category={eventCategory}
                    subCategory={eventSubCategory}
                    imageUrl={eventImage}
                    index={i}
                  />
                );
              }
              return (
                <MarketCard
                  market={item.market as unknown as Parameters<typeof MarketCard>[0]["market"]}
                  index={i}
                  hero={asHero}
                  compact={asCompact}
                />
              );
            };

            // Featured = TRENDING standalone markets (highest volume), top 5
            const featured = allItems
              .filter((it): it is Extract<typeof allItems[number], { type: 'market' }> => it.type === 'market')
              .sort((a, b) => (b.market.totalVolume || 0) - (a.market.totalVolume || 0))
              .slice(0, 5);
            const rest = allItems;

            return (
              <>
                {/* Featured hero deck — only on the "All" markets view */}
                {category === "all" && featured.length > 1 && (
                  <div className="sm:max-w-md">
                    <FeaturedDeck
                      label={locale === "sw" ? "Maarufu" : "Featured"}
                      items={featured.map((item, i) => ({
                        id: item.type === 'market' ? item.market.id : `e-${i}`,
                        render: () => renderItem(item, i, true),
                      }))}
                    />
                  </div>
                )}

                {/* Grouped sections (Limitless style): category headers outside the cards.
                    In "All" view group by category; within a category group by subcategory. */}
                {(() => {
                  const getCat = (item: typeof rest[number]) =>
                    item.type === 'market' ? (item.market.category || 'Other') : (item.event.category || item.markets[0]?.category || 'Other');
                  const getSub = (item: typeof rest[number]) =>
                    item.type === 'market' ? (item.market.subCategory || '') : (item.event.subCategory || item.markets[0]?.subCategory || '');

                  const groups = new Map<string, typeof rest>();
                  rest.forEach((item) => {
                    const key = category === "all" ? getCat(item) : (getSub(item) || (locale === "sw" ? "Nyingine" : "Other"));
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(item);
                  });

                  let runningIndex = 0;
                  return [...groups.entries()].map(([groupName, items], gi) => (
                    <div key={groupName}>
                      <section className="mb-8">
                        {/* Section header — category/subcategory + count, outside the cards.
                            In "All" view the category heading is clickable → its category page. */}
                        <div className="flex items-baseline gap-2 mb-3 border-b border-[var(--card-border)] pb-2">
                          {category === "all" ? (
                            <button
                              onClick={() => {
                                setCategory(groupName);
                                setSubCategory("all");
                                setSort("new");
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="group/cat flex items-baseline gap-1.5 text-left hover:text-[var(--accent)] transition-colors"
                            >
                              <h2 className="text-lg font-mono font-black">
                                {locale === "sw" ? (t.markets.categories as Record<string, string>)[groupName.toLowerCase()] || groupName : groupName}
                              </h2>
                              <CaretRight size={14} weight="bold" className="self-center text-[var(--muted)] group-hover/cat:text-[var(--accent)] group-hover/cat:translate-x-0.5 transition-all" />
                            </button>
                          ) : (
                            <h2 className="text-lg font-mono font-black">{groupName}</h2>
                          )}
                          <span className="text-sm font-mono text-[var(--muted)]">({items.length})</span>
                        </div>

                        {/* Subcategory chips under the Sports heading (Limitless style) */}
                        {category === "all" && groupName === "Sports" && (
                          <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x pb-1 mb-4">
                            <button
                              onClick={() => { setCategory("Sports"); setSubCategory("all"); setSort("new"); }}
                              className="shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-mono font-bold whitespace-nowrap border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors flex items-center gap-1.5"
                            >
                              🏟️ {locale === "sw" ? "Zote" : "All"}
                            </button>
                            {SPORTS_SUBCATEGORIES.map((sub) => (
                              <button
                                key={sub.value}
                                onClick={() => { setCategory("Sports"); setSubCategory(sub.value); setSort("new"); }}
                                className="shrink-0 snap-start px-3 py-1.5 rounded-full text-[12px] font-mono font-bold whitespace-nowrap border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]/50 transition-colors flex items-center gap-1.5"
                              >
                                {sub.icon.startsWith('/') ? (
                                  <Image src={sub.icon} alt={sub.label} width={14} height={14} className="object-contain" />
                                ) : (<span>{sub.icon}</span>)}
                                {sub.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {category === "all" ? (
                          /* "All" view: horizontal swipe row on mobile, grid on desktop */
                          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible snap-x scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
                            {items.map((item) => {
                              const node = renderItem(item, runningIndex++);
                              return (
                                <div key={item.type === 'event' ? item.eventId : item.market.id} className="snap-start shrink-0 w-[85%] sm:w-auto">{node}</div>
                              );
                            })}
                          </div>
                        ) : (
                          /* Dedicated category page: full clear cards, 1-up on mobile (stacked) */
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item) => {
                              const node = renderItem(item, runningIndex++);
                              return (
                                <div key={item.type === 'event' ? item.eventId : item.market.id}>{node}</div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                      {/* Referral banner injected after the first group (mid-feed, Limitless style) */}
                      {gi === 0 && (
                        <div className="mb-8">
                          <ReferralBanner />
                        </div>
                      )}
                      {/* Creator rewards banner injected mid-feed after the second group */}
                      {gi === 1 && (
                        <div className="mb-8">
                          <CreatorRewardsBanner />
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </>
            );
          })()
        )}
      </div>
      
      {/* Creator rewards promo (mirrors referral banner) */}
      <div className="max-w-7xl mx-auto px-4 pt-2 pb-4">
        <CreatorRewardsBanner />
      </div>

      {/* Email Subscribe Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-[var(--card)] border border-[var(--card-border)] p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-mono font-bold text-lg mb-1">
                {locale === "sw" ? "📬 Pokea Arifa za Masoko" : "📬 Get Market Alerts"}
              </h3>
              <p className="text-sm text-[var(--muted)]">
                {locale === "sw" 
                  ? "Jiandikishe kupokea barua pepe za masoko mapya kila siku."
                  : "Subscribe to receive daily emails about new markets."}
              </p>
            </div>
            <div className="md:w-96">
              <EmailSubscribe />
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <MarketsContent />
    </Suspense>
  );
}
