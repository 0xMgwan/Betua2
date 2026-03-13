"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, TrendUp, UsersThree, Lightning, Timer, ChartLineUp } from "@phosphor-icons/react";
import { formatTZS, formatNumber, timeUntil, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuickBuyModal } from "./QuickBuyModal";

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
  Sports: "#00b4d8",
  Entertainment: "#ec4899",
  Crypto: "#00e5a0",
  Business: "#8b5cf6",
  Science: "#14b8a6",
  Weather: "#6366f1",
  Technology: "#f97316",
  Other: "#94a3b8",
};

export function MarketCard({ market, index = 0 }: { market: Market; index?: number }) {
  const { t, locale } = useLanguage();
  const [imageError, setImageError] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const yesPctRaw = market.price.yes * 100;
  const noPctRaw = market.price.no * 100;
  const yesPct = yesPctRaw % 1 === 0 ? Math.round(yesPctRaw) : parseFloat(yesPctRaw.toFixed(1));
  const noPct = noPctRaw % 1 === 0 ? Math.round(noPctRaw) : parseFloat(noPctRaw.toFixed(1));
  const isMultiOption = market.options && market.options.length >= 2;
  const catColor = CATEGORY_COLORS[market.category] || "#94a3b8";
  const hasImage = market.imageUrl && !imageError;
  const isExpired = new Date(market.resolvesAt) < new Date();
  const isTradeable = market.status === "OPEN" && !isExpired;

  const handleQuickBuy = (e: React.MouseEvent, side: string, optionIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSide(side);
    setSelectedOptionIndex(optionIndex ?? null);
    setShowBuyModal(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link href={`/markets/${market.id}`}>
        <div className="group relative bg-[var(--card)] border border-[var(--card-border)] overflow-hidden hover:border-[var(--accent)]/60 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,229,160,0.1)]">
          {/* Accent top line */}
          <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${catColor}, transparent)` }} />

          <div className="p-3 sm:p-4">
            {/* Top row: Category + Status + Timer */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border"
                  style={{ borderColor: `${catColor}50`, color: catColor, backgroundColor: `${catColor}10` }}
                >
                  {market.category}
                </span>
                {market.status === "RESOLVED" && (
                  <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-wider px-1.5 py-0.5 border border-blue-400/30 bg-blue-400/10">
                    Resolved
                  </span>
                )}
                {market.subCategory && (
                  <span className="text-[9px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider px-1.5 py-0.5 border border-[var(--accent)]/30 bg-[var(--accent)]/10 flex items-center gap-1">
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
                  </span>
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
                {market.title}
              </h3>
            </div>

            {/* Price bars */}
            {isMultiOption ? (
              <div className="space-y-1.5 mb-3">
                {market.options!.map((opt, i) => {
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
                  {market.options!.slice(0, 4).map((option, idx) => {
                    const colors = ["#00e5a0", "#00b4d8", "#f59e0b", "#ef4444"];
                    const c = colors[idx % colors.length];
                    return (
                      <button
                        key={idx}
                        onClick={(e) => handleQuickBuy(e, option, idx)}
                        className="py-2 px-2 border font-mono font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95"
                        style={{
                          borderColor: `${c}60`,
                          color: c,
                          backgroundColor: `${c}08`,
                        }}
                      >
                        Buy {option.length > 10 ? option.slice(0, 10) + ".." : option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={(e) => handleQuickBuy(e, "YES")}
                    className="py-2 px-3 bg-[#00e5a0]/8 border border-[#00e5a0]/50 text-[#00e5a0] font-mono font-bold text-[11px] uppercase tracking-wider transition-all hover:bg-[#00e5a0]/15 hover:border-[#00e5a0] hover:shadow-[0_0_12px_rgba(0,229,160,0.2)] active:scale-[0.97]"
                  >
                    Buy Yes
                  </button>
                  <button
                    onClick={(e) => handleQuickBuy(e, "NO")}
                    className="py-2 px-3 bg-red-500/8 border border-red-500/50 text-red-400 font-mono font-bold text-[11px] uppercase tracking-wider transition-all hover:bg-red-500/15 hover:border-red-500 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] active:scale-[0.97]"
                  >
                    Buy No
                  </button>
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
      </Link>

      {/* Quick Buy Modal */}
      {showBuyModal && selectedSide && (
        <QuickBuyModal
          isOpen={showBuyModal}
          onClose={() => {
            setShowBuyModal(false);
            setSelectedSide(null);
            setSelectedOptionIndex(null);
          }}
          market={{
            id: market.id,
            title: market.title,
            price: market.price,
            optionPrices: market.optionPrices || undefined,
            yesPool: market.yesPool,
            noPool: market.noPool,
          }}
          side={selectedSide}
          optionIndex={selectedOptionIndex ?? undefined}
        />
      )}
    </motion.div>
  );
}
