"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ChartPoint {
  t: number;
  prices: Record<string, number>;
}

interface PriceChartProps {
  marketId: string;
  className?: string;
}

const COLORS = [
  "#00e5a0",
  "#ff4d6a",
  "#00b4d8",
  "#f59e0b",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#f472b6",
];

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

export function PriceChart({ marketId, className }: PriceChartProps) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [opts, setOpts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hIdx, setHIdx] = useState<number | null>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [drawn, setDrawn] = useState(false);
  const [tick, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchChart = useCallback(async () => {
    try {
      const r = await fetch(`/api/markets/${marketId}/chart`);
      if (!r.ok) return;
      const d = await r.json();
      setPoints(d.points || []);
      setOpts(d.options || []);
      setVisible(new Set(d.options || []));
    } catch { /* */ } finally { setLoading(false); }
  }, [marketId]);

  useEffect(() => { fetchChart(); const i = setInterval(fetchChart, 30000); return () => clearInterval(i); }, [fetchChart]);
  useEffect(() => { if (!loading && points.length >= 2) { const t = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(t); } }, [loading, points.length]);

  // Blink tick for cursor
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 530); return () => clearInterval(i); }, []);

  const W = 520, H = 280;
  const P = { t: 28, r: 20, b: 36, l: 48 };

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
  }, [cd]);

  const nearest = useCallback((cx: number) => {
    if (!svgRef.current || !cd || points.length < 2) return;
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((cx - r.left) / r.width) * W;
    const rel = (sx - P.l) / (W - P.l - P.r);
    const tgt = cd.t0 + rel * cd.tr;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < points.length; i++) { const d = Math.abs(points[i].t - tgt); if (d < bd) { bd = d; bi = i; } }
    setHIdx(bi);
  }, [cd, points]);

  const toggle = (o: string) => setVisible(p => {
    const n = new Set(p); if (n.has(o)) { if (n.size > 1) n.delete(o); } else n.add(o); return n;
  });

  // ─── LOADING ───
  if (loading) return (
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)]", className)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--card-border)]">
        <span className="text-[10px] font-mono text-[var(--accent)] animate-pulse">█</span>
        <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">SYS.CHART.LOAD</span>
      </div>
      <div className="h-[220px] sm:h-[280px] flex items-center justify-center">
        <span className="text-xs font-mono text-[var(--muted)] animate-pulse">Fetching price data...</span>
      </div>
    </div>
  );

  // ─── NO DATA ───
  if (points.length < 2 || !cd) return (
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)]", className)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--card-border)]">
        <span className="w-1.5 h-1.5 bg-[var(--muted)]/40" />
        <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">SYS.CHART</span>
      </div>
      <div className="h-[140px] flex items-center justify-center">
        <span className="text-xs font-mono text-[var(--muted)]">
          <span className="animate-pulse">▌</span> Awaiting trade data...
        </span>
      </div>
    </div>
  );

  const dp = hIdx !== null ? points[hIdx] : points[points.length - 1];
  const cursorOn = tick % 2 === 0;

  // Grid
  const step = cd.yr > 0.3 ? 0.25 : cd.yr > 0.1 ? 0.1 : 0.05;
  const grids: { y: number; l: string }[] = [];
  for (let v = Math.ceil(cd.lo / step) * step; v <= cd.hi; v += step) grids.push({ y: xy(cd.t0, v).y, l: `${Math.round(v * 100)}%` });

  // Time
  const tls: { x: number; l: string }[] = [];
  for (let i = 0; i <= 4; i++) { const t = cd.t0 + (cd.tr * i) / 4; tls.push({ x: xy(t, cd.lo).x, l: fmtTime(t) }); }

  // Lines
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
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)] overflow-hidden relative", className)}>
      <style>{`
        @keyframes cDraw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        @keyframes cFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scanMove { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
        .c-line { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: cDraw 1.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        .c-line.ok { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
        .c-area { opacity: 0; animation: cFade 0.6s ease 0.8s forwards; }
        .c-area.ok { opacity: 1; animation: none; }
      `}</style>

      {/* Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.03]">
        <div className="w-full h-[200%] animate-[scanMove_8s_linear_infinite]"
          style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, white 2px, white 3px)" }} />
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

      {/* Chart */}
      <div className="relative z-20">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[220px] sm:h-[280px] cursor-crosshair select-none"
          onMouseMove={e => nearest(e.clientX)} onMouseLeave={() => setHIdx(null)}
          onTouchMove={e => { e.preventDefault(); nearest(e.touches[0].clientX); }} onTouchEnd={() => setHIdx(null)}>
          <defs>
            {lines.map(({ o, c }) => (
              <linearGradient key={`g-${o}`} id={`ag-${o}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.12" />
                <stop offset="100%" stopColor={c} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Dot grid background */}
          {(() => {
            const dots: React.JSX.Element[] = [];
            const sx = (W - P.l - P.r) / 20, sy = (H - P.t - P.b) / 12;
            for (let ix = 0; ix <= 20; ix++) for (let iy = 0; iy <= 12; iy++) {
              dots.push(<circle key={`${ix}-${iy}`} cx={P.l + ix * sx} cy={P.t + iy * sy} r="0.5" fill="var(--foreground)" opacity="0.06" />);
            }
            return dots;
          })()}

          {/* Grid lines — thin dashes */}
          {grids.map((g, i) => (
            <g key={i}>
              <line x1={P.l} y1={g.y} x2={W - P.r} y2={g.y} stroke="var(--foreground)" strokeWidth="0.3" opacity="0.08" strokeDasharray="2,6" />
              <text x={P.l - 6} y={g.y + 3} fill="var(--foreground)" fontSize="8" fontFamily="monospace" textAnchor="end" opacity="0.3">{g.l}</text>
            </g>
          ))}

          {/* Time axis */}
          {tls.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={H - P.b} x2={t.x} y2={H - P.b + 4} stroke="var(--foreground)" strokeWidth="0.3" opacity="0.15" />
              <text x={t.x} y={H - 8} fill="var(--foreground)" fontSize="7.5" fontFamily="monospace" textAnchor="middle" opacity="0.3">{t.l}</text>
            </g>
          ))}

          {/* Area fills */}
          {lines.map(({ o, area }) => (
            <path key={`a-${o}`} d={area} fill={`url(#ag-${o})`} className={drawn ? "c-area ok" : "c-area"} />
          ))}

          {/* Main lines — sharp, 1.5px */}
          {lines.map(({ o, c, path, len }) => (
            <path key={`l-${o}`} d={path} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className={drawn ? "c-line ok" : "c-line"} style={{ "--len": len } as React.CSSProperties} />
          ))}

          {/* Trade tick marks — small vertical dashes at each data point */}
          {lines.map(({ o, c, pts }) => pts.map((pt, j) => (
            j > 0 && j < pts.length - 1 ? (
              <line key={`t-${o}-${j}`} x1={pt.x} y1={pt.y - 3} x2={pt.x} y2={pt.y + 3}
                stroke={c} strokeWidth="0.8" opacity="0.35" />
            ) : null
          )))}

          {/* Live end: blinking cursor block + price label */}
          {lines.map(({ o, c, last }) => {
            const val = dp.prices[o];
            if (val == null) return null;
            return (
              <g key={`end-${o}`}>
                {/* Horizontal dashed line from last point to right edge */}
                <line x1={last.x} y1={last.y} x2={W - P.r} y2={last.y}
                  stroke={c} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.3" />
                {/* Price label at right edge */}
                <rect x={W - P.r + 1} y={last.y - 7} width="36" height="14" rx="2" fill={c} opacity="0.9" />
                <text x={W - P.r + 19} y={last.y + 3} fill="#000" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  {(val * 100).toFixed(1)}%
                </text>
                {/* Blinking cursor dot */}
                <rect x={last.x - 1.5} y={last.y - 5} width="3" height="10" rx="0.5" fill={c}
                  opacity={cursorOn ? 0.9 : 0.2} />
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hIdx !== null && (() => {
            const p = points[hIdx];
            const fv = opts.find(o => visible.has(o));
            if (!fv) return null;
            const { x } = xy(p.t, p.prices[fv] ?? 0.5);
            return (
              <g>
                {/* Vertical scan line */}
                <line x1={x} y1={P.t} x2={x} y2={H - P.b} stroke="var(--foreground)" strokeWidth="0.5" opacity="0.15" />
                {/* Time label at bottom */}
                <rect x={x - 24} y={H - P.b + 2} width="48" height="12" rx="2" fill="var(--foreground)" opacity="0.1" />
                <text x={x} y={H - P.b + 11} fill="var(--foreground)" fontSize="7" fontFamily="monospace" textAnchor="middle" opacity="0.5">
                  {fmtTime(p.t)}
                </text>
                {/* Dots on each line */}
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

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--card-border)] relative z-20">
        <span className="text-[8px] font-mono text-[var(--foreground)] opacity-20 uppercase tracking-widest">
          {points.length} TICKS · LIVE
        </span>
        <span className="text-[8px] font-mono text-[#00e5a0]" style={{ opacity: cursorOn ? 0.6 : 0.15 }}>▮ STREAMING</span>
      </div>
    </div>
  );
}
