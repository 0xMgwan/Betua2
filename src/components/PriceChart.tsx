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

const LINE_COLORS = [
  "#00e5a0",
  "#ff4d6a",
  "#00b4d8",
  "#f59e0b",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#f472b6",
];

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - ms) / 86400000);
  if (diffDays < 1) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Build smooth bezier curve path from coordinate array
function smoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length < 2) return "";
  let d = `M${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

export function PriceChart({ marketId, className }: PriceChartProps) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [visibleLines, setVisibleLines] = useState<Set<string>>(new Set());
  const [animated, setAnimated] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/chart`);
      if (!res.ok) return;
      const data = await res.json();
      setPoints(data.points || []);
      setOptions(data.options || []);
      setVisibleLines(new Set(data.options || []));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchChart();
    const interval = setInterval(fetchChart, 30000);
    return () => clearInterval(interval);
  }, [fetchChart]);

  // Trigger draw animation on mount
  useEffect(() => {
    if (!loading && points.length >= 2) {
      const t = setTimeout(() => setAnimated(true), 50);
      return () => clearTimeout(t);
    }
  }, [loading, points.length]);

  const W = 500, H = 260;
  const PAD = { top: 24, right: 16, bottom: 32, left: 44 };

  const chartData = useMemo(() => {
    if (points.length < 2) return null;
    const minT = points[0].t;
    const maxT = points[points.length - 1].t;
    const timeRange = maxT - minT || 1;
    let minY = 1, maxY = 0;
    for (const p of points) {
      for (const opt of options) {
        if (!visibleLines.has(opt)) continue;
        const v = p.prices[opt] ?? 0;
        if (v < minY) minY = v;
        if (v > maxY) maxY = v;
      }
    }
    const yPad = Math.max((maxY - minY) * 0.15, 0.03);
    minY = Math.max(0, minY - yPad);
    maxY = Math.min(1, maxY + yPad);
    return { minT, maxT, timeRange, minY, maxY, yRange: maxY - minY || 0.1 };
  }, [points, options, visibleLines]);

  const toggleLine = (opt: string) => {
    setVisibleLines(prev => {
      const next = new Set(prev);
      if (next.has(opt)) { if (next.size > 1) next.delete(opt); }
      else next.add(opt);
      return next;
    });
  };

  const getCoords = useCallback(
    (t: number, price: number) => {
      if (!chartData) return { x: 0, y: 0 };
      const x = PAD.left + ((t - chartData.minT) / chartData.timeRange) * (W - PAD.left - PAD.right);
      const y = PAD.top + (1 - (price - chartData.minY) / chartData.yRange) * (H - PAD.top - PAD.bottom);
      return { x, y };
    },
    [chartData]
  );

  const findNearest = useCallback(
    (clientX: number) => {
      if (!svgRef.current || !chartData || points.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = clientX - rect.left;
      const scaleX = W / rect.width;
      const svgX = mx * scaleX;
      const relX = (svgX - PAD.left) / (W - PAD.left - PAD.right);
      const targetT = chartData.minT + relX * chartData.timeRange;
      let closest = 0, closestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs(points[i].t - targetT);
        if (d < closestDist) { closestDist = d; closest = i; }
      }
      setHoveredIdx(closest);
    },
    [chartData, points]
  );

  // Loading state
  if (loading) {
    return (
      <div className={cn("border border-[var(--card-border)] bg-[var(--card)]", className)}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)]">
          <div className="w-2 h-2 rounded-full bg-[#00e5a0] animate-pulse" />
          <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">LOADING CHART...</span>
        </div>
        <div className="h-[200px] sm:h-[260px] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-[#00e5a0]/5 to-transparent animate-pulse" />
          <div className="w-8 h-8 border-2 border-[var(--card-border)] border-t-[#00e5a0] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // No data state
  if (points.length < 2 || !chartData) {
    return (
      <div className={cn("border border-[var(--card-border)] bg-[var(--card)]", className)}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)]">
          <div className="w-2 h-2 rounded-full bg-[var(--muted)]/40" />
          <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">PRICE.CHART</span>
        </div>
        <div className="h-[140px] flex flex-col items-center justify-center gap-2">
          <div className="flex gap-1">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1 bg-[var(--card-border)] rounded-full animate-pulse" style={{ height: `${20 + Math.random() * 30}px`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="text-xs font-mono text-[var(--muted)]">Waiting for trades...</span>
        </div>
      </div>
    );
  }

  const displayPoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  // Build grid lines
  const gridLines: { y: number; label: string }[] = [];
  const step = chartData.yRange > 0.3 ? 0.25 : chartData.yRange > 0.1 ? 0.1 : 0.05;
  for (let v = Math.ceil(chartData.minY / step) * step; v <= chartData.maxY; v += step) {
    const { y } = getCoords(chartData.minT, v);
    gridLines.push({ y, label: `${Math.round(v * 100)}%` });
  }

  // Build time labels
  const timeLabels: { x: number; label: string }[] = [];
  const nLabels = 4;
  for (let i = 0; i <= nLabels; i++) {
    const t = chartData.minT + (chartData.timeRange * i) / nLabels;
    const { x } = getCoords(t, chartData.minY);
    timeLabels.push({ x, label: formatTime(t) });
  }

  // Build path data for each line
  const lineData = options.map((opt, i) => {
    if (!visibleLines.has(opt)) return null;
    const color = LINE_COLORS[i % LINE_COLORS.length];
    const coords = points
      .map(p => { const v = p.prices[opt]; return v !== undefined ? getCoords(p.t, v) : null; })
      .filter(Boolean) as { x: number; y: number }[];
    if (coords.length < 2) return null;
    const linePath = smoothPath(coords);
    const last = coords[coords.length - 1];
    const first = coords[0];
    const areaPath = linePath + ` L${last.x},${H - PAD.bottom} L${first.x},${H - PAD.bottom} Z`;
    // Total path length estimate for animation
    let pathLen = 0;
    for (let j = 1; j < coords.length; j++) {
      pathLen += Math.hypot(coords[j].x - coords[j - 1].x, coords[j].y - coords[j - 1].y);
    }
    return { opt, color, linePath, areaPath, last, first, coords, pathLen, idx: i };
  }).filter(Boolean) as Array<{
    opt: string; color: string; linePath: string; areaPath: string;
    last: { x: number; y: number }; first: { x: number; y: number };
    coords: { x: number; y: number }[]; pathLen: number; idx: number;
  }>;

  return (
    <div className={cn("border border-[var(--card-border)] bg-[var(--card)] overflow-hidden", className)} ref={containerRef}>
      {/* Inline CSS for animations */}
      <style>{`
        @keyframes chartDraw { from { stroke-dashoffset: var(--path-len); } to { stroke-dashoffset: 0; } }
        @keyframes chartFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes livePulse {
          0%, 100% { r: 4; opacity: 1; }
          50% { r: 8; opacity: 0.3; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .chart-line {
          stroke-dasharray: var(--path-len);
          stroke-dashoffset: var(--path-len);
          animation: chartDraw 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .chart-line.no-anim { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
        .chart-area {
          opacity: 0;
          animation: chartFadeIn 0.8s ease-out 0.6s forwards;
        }
        .chart-area.no-anim { opacity: 1; animation: none; }
        .live-dot { animation: livePulse 2s ease-in-out infinite; }
        .glow-line { animation: glowPulse 3s ease-in-out infinite; }
      `}</style>

      {/* Legend bar (integrated header + legend like Kalshi) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--card-border)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {options.map((opt, i) => {
            const color = LINE_COLORS[i % LINE_COLORS.length];
            const isVisible = visibleLines.has(opt);
            const price = displayPoint.prices[opt];
            return (
              <button
                key={opt}
                onClick={() => toggleLine(opt)}
                className={cn(
                  "flex items-center gap-1.5 transition-all duration-300",
                  isVisible ? "opacity-100" : "opacity-25 hover:opacity-50"
                )}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full transition-transform duration-300"
                  style={{
                    backgroundColor: color,
                    boxShadow: isVisible ? `0 0 8px ${color}60` : "none",
                    transform: isVisible ? "scale(1)" : "scale(0.7)",
                  }}
                />
                <span className="text-[11px] font-mono text-[var(--foreground)] font-medium">{opt}</span>
                {price !== undefined && (
                  <span
                    className="text-[11px] font-mono font-bold transition-all duration-300"
                    style={{ color: isVisible ? color : "var(--muted)" }}
                  >
                    {(price * 100).toFixed(1)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          {hoveredIdx !== null && (
            <span className="text-[9px] font-mono text-[var(--muted)] animate-in fade-in duration-200">
              {formatTime(displayPoint.t)}
            </span>
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-[#00e5a0] live-dot" style={{ animationDuration: "2s" }} />
        </div>
      </div>

      {/* Chart SVG */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[200px] sm:h-[280px] cursor-crosshair select-none"
          onMouseMove={(e) => findNearest(e.clientX)}
          onMouseLeave={() => setHoveredIdx(null)}
          onTouchMove={(e) => { e.preventDefault(); findNearest(e.touches[0].clientX); }}
          onTouchEnd={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Glow filter for lines */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Gradient fills for each line */}
            {lineData.map(({ opt, color }) => (
              <linearGradient key={`g-${opt}`} id={`area-${opt}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="60%" stopColor={color} stopOpacity="0.08" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y}
                stroke="var(--card-border)" strokeWidth="0.5" opacity="0.5"
              />
              <text x={PAD.left - 6} y={g.y + 3.5} fill="var(--muted)"
                fontSize="9" fontFamily="monospace" textAnchor="end" opacity="0.6">
                {g.label}
              </text>
            </g>
          ))}

          {/* Time axis */}
          {timeLabels.map((tl, i) => (
            <text key={i} x={tl.x} y={H - 6} fill="var(--muted)"
              fontSize="8" fontFamily="monospace" textAnchor="middle" opacity="0.5">
              {tl.label}
            </text>
          ))}

          {/* Area fills (animated fade in) */}
          {lineData.map(({ opt, color, areaPath }) => (
            <path
              key={`area-${opt}`}
              d={areaPath}
              fill={`url(#area-${opt})`}
              className={animated ? "chart-area" : "chart-area no-anim"}
            />
          ))}

          {/* Lines with glow (animated draw) */}
          {lineData.map(({ opt, color, linePath, pathLen }) => (
            <g key={`line-${opt}`}>
              {/* Glow underline */}
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.15"
                className="glow-line"
                style={{ filter: "blur(4px)" }}
              />
              {/* Main line */}
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={animated ? "chart-line" : "chart-line no-anim"}
                style={{ "--path-len": pathLen } as React.CSSProperties}
              />
            </g>
          ))}

          {/* Live pulsing dots at line ends */}
          {lineData.map(({ opt, color, last }) => (
            <g key={`dot-${opt}`}>
              <circle cx={last.x} cy={last.y} r="4" fill={color} opacity="0.3" className="live-dot" />
              <circle cx={last.x} cy={last.y} r="4" fill={color} />
              <circle cx={last.x} cy={last.y} r="2" fill="white" opacity="0.8" />
            </g>
          ))}

          {/* Hover crosshair + tooltip */}
          {hoveredIdx !== null && (() => {
            const p = points[hoveredIdx];
            const firstVis = options.find(o => visibleLines.has(o));
            if (!firstVis) return null;
            const { x } = getCoords(p.t, p.prices[firstVis] ?? 0.5);
            return (
              <g>
                {/* Vertical line */}
                <line
                  x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                  stroke="var(--foreground)" strokeWidth="0.8" opacity="0.2"
                />
                {/* Highlight dots */}
                {lineData.map(({ opt, color }) => {
                  const val = p.prices[opt];
                  if (val === undefined) return null;
                  const c = getCoords(p.t, val);
                  return (
                    <g key={`h-${opt}`}>
                      <circle cx={c.x} cy={c.y} r="6" fill={color} opacity="0.2" />
                      <circle cx={c.x} cy={c.y} r="4" fill="var(--card)" stroke={color} strokeWidth="2" />
                    </g>
                  );
                })}
                {/* Floating tooltip card */}
                {(() => {
                  const tooltipX = x > W / 2 ? x - 90 : x + 10;
                  const tooltipY = PAD.top + 5;
                  return (
                    <g>
                      <rect x={tooltipX} y={tooltipY} width="80" height={14 + lineData.length * 14}
                        rx="4" fill="var(--card)" stroke="var(--card-border)" strokeWidth="0.5" opacity="0.95" />
                      <text x={tooltipX + 5} y={tooltipY + 11} fill="var(--muted)" fontSize="7" fontFamily="monospace">
                        {formatTime(p.t)}
                      </text>
                      {lineData.map(({ opt, color }, j) => {
                        const val = p.prices[opt];
                        if (val === undefined) return null;
                        return (
                          <g key={`tt-${opt}`}>
                            <circle cx={tooltipX + 8} cy={tooltipY + 22 + j * 14} r="2.5" fill={color} />
                            <text x={tooltipX + 14} y={tooltipY + 25 + j * 14} fill="var(--foreground)" fontSize="8" fontFamily="monospace" fontWeight="bold">
                              {opt} {(val * 100).toFixed(1)}%
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
