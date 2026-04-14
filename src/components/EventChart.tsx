"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

interface ChartPoint {
  t: number;
  price: number;
}

interface MarketChartData {
  id: string;
  title: string;
  points: ChartPoint[];
  currentPrice: number;
}

interface EventChartProps {
  markets: {
    id: string;
    title: string;
    price: { yes: number; no: number };
    optionPrices?: number[] | null;
    options?: string[] | null;
    totalVolume: number;
    _count: { trades: number };
  }[];
  className?: string;
}

const COLORS = [
  "#00e5a0", "#00b4d8", "#f59e0b", "#a78bfa", 
  "#fb923c", "#34d399", "#f472b6", "#ef4444"
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

export function EventChart({ markets, className }: EventChartProps) {
  const [chartData, setChartData] = useState<MarketChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hIdx, setHIdx] = useState<number | null>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [drawn, setDrawn] = useState(false);
  const [tick, setTick] = useState(0);
  const [cw, setCw] = useState(560);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fetch chart data for all markets
  const fetchAllCharts = useCallback(async () => {
    try {
      const results = await Promise.all(
        markets.map(async (m) => {
          try {
            const r = await fetch(`/api/markets/${m.id}/chart`);
            if (!r.ok) return null;
            const d = await r.json();
            
            // For binary markets, use YES price; for multi-option, use the leading option
            const isMultiOption = m.options && m.options.length >= 2;
            let points: ChartPoint[] = [];
            let currentPrice = 0.5;
            
            if (d.points && d.points.length > 0) {
              if (isMultiOption && d.options && d.options.length > 0) {
                // Find leading option and use its prices
                const lastPoint = d.points[d.points.length - 1];
                const prices = Object.values(lastPoint.prices) as number[];
                const maxPrice = Math.max(...prices);
                const leadingOption = d.options[prices.indexOf(maxPrice)];
                
                points = d.points.map((p: { t: number; prices: Record<string, number> }) => ({
                  t: p.t,
                  price: p.prices[leadingOption] ?? 0.5
                }));
                currentPrice = maxPrice;
              } else {
                // Binary market - use YES price
                points = d.points.map((p: { t: number; prices: Record<string, number> }) => ({
                  t: p.t,
                  price: p.prices["YES"] ?? 0.5
                }));
                currentPrice = d.points[d.points.length - 1].prices["YES"] ?? 0.5;
              }
            }
            
            return {
              id: m.id,
              title: m.title,
              points,
              currentPrice
            };
          } catch {
            return null;
          }
        })
      );
      
      const validData = results.filter(Boolean) as MarketChartData[];
      setChartData(validData);
      setVisible(new Set(validData.map(d => d.id)));
    } catch { /* */ } finally { setLoading(false); }
  }, [markets]);

  useEffect(() => { fetchAllCharts(); const i = setInterval(fetchAllCharts, 30000); return () => clearInterval(i); }, [fetchAllCharts]);
  useEffect(() => { if (!loading && chartData.some(d => d.points.length >= 2)) { const t = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(t); } }, [loading, chartData]);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 530); return () => clearInterval(i); }, []);

  // Measure container width
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

  const W = cw || 560, H = 200;
  const P = { t: 28, r: 56, b: 28, l: 40 };

  // Combine all points to find time range and price range
  const cd = useMemo(() => {
    const allPoints = chartData.flatMap(d => d.points);
    if (allPoints.length < 2) return null;
    
    const times = allPoints.map(p => p.t);
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const tr = t1 - t0 || 1;
    
    let lo = 1, hi = 0;
    for (const d of chartData) {
      if (!visible.has(d.id)) continue;
      for (const p of d.points) {
        if (p.price < lo) lo = p.price;
        if (p.price > hi) hi = p.price;
      }
    }
    
    const pad = Math.max((hi - lo) * 0.18, 0.04);
    lo = Math.max(0, lo - pad);
    hi = Math.min(1, hi + pad);
    
    return { t0, t1, tr, lo, hi, yr: hi - lo || 0.1 };
  }, [chartData, visible]);

  const xy = useCallback((t: number, v: number) => {
    if (!cd) return { x: 0, y: 0 };
    return {
      x: P.l + ((t - cd.t0) / cd.tr) * (W - P.l - P.r),
      y: P.t + (1 - (v - cd.lo) / cd.yr) * (H - P.t - P.b),
    };
  }, [cd, W]);

  // Find all points at a given x position for hover
  const allTimePoints = useMemo(() => {
    const timeMap = new Map<number, number>();
    for (const d of chartData) {
      for (const p of d.points) {
        timeMap.set(p.t, p.t);
      }
    }
    return Array.from(timeMap.values()).sort((a, b) => a - b);
  }, [chartData]);

  const nearest = useCallback((cx: number) => {
    if (!svgRef.current || !cd || allTimePoints.length < 2) return;
    const r = svgRef.current.getBoundingClientRect();
    const sx = ((cx - r.left) / r.width) * W;
    const rel = (sx - P.l) / (W - P.l - P.r);
    const tgt = cd.t0 + rel * cd.tr;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < allTimePoints.length; i++) {
      const d = Math.abs(allTimePoints[i] - tgt);
      if (d < bd) { bd = d; bi = i; }
    }
    setHIdx(bi);
  }, [cd, allTimePoints, W]);

  const toggle = (id: string) => setVisible(p => {
    const n = new Set(p);
    if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id);
    return n;
  });

  // Loading state
  if (loading) return (
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)]", className)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--card-border)]">
        <span className="text-[10px] font-mono text-[var(--accent)] animate-pulse">█</span>
        <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">EVENT.CHART.LOAD</span>
      </div>
      <div className="h-[160px] flex items-center justify-center">
        <span className="text-xs font-mono text-[var(--muted)] animate-pulse">Fetching market data...</span>
      </div>
    </div>
  );

  // No data state
  if (!cd || chartData.every(d => d.points.length < 2)) return (
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)]", className)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--card-border)]">
        <span className="w-1.5 h-1.5 bg-[var(--muted)]/40" />
        <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">EVENT.CHART</span>
      </div>
      <div className="h-[100px] flex items-center justify-center">
        <span className="text-xs font-mono text-[var(--muted)]">
          <span className="animate-pulse">▌</span> Awaiting trade data...
        </span>
      </div>
    </div>
  );

  const cursorOn = tick % 2 === 0;
  const hoverTime = hIdx !== null ? allTimePoints[hIdx] : null;

  // Grid
  const step = cd.yr > 0.3 ? 0.25 : cd.yr > 0.1 ? 0.1 : 0.05;
  const grids: { y: number; l: string }[] = [];
  for (let v = Math.ceil(cd.lo / step) * step; v <= cd.hi; v += step) {
    grids.push({ y: xy(cd.t0, v).y, l: `${Math.round(v * 100)}%` });
  }

  // Time labels
  const tls: { x: number; l: string }[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = cd.t0 + (cd.tr * i) / 4;
    tls.push({ x: xy(t, cd.lo).x, l: fmtTime(t) });
  }

  // Build lines for each market
  const lines = chartData.map((d, i) => {
    if (!visible.has(d.id) || d.points.length < 2) return null;
    const c = COLORS[i % COLORS.length];
    const pts = d.points.map(p => xy(p.t, p.price));
    const path = bezier(pts);
    const last = pts[pts.length - 1];
    let len = 0;
    for (let j = 1; j < pts.length; j++) {
      len += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y);
    }
    return { id: d.id, title: d.title, c, path, last, pts, len, currentPrice: d.currentPrice, points: d.points };
  }).filter(Boolean) as Array<{
    id: string; title: string; c: string; path: string;
    last: { x: number; y: number }; pts: { x: number; y: number }[];
    len: number; currentPrice: number; points: ChartPoint[];
  }>;

  return (
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)] overflow-hidden relative", className)}>
      <style>{`
        @keyframes cDraw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        @keyframes cFade { from { opacity: 0; } to { opacity: 1; } }
        .c-line { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: cDraw 1.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        .c-line.ok { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
      `}</style>

      {/* Legend */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--card-border)] relative z-20">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {chartData.map((d, i) => {
            const c = COLORS[i % COLORS.length];
            const on = visible.has(d.id);
            // Get price at hover time or current
            let price = d.currentPrice;
            if (hoverTime !== null) {
              const pt = d.points.find(p => p.t === hoverTime);
              if (pt) price = pt.price;
            }
            return (
              <button key={d.id} onClick={() => toggle(d.id)}
                className={cn("flex items-center gap-1 transition-opacity duration-200", on ? "opacity-100" : "opacity-25 hover:opacity-50")}>
                <span className="text-[10px] font-mono" style={{ color: on ? c : "var(--muted)" }}>●</span>
                <span className="text-[10px] font-mono text-[var(--foreground)] truncate max-w-[100px]">{d.title}</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: on ? c : "var(--muted)" }}>
                  {(price * 100).toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {hoverTime !== null && <span className="text-[8px] font-mono text-[var(--muted)]">{fmtTime(hoverTime)}</span>}
          <span className="text-[10px] font-mono text-[#00e5a0]" style={{ opacity: cursorOn ? 1 : 0 }}>▮</span>
        </div>
      </div>

      {/* Chart */}
      <div ref={wrapRef} className="relative z-20 bg-[var(--card)]">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[160px] sm:h-[200px] cursor-crosshair select-none bg-[var(--card)]"
          onMouseMove={e => nearest(e.clientX)} onMouseLeave={() => setHIdx(null)}
          onTouchMove={e => { e.preventDefault(); nearest(e.touches[0].clientX); }} onTouchEnd={() => setHIdx(null)}>
          <defs>
            {lines.map(({ id, c }) => (
              <linearGradient key={`g-${id}`} id={`ag-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.08" />
                <stop offset="100%" stopColor={c} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Dot grid */}
          {(() => {
            const dots: React.JSX.Element[] = [];
            const sx = (W - P.l - P.r) / 16, sy = (H - P.t - P.b) / 8;
            for (let ix = 0; ix <= 16; ix++) for (let iy = 0; iy <= 8; iy++) {
              dots.push(<circle key={`${ix}-${iy}`} cx={P.l + ix * sx} cy={P.t + iy * sy} r="0.5" fill="var(--foreground)" opacity="0.06" />);
            }
            return dots;
          })()}

          {/* Grid lines */}
          {grids.map((g, i) => (
            <g key={i}>
              <line x1={P.l} y1={g.y} x2={W - P.r} y2={g.y} stroke="var(--foreground)" strokeWidth="0.3" opacity="0.08" strokeDasharray="2,6" />
              <text x={P.l - 4} y={g.y + 3} fill="var(--foreground)" fontSize="7" fontFamily="monospace" textAnchor="end" opacity="0.3">{g.l}</text>
            </g>
          ))}

          {/* Time axis */}
          {tls.map((t, i) => (
            <text key={i} x={t.x} y={H - 6} fill="var(--foreground)" fontSize="7" fontFamily="monospace" textAnchor="middle" opacity="0.3">{t.l}</text>
          ))}

          {/* Lines */}
          {lines.map(({ id, c, path, len }) => (
            <path key={`l-${id}`} d={path} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className={drawn ? "c-line ok" : "c-line"} style={{ "--len": len } as React.CSSProperties} />
          ))}

          {/* End badges */}
          {lines.map(({ id, c, last, currentPrice }) => {
            const chartRight = W - P.r;
            const badgeX = chartRight + 4;
            return (
              <g key={`end-${id}`}>
                <line x1={last.x} y1={last.y} x2={chartRight} y2={last.y}
                  stroke={c} strokeWidth="0.5" strokeDasharray="2,4" opacity="0.4" />
                <rect x={badgeX} y={last.y - 7} width="40" height="14" rx="2" fill={c} />
                <text x={badgeX + 20} y={last.y + 3} fill="#000" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  {(currentPrice * 100).toFixed(1)}%
                </text>
                <rect x={last.x - 1} y={last.y - 5} width="2" height="10" rx="0.5" fill={c}
                  opacity={cursorOn ? 1 : 0.15} />
              </g>
            );
          })}

          {/* Hover crosshair */}
          {hoverTime !== null && (() => {
            const firstLine = lines[0];
            if (!firstLine) return null;
            const pt = firstLine.points.find(p => p.t === hoverTime);
            if (!pt) return null;
            const { x } = xy(hoverTime, pt.price);
            return (
              <g>
                <line x1={x} y1={P.t} x2={x} y2={H - P.b} stroke="var(--foreground)" strokeWidth="0.5" opacity="0.15" />
                {lines.map(({ id, c, points: linePoints }) => {
                  const p = linePoints.find(lp => lp.t === hoverTime);
                  if (!p) return null;
                  const pt = xy(p.t, p.price);
                  return (
                    <g key={`h-${id}`}>
                      <circle cx={pt.x} cy={pt.y} r="3" fill="none" stroke={c} strokeWidth="1.5" />
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
      <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--card-border)] relative z-20">
        <span className="text-[8px] font-mono text-[var(--foreground)] opacity-20 uppercase tracking-widest">
          {markets.length} MARKETS · LIVE
        </span>
        <span className="text-[8px] font-mono text-[#00e5a0]" style={{ opacity: cursorOn ? 0.6 : 0.15 }}>▮ STREAMING</span>
      </div>
    </div>
  );
}
