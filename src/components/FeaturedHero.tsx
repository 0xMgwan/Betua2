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
  headline = "Predict the moment. Earn GUAP.",
  subhead = "Trade live on Africa's prediction market.",
  ctaLabel = "Explore",
  ctaHref = "#",
}: {
  items: DeckItem[];
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const CARD = 460; // card width + gap, for paging

  const page = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * CARD, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / CARD));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--card-border)] mb-8">
      {/* Themed gradient band behind everything */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/18 via-[var(--card)] to-[var(--background)]" />
      <div className="absolute -left-16 -top-16 w-72 h-72 rounded-full bg-[var(--accent)]/15 blur-3xl pointer-events-none" />

      <div className="relative grid lg:grid-cols-[300px_1fr] gap-6 p-6">
        {/* Promo panel */}
        <div className="flex flex-col justify-between min-h-[260px]">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/40 flex items-center justify-center mb-4">
              <Trophy size={26} weight="fill" className="text-[var(--accent)]" />
            </div>
            <p className="text-[11px] font-mono font-black uppercase tracking-widest text-[var(--accent)] mb-2">★ {eyebrow}</p>
            <h2 className="font-mono text-2xl xl:text-3xl font-black leading-tight">{headline}</h2>
            <p className="text-sm text-[var(--muted)] mt-2">{subhead}</p>
          </div>
          <Link
            href={ctaHref}
            className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--accent)] text-[var(--background)] font-mono font-black text-sm uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            {ctaLabel}
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>

        {/* Carousel */}
        <div className="relative min-w-0">
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
