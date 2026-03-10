"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, TrendUp, UsersThree } from "@phosphor-icons/react";
import { formatTZS, formatNumber, timeUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const yesPct = Math.round(market.price.yes * 100);
  const noPct = 100 - yesPct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link href={`/markets/${market.id}`}>
        <div className="group relative bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden hover:border-[var(--accent)]/40 transition-all duration-200 hover:shadow-lg hover:shadow-[var(--accent)]/5">
          {/* Category badge */}
          <div className="absolute top-3 right-3 z-10">
            <span className="px-2 py-0.5 bg-[var(--background)]/80 backdrop-blur text-xs rounded-full text-[var(--muted)] border border-[var(--card-border)]">
              {market.category}
            </span>
          </div>

          {/* Image or gradient header */}
          <div className="h-32 relative overflow-hidden">
            {market.imageUrl ? (
              <Image src={market.imageUrl!} alt={market.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--accent)]/10 to-[#00b4d8]/10 flex items-center justify-center">
                <TrendUp size={40} className="text-[var(--accent)]/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] to-transparent" />
          </div>

          <div className="px-4 pb-4 -mt-2">
            {/* Status */}
            {market.status === "RESOLVED" && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
                {t.market.resolved}
              </span>
            )}

            <h3 className="font-semibold text-sm leading-snug mb-3 group-hover:text-[var(--accent)] transition-colors line-clamp-2">
              {market.title}
            </h3>

            {/* Price bars */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#00e5a0]">YES</span>
                <span className="font-bold text-[#00e5a0]">{yesPct}%</span>
              </div>
              <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00e5a0] to-[#00c896] transition-all duration-500"
                  style={{ width: `${yesPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-red-400">NO</span>
                <span className="font-bold text-red-400">{noPct}%</span>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <TrendUp size={11} />
                  {formatTZS(market.totalVolume)}
                </span>
                {market._count && (
                  <span className="flex items-center gap-1">
                    <UsersThree size={11} />
                    {market._count.trades}
                  </span>
                )}
              </div>
              <span className={cn("flex items-center gap-1", market.status === "OPEN" ? "" : "text-blue-400")}>
                <Clock size={11} />
                {market.status === "OPEN" ? timeUntil(market.resolvesAt) : (locale === "sw" ? "Imemalizika" : "Ended")}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
