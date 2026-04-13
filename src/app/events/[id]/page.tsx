"use client";
import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { QuickBuyModal } from "@/components/QuickBuyModal";
import { UserAvatar } from "@/components/UserAvatar";
import { UserProfileModal } from "@/components/UserProfileModal";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/store/useCurrency";
import { useCart } from "@/store/useCart";
import { formatTZS, formatNumber, timeUntil, timeAgo, cn, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, TrendUp, ChartLineUp, Lightning, CaretRight,
  CheckCircle, XCircle, Pulse, Calendar, MapPin, ShoppingCart, Plus, PencilSimple,
  WhatsappLogo, XLogo, TelegramLogo, ShareNetwork,
} from "@phosphor-icons/react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: { username: string; avatarUrl?: string | null };
}

interface Market {
  id: string;
  title: string;
  status: string;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  options?: string[] | null;
  optionPools?: number[] | null;
  optionPrices?: number[] | null;
  resolvesAt: string;
  outcome?: number | null;
  outcomeLabel?: string | null;
  price: { yes: number; no: number };
  _count: { trades: number; comments: number };
}

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  status: string;
  totalVolume: number;
  totalTrades: number;
  markets: Market[];
  comments: Comment[];
  creator: { username: string; displayName?: string | null; avatarUrl?: string | null };
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const { t, locale } = useLanguage();
  const { format: formatAmount, currency } = useCurrency();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"markets" | "comments">("markets");
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((d) => setEvent(d.event))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !user || !event) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/events/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment }),
      });
      if (res.ok) {
        setComment("");
        // Refresh event data to show new comment
        const refreshed = await fetch(`/api/events/${id}`).then(r => r.json());
        setEvent(refreshed.event);
      }
    } finally {
      setCommentLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--card-border)] rounded w-1/2" />
            <div className="h-4 bg-[var(--card-border)] rounded w-1/3" />
            <div className="grid gap-4 mt-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-[var(--card-border)] rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold">Event not found</h1>
        </div>
      </div>
    );
  }

  const isLive = new Date(event.startsAt) <= new Date() && event.status !== "ENDED";
  const isUpcoming = new Date(event.startsAt) > new Date();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
        {/* Event Header - Compact */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          {/* Top row: Tags + Edit button */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <Link 
              href={`/markets?category=${event.category}`}
              className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#00e5a0]/20 text-[#00e5a0] border border-[#00e5a0]/30"
            >
              {event.category}
            </Link>
            {event.subCategory && (() => {
              const subCatInfo = SPORTS_SUBCATEGORIES.find(s => s.value === event.subCategory);
              return (
                <Link 
                  href={`/markets?category=${event.category}&subCategory=${event.subCategory}`}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1"
                >
                  {subCatInfo?.icon?.startsWith('/') ? (
                    <Image src={subCatInfo.icon} alt={event.subCategory} width={12} height={12} className="object-contain" />
                  ) : (
                    <span className="text-[10px]">{subCatInfo?.icon}</span>
                  )}
                  {event.subCategory}
                </Link>
              );
            })()}
            {isLive && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                <Pulse size={10} weight="fill" className="animate-pulse" /> LIVE
              </span>
            )}
            {isUpcoming && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                UPCOMING
              </span>
            )}
            {/* Edit + Share on right */}
            <div className="ml-auto flex items-center gap-1">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${event.title} - Bet now! ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-[#25D366] hover:bg-[#25D366]/20 rounded"
              >
                <WhatsappLogo size={16} weight="fill" />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(event.title)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-[var(--muted)] hover:bg-[var(--foreground)]/10 rounded"
              >
                <XLogo size={16} weight="fill" />
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(event.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-[#0088cc] hover:bg-[#0088cc]/20 rounded"
              >
                <TelegramLogo size={16} weight="fill" />
              </a>
              {user && event.creator.username === user.username && (
                <Link
                  href={`/events/${id}/edit`}
                  className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[var(--card)] text-[var(--muted)] border border-[var(--card-border)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1"
                >
                  <PencilSimple size={10} />
                  Edit
                </Link>
              )}
            </div>
          </div>

          {/* Title row with image */}
          <div className="flex gap-3 items-start">
            {event.imageUrl && (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--card-border)]">
                <Image
                  src={event.imageUrl}
                  alt={event.title}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight">{event.title}</h1>
              {event.description && (
                <p className="text-[var(--muted)] text-xs sm:text-sm line-clamp-2 mt-0.5">{event.description}</p>
              )}
              {/* Stats row */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(event.startsAt).toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <img 
                    src={currency === 'USDC' ? '/usdc.png' : '/ntzs.png'} 
                    alt={currency} 
                    className="w-3 h-3" 
                  />
                  {formatAmount(event.totalVolume)}
                </span>
                <span className="flex items-center gap-1">
                  <Lightning size={12} weight="fill" className="text-yellow-400" />
                  {event.totalTrades}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs - Markets & Comments */}
        <div className="mb-4">
          <div className="flex border-b border-[var(--card-border)] mb-4">
            {(["markets", "comments"] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setActiveTab(tb)}
                className={cn(
                  "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-all",
                  activeTab === tb
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                {tb === "markets" 
                  ? `${locale === "sw" ? "Masoko" : "Markets"} (${event.markets.length})`
                  : `${locale === "sw" ? "Maoni" : "Comments"} (${event.comments.length})`
                }
              </button>
            ))}
          </div>

          {activeTab === "markets" ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">
                  {locale === "sw" ? "Masoko" : "Markets"} ({event.markets.length})
                </h2>
                <Link
                  href={`/events/${id}/add-market`}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#0a0a0a] transition-colors"
                >
                  <Plus size={14} weight="bold" />
                  Add Market
                </Link>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {event.markets.map((market, idx) => (
                    <MarketRow key={market.id} market={market} index={idx} formatAmount={formatAmount} locale={locale} currency={currency} />
                  ))}
                </AnimatePresence>
              </div>

              {event.markets.length === 0 && (
                <div className="text-center py-12 text-[var(--muted)]">
                  <p>No markets yet for this event.</p>
                  {user && event.creator.username === user.username && (
                    <Link
                      href={`/events/${id}/add-market`}
                      className="inline-block mt-4 px-4 py-2 bg-[var(--accent)] text-[#0a0a0a] font-bold border-2 border-[var(--accent)] hover:bg-[var(--accent)]/90 transition-colors"
                    >
                      Create First Market
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Comments Tab */
            <div className="space-y-4">
              {user && (
                <form onSubmit={handleComment} className="flex gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={locale === "sw" ? "Shiriki mawazo yako…" : "Share your thoughts…"}
                    className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={commentLoading || !comment.trim()}
                    className="p-2 bg-orange-500 text-white rounded-lg disabled:opacity-50 hover:bg-orange-600 transition-all"
                  >
                    {commentLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-sm font-bold">Post</span>
                    )}
                  </button>
                </form>
              )}
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {event.comments.length === 0 ? (
                  <p className="text-center text-[var(--muted)] text-sm py-8">
                    {locale === "sw" ? "Hakuna maoni bado" : "No comments yet"}
                  </p>
                ) : (
                  event.comments.map((c) => (
                    <div key={c.id} className="flex gap-3 py-3 border-b border-[var(--card-border)] last:border-0">
                      <div className="flex-shrink-0">
                        <UserAvatar 
                          username={c.user.username} 
                          avatarUrl={c.user.avatarUrl} 
                          size="sm" 
                          onClick={setProfileUsername} 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button 
                            onClick={() => setProfileUsername(c.user.username)} 
                            className="text-sm font-bold hover:text-[var(--accent)] transition-colors"
                          >
                            @{c.user.username}
                          </button>
                          <span className="text-xs text-[var(--muted)]" title={new Date(c.createdAt).toLocaleString()}>
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--foreground)]">{c.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
      <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}

function MarketRow({
  market,
  index,
  formatAmount,
  locale,
  currency,
}: {
  market: Market;
  index: number;
  formatAmount: (n: number) => string;
  locale: string;
  currency: string;
}) {
  const { addItem } = useCart();
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<string>("yes");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | undefined>();
  
  const isMultiOption = market.options && market.options.length >= 2;
  const isResolved = market.status === "RESOLVED";

  const handleBuyClick = (side: string, optionIdx?: number) => {
    setSelectedSide(side);
    setSelectedOptionIndex(optionIdx);
    setQuickBuyOpen(true);
  };

  const handleAddToCart = (side: string, optionIdx?: number) => {
    const price = optionIdx !== undefined 
      ? (market.optionPrices?.[optionIdx] || 0.25)
      : (side === "yes" ? market.price.yes : market.price.no);
    
    addItem({
      marketId: market.id,
      marketTitle: market.title,
      side: optionIdx !== undefined ? (market.options?.[optionIdx] || `Option ${optionIdx}`) : side.toUpperCase(),
      optionIndex: optionIdx,
      amount: 1000, // Default amount in TZS
      estimatedShares: 1000 / price, // Rough estimate
      currentPrice: price,
      category: "Event",
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl hover:border-[var(--accent)]/30 transition-all group"
      >
        <Link href={`/markets/${market.id}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm group-hover:text-[var(--accent)] transition-colors">
              {market.title}
            </h3>
            <CaretRight size={16} className="text-[var(--muted)] group-hover:text-[var(--accent)]" />
          </div>
        </Link>

        {isMultiOption ? (
          // Multi-option display with trade buttons
          <div className="space-y-1.5">
            {market.options?.slice(0, 4).map((opt, i) => {
              const price = market.optionPrices?.[i] || 0;
              const isWinner = isResolved && market.outcome === i;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between text-sm px-2 py-1.5 rounded",
                    isWinner ? "bg-[#00e5a0]/20" : "bg-[var(--background)]"
                  )}
                >
                  <span className={cn("truncate flex-1", isWinner && "text-[#00e5a0] font-medium")}>
                    {isWinner && <CheckCircle size={12} className="inline mr-1" />}
                    {opt}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-mono text-xs", isWinner ? "text-[#00e5a0]" : "text-[var(--muted)]")}>
                      {Math.round(price * 100)}%
                    </span>
                    {!isResolved && (
                      <>
                        <button
                          onClick={() => handleBuyClick(`option_${i}`, i)}
                          className="px-2 py-1 text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                        >
                          BUY
                        </button>
                        <button
                          onClick={() => handleAddToCart(`option_${i}`, i)}
                          className="p-1 text-purple-400 hover:bg-purple-500/20 transition-colors rounded"
                          title="Add to cart"
                        >
                          <ShoppingCart size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {market.options && market.options.length > 4 && (
              <div className="text-xs text-[var(--muted)] text-center">
                +{market.options.length - 4} more options
              </div>
            )}
          </div>
        ) : (
          // Binary YES/NO display with trade buttons
          <div className="flex gap-2">
            <div
              className={cn(
                "flex-1 rounded-lg overflow-hidden",
                isResolved && market.outcome === 1
                  ? "bg-[#00e5a0]/20 border border-[#00e5a0]/30"
                  : "bg-[var(--background)]"
              )}
            >
              <div className="px-3 py-2 text-center">
                <div className="text-xs text-[var(--muted)] mb-0.5">YES</div>
                <div className={cn(
                  "font-bold",
                  isResolved && market.outcome === 1 ? "text-[#00e5a0]" : ""
                )}>
                  {Math.round(market.price.yes * 100)}%
                </div>
              </div>
              {!isResolved && (
                <div className="flex border-t border-[#00e5a0]/30">
                  <button
                    onClick={() => handleBuyClick("yes")}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-[#00e5a0]/20 text-[#00e5a0] hover:bg-[#00e5a0]/30 transition-colors"
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => handleAddToCart("yes")}
                    className="px-2 py-1.5 bg-[#00e5a0]/10 text-[#00e5a0] hover:bg-[#00e5a0]/20 transition-colors border-l border-[#00e5a0]/30"
                    title="Add to cart"
                  >
                    <ShoppingCart size={10} />
                  </button>
                </div>
              )}
            </div>
            <div
              className={cn(
                "flex-1 rounded-lg overflow-hidden",
                isResolved && market.outcome === 0
                  ? "bg-red-500/20 border border-red-500/30"
                  : "bg-[var(--background)]"
              )}
            >
              <div className="px-3 py-2 text-center">
                <div className="text-xs text-[var(--muted)] mb-0.5">NO</div>
                <div className={cn(
                  "font-bold",
                  isResolved && market.outcome === 0 ? "text-red-400" : ""
                )}>
                  {Math.round(market.price.no * 100)}%
                </div>
              </div>
              {!isResolved && (
                <div className="flex border-t border-red-500/30">
                  <button
                    onClick={() => handleBuyClick("no")}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => handleAddToCart("no")}
                    className="px-2 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border-l border-red-500/30"
                    title="Add to cart"
                  >
                    <ShoppingCart size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats row with currency icon and lightning emoji */}
        <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <TrendUp size={12} />
            <img 
              src={currency === 'USDC' ? '/usdc.png' : '/ntzs.png'} 
              alt={currency} 
              className="w-3 h-3" 
            />
            {formatAmount(market.totalVolume)}
          </span>
          <span className="flex items-center gap-1">
            <Lightning size={12} weight="fill" className="text-yellow-400" />
            {market._count.trades}
          </span>
          {!isResolved && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {timeUntil(market.resolvesAt)}
            </span>
          )}
          {isResolved && (
            <span className="text-[#00e5a0] flex items-center gap-1">
              <CheckCircle size={12} /> Resolved
            </span>
          )}
        </div>
      </motion.div>

      {/* Quick Buy Modal */}
      <QuickBuyModal
        isOpen={quickBuyOpen}
        onClose={() => setQuickBuyOpen(false)}
        market={{
          id: market.id,
          title: market.title,
          price: market.price,
          optionPrices: market.optionPrices || undefined,
          yesPool: market.yesPool,
          noPool: market.noPool,
          optionPools: market.optionPools || undefined,
          resolvesAt: market.resolvesAt,
          status: market.status,
          totalVolume: market.totalVolume,
        }}
        side={selectedSide}
        optionIndex={selectedOptionIndex}
        displaySide={selectedOptionIndex !== undefined ? market.options?.[selectedOptionIndex] : selectedSide.toUpperCase()}
      />
    </>
  );
}
