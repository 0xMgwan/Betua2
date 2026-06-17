"use client";
import { useRef, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Trophy, ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";

interface DeckItem {
  id: string;
  render: () => ReactNode;
}

// Desktop hero (Limitless / Polymarket style): a branded promo panel on the
// left and a horizontal, arrow-navigable carousel of featured cards on the
// right. Cards scroll-snap; arrows page by one; dots track position.
export function FeaturedHero({
  items,
  eyebrow = "Featured",
  categories,
  headline = "Live prediction markets",
  subhead = "Trade live on Africa's prediction market.",
  ctaLabel = "Explore",
  ctaHref = "#",
}: {
  items: DeckItem[];
  eyebrow?: string;
  categories?: string[];
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(0);
  const [catIdx, setCatIdx] = useState(0);

  const CARD = 460; // card width + gap, for paging

  const page = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * CARD, behavior: "smooth" });
  };

  // Track active dot on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / CARD));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-advance the carousel every ~6.5s (pauses on hover); wraps to start.
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el || pausedRef.current) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + CARD, behavior: "smooth" });
    }, 6500);
    return () => clearInterval(id);
  }, [items.length]);

  // Rotate the category word in the headline every ~3s.
  useEffect(() => {
    if (!categories || categories.length < 2) return;
    const id = setInterval(() => setCatIdx((i) => (i + 1) % categories.length), 3000);
    return () => clearInterval(id);
  }, [categories]);

  if (items.length === 0) return null;

  const liveHeadline = categories && categories.length > 0
    ? `${categories[catIdx % categories.length]} markets, live`
    : headline;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--card-border)] mb-8">
      {/* Themed gradient band behind everything */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00e5a0]/15 via-[var(--card)] to-[var(--background)]" />
      <div className="absolute -left-16 -top-16 w-72 h-72 rounded-full bg-[#00e5a0]/15 blur-3xl pointer-events-none" />

      <div className="relative grid lg:grid-cols-[300px_1fr] gap-6 p-6">
        {/* Promo panel */}
        <div className="flex flex-col justify-between min-h-[260px]">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[#00e5a0]/15 border border-[#00e5a0]/40 flex items-center justify-center mb-4">
              <Trophy size={26} weight="fill" className="text-[#00e5a0]" />
            </div>
            <p className="text-[11px] font-mono font-black uppercase tracking-widest text-[#00e5a0] mb-2">★ {eyebrow}</p>
            <h2 className="font-mono text-2xl xl:text-3xl font-black leading-tight min-h-[2.4em]">{liveHeadline}</h2>
            <p className="text-sm text-[var(--muted)] mt-2">{subhead}</p>
          </div>
          <Link
            href={ctaHref}
            className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#00e5a0] text-black font-mono font-black text-sm uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity w-full sm:w-auto shadow-[0_4px_20px_rgba(0,229,160,0.35)]"
          >
            {ctaLabel}
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>

        {/* Carousel */}
        <div
          className="relative min-w-0"
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
        >
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 -mx-1 px-1"
          >
            {items.map((it) => (
              <div key={it.id} className="snap-start shrink-0 w-[444px] max-w-[82vw]">
                {it.render()}
              </div>
            ))}
          </div>

          {/* Arrows */}
          {items.length > 1 && (
            <>
              <button
                onClick={() => page(-1)}
                aria-label="Previous"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--card)] border border-[var(--card-border)] shadow-lg text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors"
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <button
                onClick={() => page(1)}
                aria-label="Next"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--card)] border border-[var(--card-border)] shadow-lg text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors"
              >
                <CaretRight size={16} weight="bold" />
              </button>
            </>
          )}

          {/* Dots */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {items.map((_, i) => (
                <span
                  key={i}
                  className={i === active
                    ? "w-5 h-1.5 rounded-full bg-[var(--accent)] transition-all"
                    : "w-1.5 h-1.5 rounded-full bg-[var(--card-border)] transition-all"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
