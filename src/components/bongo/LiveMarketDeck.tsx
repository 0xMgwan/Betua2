"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Mk {
  id: string;
  title: string;
  category?: string | null;
  imageUrl?: string | null;
  totalVolume: number;
  options?: string[] | null;
  optionPrices?: number[] | null;
  price: { yes: number; no: number };
}

interface Lane { topPct: number; rightPct: number; delay: number; dur: number }

// Three drifting lanes down the right-hand side of the hero.
const LANES: Lane[] = [
  { topPct: 12, rightPct: 4, delay: 0, dur: 7.5 },
  { topPct: 40, rightPct: 17, delay: -2.4, dur: 8.5 },
  { topPct: 68, rightPct: 3, delay: -4.8, dur: 9.5 },
];

/** Headline outcome + its implied multiple, for whichever market shape it is. */
function headline(m: Mk): { label: string; pct: number; mult: string } {
  if (m.options?.length && m.optionPrices?.length) {
    let bi = 0;
    m.optionPrices.forEach((p, i) => { if (p > (m.optionPrices as number[])[bi]) bi = i; });
    const p = m.optionPrices[bi] || 0.5;
    return { label: m.options[bi] || "—", pct: Math.round(p * 100), mult: p > 0 ? (1 / p).toFixed(2) : "∞" };
  }
  const p = m.price?.yes ?? 0.5;
  return { label: "YES", pct: Math.round(p * 100), mult: p > 0 ? (1 / p).toFixed(2) : "∞" };
}

const fmtVol = (v: number) =>
  v >= 1_000_000 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);

/**
 * Live market cards drifting down the right of the hero. Replaces the static
 * text callouts: these are real open markets, rotating every few seconds, and
 * clicking one opens it.
 */
export function LiveMarketDeck() {
  const [markets, setMarkets] = useState<Mk[]>([]);
  const [slot, setSlot] = useState(0);
  const router = useRouter();
  const paused = useRef(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/markets?limit=12&sort=volume")
      .then((r) => r.json())
      .then((d) => { if (alive) setMarkets((d.markets || []).filter((m: Mk) => m?.id)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Rotate which markets occupy the three lanes.
  useEffect(() => {
    if (markets.length <= LANES.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!paused.current) setSlot((s) => s + 1); }, 4200);
    return () => clearInterval(t);
  }, [markets.length]);

  if (markets.length === 0) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-[46%] z-20 hidden lg:block pointer-events-none">
      {LANES.map((lane, i) => {
        const m = markets[(slot * LANES.length + i) % markets.length];
        if (!m) return null;
        const h = headline(m);
        return (
          <div
            key={`${lane.topPct}-${m.id}`}
            className="bl-drift absolute pointer-events-auto"
            style={{ top: `${lane.topPct}%`, right: `${lane.rightPct}%`, animationDelay: `${lane.delay}s`, animationDuration: `${lane.dur}s` }}
            onMouseEnter={() => { paused.current = true; }}
            onMouseLeave={() => { paused.current = false; }}
          >
            <button
              type="button"
              onClick={() => router.push(`/markets/${m.id}`)}
              className="bl-card bl-card-sm bl-mkt block w-[260px] text-left overflow-hidden"
              style={{ background: "#fffdf8", borderColor: "#141414", color: "#141414" }}
            >
              <div className="flex items-start gap-2.5 p-3 pb-2">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover border-2 border-[#141414] shrink-0" />
                ) : (
                  <span className="w-9 h-9 rounded-md shrink-0 border-2 border-[#141414] grid place-items-center text-[11px] font-black" style={{ background: "var(--gold)" }}>
                    {(m.category || "M").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-[.1em]" style={{ color: "#8a8378" }}>
                    {m.category || "Market"}
                  </span>
                  <span className="text-[12.5px] font-extrabold leading-tight line-clamp-2">{m.title}</span>
                </span>
              </div>

              {/* Probability bar */}
              <div className="px-3">
                <div className="flex items-center justify-between text-[10px] font-black mb-1">
                  <span className="truncate pr-2">{h.label}</span>
                  <span style={{ color: "var(--green)" }}>{h.pct}%</span>
                </div>
                <div className="h-[7px] rounded-full overflow-hidden border border-[#141414]/25" style={{ background: "#eae4d6" }}>
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(h.pct, 3)}%`, background: "var(--green)" }} />
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 mt-2 border-t-2 border-[#141414]">
                <span className="text-[10px] font-bold" style={{ color: "#8a8378" }}>TSh {fmtVol(m.totalVolume)} vol</span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-[#141414]" style={{ background: "var(--gold)" }}>
                  {h.mult}×
                </span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
