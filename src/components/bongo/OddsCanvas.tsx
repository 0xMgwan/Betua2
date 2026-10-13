"use client";
import { useEffect, useRef } from "react";

/**
 * The hero's living backdrop. Bongo Life runs a looping video of its city;
 * GUAP's equivalent subject is the market itself, so this draws slow
 * random-walk probability curves scrolling right-to-left behind the headline.
 *
 * Cheap on purpose: three series, one rAF, and it parks itself when the tab is
 * hidden or the viewer prefers reduced motion.
 */
export function OddsCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SERIES = [
      { color: "#f5b800", y: 0.42, v: 0, w: 2.5 },
      { color: "#12805c", y: 0.60, v: 0, w: 2 },
      { color: "#e5452b", y: 0.30, v: 0, w: 2 },
    ];
    const N = 150;
    const trails = SERIES.map((s) => Array.from({ length: N }, () => s.y));

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    let raf = 0, last = 0, paused = false;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (paused || t - last < 1000 / 30) return;   // 30fps is plenty for this
      last = t;

      ctx.clearRect(0, 0, w, h);

      // Faint market grid
      ctx.strokeStyle = "rgba(246,241,230,.05)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const y = (h / 6) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      SERIES.forEach((s, si) => {
        // Random walk with a gentle pull back toward the series' home level
        s.v += (Math.random() - 0.5) * 0.0016 + (s.y - trails[si][N - 1]) * 0.002;
        s.v = Math.max(-0.006, Math.min(0.006, s.v));
        const next = Math.max(0.08, Math.min(0.92, trails[si][N - 1] + s.v));
        trails[si].push(next);
        trails[si].shift();

        const pts = trails[si];
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = (i / (N - 1)) * w;
          const y = p * h;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = s.w;
        ctx.lineJoin = "round";
        ctx.stroke();

        // Area wash under the line
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = s.color;
        ctx.fill();

        // Leading dot — the "live" tell
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(w, pts[N - 1] * h, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    };
    raf = requestAnimationFrame(tick);

    const vis = () => { paused = document.hidden; };
    document.addEventListener("visibilitychange", vis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
