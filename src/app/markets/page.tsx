"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { MarketCard } from "@/components/MarketCard";
import { motion } from "framer-motion";
import { MagnifyingGlass, Plus, Funnel } from "@phosphor-icons/react";
import Link from "next/link";
import { CATEGORIES, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Footer } from "@/components/Footer";

export default function MarketsPage() {
  const { t, locale } = useLanguage();

  const STATUSES = [
    { value: "OPEN", label: locale === "sw" ? "Wazi" : "Open" },
    { value: "RESOLVED", label: t.markets.resolved },
    { value: "all", label: t.markets.filters.all },
  ];

  const SORTS = [
    { value: "volume", label: locale === "sw" ? "Kiasi Kikubwa" : "Top Volume" },
    { value: "new", label: locale === "sw" ? "Mpya" : "Newest" },
  ];
  const [markets, setMarkets] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [subCategory, setSubCategory] = useState("all");
  const [status, setStatus] = useState("OPEN");
  const [sort, setSort] = useState("volume");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ status, sort });
    if (category !== "all") params.set("category", category);
    if (category === "Sports" && subCategory !== "all") params.set("subCategory", subCategory);
    if (search) params.set("q", search);

    fetch(`/api/markets?${params}`)
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets || []))
      .finally(() => setLoading(false));
  }, [category, subCategory, status, sort, search]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t.markets.title}</h1>
            <p className="text-[var(--muted)] text-sm mt-1">{markets.length} {locale === "sw" ? "masoko yamepatikana" : "markets found"}</p>
          </div>
          <Link
            href="/markets/create"
            className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all font-mono tracking-wider uppercase"
          >
            <Plus size={15} />
            {t.markets.create}
          </Link>
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

          {/* Filter row */}
          <div className="flex flex-wrap gap-3">
            {/* Status */}
            <div className="flex items-center bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-1 gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-all font-mono",
                    status === s.value
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-1 gap-1">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-all font-mono",
                    sort === s.value
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {["all", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setSubCategory("all"); }}
                className={cn(
                  "px-3 py-1 rounded-full text-sm transition-all font-mono",
                  category === c
                    ? "border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold"
                    : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {c === "all" ? (locale === "sw" ? "Jamii Zote" : "All Categories") : (locale === "sw" ? (t.markets.categories as Record<string, string>)[c.toLowerCase()] || c : c)}
              </button>
            ))}
          </div>

          {/* Sports Sub-categories */}
          {category === "Sports" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2"
            >
              <button
                onClick={() => setSubCategory("all")}
                className={cn(
                  "px-3 py-1.5 text-xs font-mono font-bold transition-all flex items-center gap-1.5 border",
                  subCategory === "all"
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                )}
              >
                🏟️ {locale === "sw" ? "Zote" : "All"}
              </button>
              {SPORTS_SUBCATEGORIES.map((sub) => (
                <button
                  key={sub.value}
                  onClick={() => setSubCategory(sub.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-mono font-bold transition-all flex items-center gap-1.5 border",
                    subCategory === sub.value
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                  )}
                >
                  {sub.icon.startsWith('/') ? (
                    <Image src={sub.icon} alt={sub.label} width={16} height={16} className="object-contain" />
                  ) : (
                    <span>{sub.icon}</span>
                  )}
                  {sub.label}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Grid */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((m: unknown, i) => (
              <MarketCard
                key={(m as { id: string }).id}
                market={m as Parameters<typeof MarketCard>[0]["market"]}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
