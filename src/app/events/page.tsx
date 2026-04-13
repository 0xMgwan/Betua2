"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/store/useCurrency";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, TrendUp, Lightning, CaretRight, Plus, Pulse,
  SoccerBall, Trophy, ChartLineUp, Globe,
} from "@phosphor-icons/react";

interface EventSummary {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  status: string;
  totalVolume: number;
  marketsCount: number;
  openMarkets: number;
  creator: { username: string; displayName?: string | null };
}

const CATEGORIES = [
  { id: "all", label: "All", labelSw: "Zote", icon: Globe },
  { id: "Sports", label: "Sports", labelSw: "Michezo", icon: SoccerBall },
  { id: "Politics", label: "Politics", labelSw: "Siasa", icon: Trophy },
  { id: "Crypto", label: "Crypto", labelSw: "Crypto", icon: ChartLineUp },
];

export default function EventsPage() {
  const { user } = useUser();
  const { t, locale } = useLanguage();
  const { format: formatAmount } = useCurrency();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (status) params.set("status", status);

    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .finally(() => setLoading(false));
  }, [category, status]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {locale === "sw" ? "Matukio" : "Events"}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {locale === "sw"
                ? "Masoko mengi kwa tukio moja"
                : "Multiple markets for a single event"}
            </p>
          </div>
          {user && (
            <Link
              href="/events/create"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg font-medium hover:opacity-90"
            >
              <Plus size={16} weight="bold" />
              {locale === "sw" ? "Unda Tukio" : "Create Event"}
            </Link>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                category === cat.id
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              <cat.icon size={14} />
              {locale === "sw" ? cat.labelSw : cat.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 mb-6">
          {[
            { id: null, label: "All", labelSw: "Zote" },
            { id: "LIVE", label: "Live Now", labelSw: "Sasa Hivi" },
            { id: "UPCOMING", label: "Upcoming", labelSw: "Inakuja" },
            { id: "ENDED", label: "Ended", labelSw: "Imekwisha" },
          ].map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => setStatus(s.id)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-all",
                status === s.id
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              {locale === "sw" ? s.labelSw : s.label}
            </button>
          ))}
        </div>

        {/* Events List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-[var(--card-border)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted)]">
            <p className="mb-4">
              {locale === "sw" ? "Hakuna matukio bado" : "No events yet"}
            </p>
            {user && (
              <Link
                href="/events/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg font-medium"
              >
                <Plus size={16} weight="bold" />
                {locale === "sw" ? "Unda Tukio la Kwanza" : "Create First Event"}
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {events.map((event, idx) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={idx}
                  formatAmount={formatAmount}
                  locale={locale}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function EventCard({
  event,
  index,
  formatAmount,
  locale,
}: {
  event: EventSummary;
  index: number;
  formatAmount: (n: number) => string;
  locale: string;
}) {
  const isLive = new Date(event.startsAt) <= new Date() && event.status !== "ENDED";
  const isUpcoming = new Date(event.startsAt) > new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={`/events/${event.id}`}
        className="block p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl hover:border-[var(--accent)]/30 transition-all group"
      >
        <div className="flex gap-4">
          {/* Image */}
          {event.imageUrl ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--card-border)]">
              <Image
                src={event.imageUrl}
                alt={event.title}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-[var(--card-border)] flex items-center justify-center flex-shrink-0">
              <SoccerBall size={24} className="text-[var(--muted)]" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Category & Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[var(--muted)]">{event.category}</span>
              {event.subCategory && (
                <>
                  <span className="text-[var(--muted)]">•</span>
                  <span className="text-xs text-[var(--muted)]">{event.subCategory}</span>
                </>
              )}
              {isLive && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded flex items-center gap-0.5">
                  <Pulse size={10} weight="fill" className="animate-pulse" /> LIVE
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-semibold text-sm mb-2 group-hover:text-[var(--accent)] transition-colors truncate">
              {event.title}
            </h3>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
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
                <Lightning size={12} />
                {event.marketsCount} {locale === "sw" ? "masoko" : "markets"}
              </span>
              <span className="flex items-center gap-1">
                <TrendUp size={12} />
                {formatAmount(event.totalVolume)}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center">
            <CaretRight size={20} className="text-[var(--muted)] group-hover:text-[var(--accent)]" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
