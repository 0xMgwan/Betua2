"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, TrendUp, UsersThree } from "@phosphor-icons/react";
import { formatTZS, formatNumber, timeUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuickBuyModal } from "./QuickBuyModal";

interface Market {
  id: string;
  title: string;
  category: string;
  imageUrl?: string | null;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  resolvesAt: string;
  status: string;
  price: { yes: number; no: number };
  _count?: { trades: number };
  creator?: { username: string };
}

export function MarketCard({ market, index = 0 }: { market: Market; index?: number }) {
  const { t, locale } = useLanguage();
  const [imageError, setImageError] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO" | null>(null);
  const yesPct = Math.round(market.price.yes * 100);
  const noPct = 100 - yesPct;

  const handleQuickBuy = (e: React.MouseEvent, side: "YES" | "NO") => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSide(side);
    setShowBuyModal(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link href={`/markets/${market.id}`}>
        <div className="group relative bg-[var(--card)] border-2 border-[var(--card-border)] rounded-none overflow-hidden hover:border-[var(--accent)] transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,229,160,0.15)]">
          {/* Terminal-style header bar */}
          <div className="bg-[var(--background)] border-b-2 border-[var(--card-border)] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]/70"></div>
              </div>
              <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                [{market.category}]
              </span>
            </div>
            {market.status === "RESOLVED" && (
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider border border-blue-400/30 px-2 py-0.5">
                ● RESOLVED
              </span>
            )}
          </div>

          {/* Image section with scanline effect */}
          <div className="h-32 relative overflow-hidden bg-gradient-to-br from-[var(--accent)]/5 to-[#00b4d8]/5">
            {market.imageUrl && !imageError ? (
              <>
                <img 
                  src={market.imageUrl} 
                  alt={market.title} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                  onError={() => setImageError(true)}
                />
                {/* Scanline overlay */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] pointer-events-none"></div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <TrendUp size={48} className="text-[var(--accent)]/20" weight="duotone" />
              </div>
            )}
            {/* CRT glow effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] via-transparent to-transparent pointer-events-none"></div>
          </div>

          <div className="p-4 space-y-3">
            {/* Title with terminal cursor */}
            <h3 className="font-mono text-sm font-bold leading-tight group-hover:text-[var(--accent)] transition-colors line-clamp-2">
              <span className="text-[var(--accent)]">$</span> {market.title}
              <span className="inline-block w-2 h-4 bg-[var(--accent)] ml-1 animate-pulse"></span>
            </h3>

            {/* Terminal-style price display */}
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#00e5a0]">[YES]</span>
                <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                <span className="text-[#00e5a0] font-bold tabular-nums">{yesPct}%</span>
              </div>
              {/* ASCII-style progress bar */}
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-[#00e5a0]">█</span>
                <div className="flex-1 bg-[var(--background)] h-3 border border-[var(--card-border)] overflow-hidden">
                  <div
                    className="h-full bg-[#00e5a0] transition-all duration-500 relative"
                    style={{ width: `${yesPct}%` }}
                  >
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(0,0,0,0.2)_2px,rgba(0,0,0,0.2)_4px)]"></div>
                  </div>
                </div>
                <span className="text-red-400">█</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-red-400">[NO]</span>
                <div className="flex-1 mx-2 border-b border-dashed border-[var(--card-border)]"></div>
                <span className="text-red-400 font-bold tabular-nums">{noPct}%</span>
              </div>
            </div>

            {/* Quick Buy Buttons - Terminal style */}
            {market.status === "OPEN" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={(e) => handleQuickBuy(e, "YES")}
                  className="py-2.5 px-3 bg-[#00e5a0]/10 hover:bg-[#00e5a0]/20 border-2 border-[#00e5a0] text-[#00e5a0] font-mono font-bold text-xs uppercase tracking-wider transition-all hover:shadow-[0_0_10px_rgba(0,229,160,0.3)] active:scale-95"
                >
                  &gt; BUY YES
                </button>
                <button
                  onClick={(e) => handleQuickBuy(e, "NO")}
                  className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500 text-red-400 font-mono font-bold text-xs uppercase tracking-wider transition-all hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] active:scale-95"
                >
                  &gt; BUY NO
                </button>
              </div>
            )}

            {/* Terminal-style footer */}
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--muted)] pt-2 border-t border-[var(--card-border)]">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-[var(--accent)]">↗</span>
                  <img src="/ntzs.png" alt="nTZS" className="w-3 h-3 inline-block opacity-70" />
                  <span className="hidden xs:inline">{formatTZS(market.totalVolume)}</span>
                  <span className="xs:hidden">{market.totalVolume >= 1000 ? `${(market.totalVolume / 1000).toFixed(1)}K` : market.totalVolume}</span>
                </span>
                {market._count && (
                  <span className="flex items-center gap-1">
                    <span className="text-[var(--accent)]">◉</span>
                    {market._count.trades}
                  </span>
                )}
              </div>
              <span className={cn("flex items-center gap-1 text-[9px] sm:text-[10px]", market.status === "OPEN" ? "" : "text-blue-400")}>
                <span>⏱</span>
                <span className="hidden sm:inline">{market.status === "OPEN" ? timeUntil(market.resolvesAt) : (locale === "sw" ? "ENDED" : "ENDED")}</span>
                <span className="sm:hidden">{market.status === "OPEN" ? timeUntil(market.resolvesAt).split(" ")[0] : "END"}</span>
              </span>
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
          }}
          market={{
            id: market.id,
            title: market.title,
            price: market.price,
          }}
          side={selectedSide}
        />
      )}
    </motion.div>
  );
}
