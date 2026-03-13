"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getMultiOptionPrices, getMultiOptionSharesOut } from "@/lib/amm";

// ── Simulation config ──────────────────────────────────────────────────
const OPTIONS = ["Chelsea", "Newcastle", "Draw"];
const INIT_POOL = 5000;
const FEE = 0.05;

interface SimTrade {
  option: number;
  amount: number;
  time: number;
}

// ── Chart internals (same as PriceChart) ───────────────────────────────
const COLORS = ["#00e5a0", "#ff4d6a", "#00b4d8", "#f59e0b", "#a78bfa"];

interface ChartPoint {
  t: number;
  prices: Record<string, number>;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const diff = (Date.now() - ms) / 86400000;
  if (diff < 1) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function bezier(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    d += ` C${cx},${pts[i - 1].y} ${cx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  return d;
}

// ── Generate random trades ─────────────────────────────────────────────
function generateTrades(count: number, durationHours: number): SimTrade[] {
  const now = Date.now();
  const start = now - durationHours * 3600000;
  const trades: SimTrade[] = [];

  // Weighted probabilities — Chelsea slightly favored, Draw least
  const weights = [0.45, 0.35, 0.2];

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let option = 0;
    if (r > weights[0]) option = r > weights[0] + weights[1] ? 2 : 1;

    // Vary trade sizes: mostly small, occasional big whale trades
    const isWhale = Math.random() < 0.08;
    const amount = isWhale
      ? Math.round(5000 + Math.random() * 15000)
      : Math.round(200 + Math.random() * 2000);

    // Spread trades over time with some clustering
    const progress = i / count;
    const jitter = (Math.random() - 0.5) * 0.05;
    const time = start + (progress + jitter) * (now - start);

    trades.push({ option, amount, time });
  }

  return trades.sort((a, b) => a.time - b.time);
}

// ── Replay trades through AMM ──────────────────────────────────────────
function replayTrades(trades: SimTrade[]): { points: ChartPoint[]; totalVolume: number; pools: number[] } {
  let pools = OPTIONS.map(() => INIT_POOL);
  const points: ChartPoint[] = [];
  let totalVolume = 0;

  // Initial equal prices
  const initPrices = getMultiOptionPrices(pools);
  const initMap: Record<string, number> = {};
  OPTIONS.forEach((o, i) => { initMap[o] = initPrices[i]; });
  points.push({ t: trades.length > 0 ? trades[0].time - 60000 : Date.now() - 3600000, prices: initMap });

  for (const trade of trades) {
    const feeAmt = Math.round(trade.amount * FEE);
    const tradeAmt = trade.amount - feeAmt;
    totalVolume += trade.amount;

    try {
      const result = getMultiOptionSharesOut(tradeAmt, trade.option, pools);
      pools = result.newPools;
    } catch { continue; }

    const prices = getMultiOptionPrices(pools);
    const priceMap: Record<string, number> = {};
    OPTIONS.forEach((o, i) => { priceMap[o] = prices[i]; });
    points.push({ t: trade.time, prices: priceMap });
  }

  // Current live point
  const livePrices = getMultiOptionPrices(pools);
  const liveMap: Record<string, number> = {};
  OPTIONS.forEach((o, i) => { liveMap[o] = livePrices[i]; });
  points.push({ t: Date.now(), prices: liveMap });

  return { points, totalVolume, pools };
}

// ── Simulation Chart (inline, same render as PriceChart) ───────────────
function SimChart({ points, opts }: { points: ChartPoint[]; opts: string[] }) {
  const [hIdx, setHIdx] = useState<number | null>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set(opts));
  const [drawn, setDrawn] = useState(false);
  const [tick, setTick] = useState(0);
  const [cw, setCw] = useState(700);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisible(new Set(opts)); }, [opts]);
  useEffect(() => { if (points.length >= 2) { const t = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(t); } }, [points.length]);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 530); return () => clearInterval(i); }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setCw(Math.round(e.contentRect.width));
    });
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const W = cw || 700, H = 320;
  const P = { t: 28, r: 56, b: 36, l: 48 };

  const cd = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0].t, t1 = points[points.length - 1].t, tr = t1 - t0 || 1;
    let lo = 1, hi = 0;
    for (const p of points) for (const o of opts) { if (!visible.has(o)) continue; const v = p.prices[o] ?? 0; if (v < lo) lo = v; if (v > hi) hi = v; }
    const pad = Math.max((hi - lo) * 0.18, 0.04);
    lo = Math.max(0, lo - pad); hi = Math.min(1, hi + pad);
    return { t0, t1, tr, lo, hi, yr: hi - lo || 0.1 };
  }, [points, opts, visible]);

  const xy = useCallback((t: number, v: number) => {
    if (!cd) return { x: 0, y: 0 };
    return {
      x: P.l + ((t - cd.t0) / cd.tr) * (W - P.l - P.r),
      y: P.t + (1 - (v - cd.lo) / cd.yr) * (H - P.t - P.b),
    };
  }, [cd, W]);

  const nearest = useCallback((cx: number) => {
    if (!svgRef.current || !cd || points.length < 2) return;
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((cx - r.left) / r.width) * W;
    const rel = (sx - P.l) / (W - P.l - P.r);
    const tgt = cd.t0 + rel * cd.tr;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < points.length; i++) { const d = Math.abs(points[i].t - tgt); if (d < bd) { bd = d; bi = i; } }
    setHIdx(bi);
  }, [cd, points, W]);

  const toggle = (o: string) => setVisible(p => {
    const n = new Set(p); if (n.has(o)) { if (n.size > 1) n.delete(o); } else n.add(o); return n;
  });

  if (points.length < 2 || !cd) return (
    <div className="border border-[var(--card-border)] bg-[var(--card)] h-[280px] flex items-center justify-center">
      <span className="text-xs font-mono text-[var(--muted)]">No data yet...</span>
    </div>
  );

  const dp = hIdx !== null ? points[hIdx] : points[points.length - 1];
  const cursorOn = tick % 2 === 0;

  const step = cd.yr > 0.3 ? 0.25 : cd.yr > 0.1 ? 0.1 : 0.05;
  const grids: { y: number; l: string }[] = [];
  for (let v = Math.ceil(cd.lo / step) * step; v <= cd.hi; v += step) grids.push({ y: xy(cd.t0, v).y, l: `${Math.round(v * 100)}%` });

  const tls: { x: number; l: string }[] = [];
  for (let i = 0; i <= 4; i++) { const t = cd.t0 + (cd.tr * i) / 4; tls.push({ x: xy(t, cd.lo).x, l: fmtTime(t) }); }

  const lines = opts.map((o, i) => {
    if (!visible.has(o)) return null;
    const c = COLORS[i % COLORS.length];
    const pts = points.map(p => { const v = p.prices[o]; return v != null ? xy(p.t, v) : null; }).filter(Boolean) as { x: number; y: number }[];
    if (pts.length < 2) return null;
    const path = bezier(pts);
    const last = pts[pts.length - 1];
    const first = pts[0];
    const area = path + ` L${last.x},${H - P.b} L${first.x},${H - P.b} Z`;
    let len = 0;
    for (let j = 1; j < pts.length; j++) len += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y);
    return { o, c, path, area, last, first, pts, len };
  }).filter(Boolean) as Array<{ o: string; c: string; path: string; area: string; last: { x: number; y: number }; first: { x: number; y: number }; pts: { x: number; y: number }[]; len: number }>;

  return (
    <div className="border border-[var(--card-border)] bg-[var(--card)] overflow-hidden relative">
      <style>{`
        @keyframes cDraw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        @keyframes cFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scanMove { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
        .c-line { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: cDraw 1.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        .c-line.ok { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
        .c-area { opacity: 0; animation: cFade 0.6s ease 0.8s forwards; }
        .c-area.ok { opacity: 1; animation: none; }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.03]">
        <div className="w-full h-[200%] animate-[scanMove_8s_linear_infinite]"
          style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, var(--foreground) 2px, var(--foreground) 3px)" }} />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--card-border)] relative z-20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {opts.map((o, i) => {
            const c = COLORS[i % COLORS.length];
            const on = visible.has(o);
            const v = dp.prices[o];
            return (
              <button key={o} onClick={() => toggle(o)}
                className={cn("flex items-center gap-1.5 transition-opacity duration-200", on ? "opacity-100" : "opacity-25 hover:opacity-50")}>
                <span className="text-[11px] font-mono" style={{ color: on ? c : "var(--muted)" }}>●</span>
                <span className="text-[11px] font-mono text-[var(--foreground)]">{o}</span>
                {v != null && <span className="text-[11px] font-mono font-bold" style={{ color: on ? c : "var(--muted)" }}>{(v * 100).toFixed(1)}%</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {hIdx !== null && <span className="text-[8px] font-mono text-[var(--muted)]">{fmtTime(dp.t)}</span>}
          <span className="text-[10px] font-mono text-[#00e5a0]" style={{ opacity: cursorOn ? 1 : 0 }}>▮</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div ref={wrapRef} className="relative z-20 bg-[var(--card)]">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[280px] sm:h-[320px] cursor-crosshair select-none bg-[var(--card)]"
          onMouseMove={e => nearest(e.clientX)} onMouseLeave={() => setHIdx(null)}
          onTouchMove={e => { e.preventDefault(); nearest(e.touches[0].clientX); }} onTouchEnd={() => setHIdx(null)}>
          <defs>
            {lines.map(({ o, c }) => (
              <linearGradient key={`g-${o}`} id={`ag-${o}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.08" />
                <stop offset="50%" stopColor={c} stopOpacity="0.03" />
                <stop offset="100%" stopColor={c} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Dot grid */}
          {(() => {
            const dots: React.JSX.Element[] = [];
            const sx = (W - P.l - P.r) / 20, sy = (H - P.t - P.b) / 12;
            for (let ix = 0; ix <= 20; ix++) for (let iy = 0; iy <= 12; iy++) {
              dots.push(<circle key={`${ix}-${iy}`} cx={P.l + ix * sx} cy={P.t + iy * sy} r="0.5" fill="var(--foreground)" opacity="0.06" />);
            }
            return dots;
          })()}

          {grids.map((g, i) => (
            <g key={i}>
              <line x1={P.l} y1={g.y} x2={W - P.r} y2={g.y} stroke="var(--foreground)" strokeWidth="0.3" opacity="0.08" strokeDasharray="2,6" />
              <text x={P.l - 6} y={g.y + 3} fill="var(--foreground)" fontSize="8" fontFamily="monospace" textAnchor="end" opacity="0.3">{g.l}</text>
            </g>
          ))}

          {tls.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={H - P.b} x2={t.x} y2={H - P.b + 4} stroke="var(--foreground)" strokeWidth="0.3" opacity="0.15" />
              <text x={t.x} y={H - 8} fill="var(--foreground)" fontSize="7.5" fontFamily="monospace" textAnchor="middle" opacity="0.3">{t.l}</text>
            </g>
          ))}

          {lines.length === 1 && lines.map(({ o, area }) => (
            <path key={`a-${o}`} d={area} fill={`url(#ag-${o})`} className={drawn ? "c-area ok" : "c-area"} />
          ))}

          {lines.map(({ o, c, path, len }) => (
            <path key={`l-${o}`} d={path} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className={drawn ? "c-line ok" : "c-line"} style={{ "--len": len } as React.CSSProperties} />
          ))}

          {lines.map(({ o, c, pts }) => pts.map((pt, j) => (
            j > 0 && j < pts.length - 1 ? (
              <line key={`t-${o}-${j}`} x1={pt.x} y1={pt.y - 3} x2={pt.x} y2={pt.y + 3}
                stroke={c} strokeWidth="0.8" opacity="0.35" />
            ) : null
          )))}

          {lines.map(({ o, c, last }) => {
            const val = dp.prices[o];
            if (val == null) return null;
            const chartRight = W - P.r;
            const badgeX = chartRight + 4;
            return (
              <g key={`end-${o}`}>
                <line x1={last.x} y1={last.y} x2={chartRight} y2={last.y}
                  stroke={c} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.4" />
                <rect x={badgeX} y={last.y - 8} width="44" height="16" rx="3" fill={c} />
                <text x={badgeX + 22} y={last.y + 3.5} fill="#000" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  {(val * 100).toFixed(1)}%
                </text>
                <rect x={last.x - 1} y={last.y - 6} width="2.5" height="12" rx="0.5" fill={c}
                  opacity={cursorOn ? 1 : 0.15} />
              </g>
            );
          })}

          {hIdx !== null && (() => {
            const p = points[hIdx];
            const fv = opts.find(o => visible.has(o));
            if (!fv) return null;
            const { x } = xy(p.t, p.prices[fv] ?? 0.5);
            return (
              <g>
                <line x1={x} y1={P.t} x2={x} y2={H - P.b} stroke="var(--foreground)" strokeWidth="0.5" opacity="0.15" />
                <rect x={x - 24} y={H - P.b + 2} width="48" height="12" rx="2" fill="var(--foreground)" opacity="0.1" />
                <text x={x} y={H - P.b + 11} fill="var(--foreground)" fontSize="7" fontFamily="monospace" textAnchor="middle" opacity="0.5">
                  {fmtTime(p.t)}
                </text>
                {lines.map(({ o, c }) => {
                  const v = p.prices[o]; if (v == null) return null;
                  const pt = xy(p.t, v);
                  return (
                    <g key={`h-${o}`}>
                      <circle cx={pt.x} cy={pt.y} r="3.5" fill="none" stroke={c} strokeWidth="1.5" />
                      <circle cx={pt.x} cy={pt.y} r="1.5" fill={c} />
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </svg>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--card-border)] relative z-20">
        <span className="text-[8px] font-mono text-[var(--foreground)] opacity-20 uppercase tracking-widest">
          {points.length} TICKS · SIMULATION
        </span>
        <span className="text-[8px] font-mono text-[#00e5a0]" style={{ opacity: cursorOn ? 0.6 : 0.15 }}>▮ SIMULATED</span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function SimulationPage() {
  const [tradeCount, setTradeCount] = useState(80);
  const [duration, setDuration] = useState(72); // hours
  const [seed, setSeed] = useState(0);

  const trades = useMemo(() => generateTrades(tradeCount, duration), [tradeCount, duration, seed]);
  const { points, totalVolume, pools } = useMemo(() => replayTrades(trades), [trades]);
  const finalPrices = useMemo(() => getMultiOptionPrices(pools), [pools]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-mono px-2 py-0.5 border border-[var(--accent)] text-[var(--accent)]">SIMULATION</span>
            <span className="text-[10px] font-mono text-[var(--muted)]">NOT REAL DATA</span>
          </div>
          <h1 className="text-2xl font-bold font-mono mb-1">Chelsea vs Newcastle</h1>
          <p className="text-sm text-[var(--muted)] font-mono">3-option market · {tradeCount} trades · {(duration / 24).toFixed(0)} days · TSh {totalVolume.toLocaleString()} volume</p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border border-[var(--card-border)] bg-[var(--card)] p-4">
            <label className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider block mb-2">Trade Count</label>
            <div className="flex gap-2">
              {[30, 80, 150, 300].map(n => (
                <button key={n} onClick={() => setTradeCount(n)}
                  className={cn("px-3 py-1.5 text-xs font-mono border transition-all",
                    tradeCount === n
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]/40"
                  )}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[var(--card-border)] bg-[var(--card)] p-4">
            <label className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider block mb-2">Duration</label>
            <div className="flex gap-2">
              {[{ h: 6, l: "6h" }, { h: 24, l: "1d" }, { h: 72, l: "3d" }, { h: 168, l: "7d" }].map(({ h, l }) => (
                <button key={h} onClick={() => setDuration(h)}
                  className={cn("px-3 py-1.5 text-xs font-mono border transition-all",
                    duration === h
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]/40"
                  )}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[var(--card-border)] bg-[var(--card)] p-4">
            <label className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider block mb-2">Randomize</label>
            <button onClick={() => setSeed(s => s + 1)}
              className="px-4 py-1.5 text-xs font-mono border border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-all">
              Re-roll Trades
            </button>
          </div>
        </div>

        {/* Chart */}
        <SimChart points={points} opts={OPTIONS} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {OPTIONS.map((opt, i) => (
            <div key={opt} className="border border-[var(--card-border)] bg-[var(--card)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono" style={{ color: COLORS[i] }}>●</span>
                <span className="text-sm font-mono font-bold">{opt}</span>
              </div>
              <div className="text-2xl font-mono font-bold" style={{ color: COLORS[i] }}>
                {(finalPrices[i] * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] font-mono text-[var(--muted)] mt-1">
                Pool: {pools[i].toLocaleString()} · {trades.filter(t => t.option === i).length} trades
              </div>
            </div>
          ))}
        </div>

        {/* Trade log */}
        <div className="mt-6 border border-[var(--card-border)] bg-[var(--card)]">
          <div className="px-4 py-2 border-b border-[var(--card-border)]">
            <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Recent Trades (last 20)</span>
          </div>
          <div className="divide-y divide-[var(--card-border)]">
            {trades.slice(-20).reverse().map((t, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono" style={{ color: COLORS[t.option] }}>●</span>
                  <span className="text-xs font-mono">{OPTIONS[t.option]}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-[var(--muted)]">TSh {t.amount.toLocaleString()}</span>
                  <span className="text-[10px] font-mono text-[var(--muted)]">{fmtTime(t.time)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-xs font-mono text-[var(--accent)] hover:underline">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
