"use client";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

const calm = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Flips `.in` on every `.bl-reveal` once it scrolls into view, then stops
 * watching it. Mount once per page — nothing animates until it's on screen,
 * which is what makes the scroll feel staged rather than busy.
 */
export function RevealProvider() {
  useEffect(() => {
    const reduce = calm();
    const sweep = () => {
      document.querySelectorAll<HTMLElement>(".bl-reveal:not(.in)").forEach((el) => {
        if (reduce) { el.classList.add("in"); return; }
        io.observe(el);
      });
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        }),
      { threshold: 0.08 }
    );
    sweep();

    // These screens render their cards after data arrives, so watch for nodes
    // added later rather than only sweeping once on mount.
    const mo = new MutationObserver(() => sweep());
    mo.observe(document.body, { childList: true, subtree: true });

    // Safety net: nothing should ever be left invisible because an observer
    // missed it — reveal any stragglers shortly after load.
    const net = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".bl-reveal:not(.in)").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
      });
    }, 1500);

    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(net); };
  }, []);
  return null;
}

/** Count up to `to` on an ease-out cubic, the way the Bongo stat tiles do. */
export function CountUp({
  to, format = (n) => n.toLocaleString(), duration = 1400, className, style,
}: {
  to: number; format?: (n: number) => string; duration?: number;
  className?: string; style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  // Only start once the number is actually visible.
  useEffect(() => {
    const el = ref.current;
    if (!el || started) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !started) return;
    if (calm()) { el.textContent = format(to); return; }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      el.textContent = format(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, to, duration, format]);

  return <span ref={ref} className={className} style={style}>{format(0)}</span>;
}

/** Pointer-tracked 3D tilt, matching Bongo's 16deg range and 1.04 scale. */
export function Tilt({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || calm()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(600px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale(1.04)`;
    };
    const leave = () => { el.style.transform = ""; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);
  return <div ref={ref} className={`bl-tilt ${className}`} style={style}>{children}</div>;
}

/** A floating map-pin callout that stops drifting and reveals detail on click. */
export function Callout({
  title, sub, detail, style, delay = 0,
}: { title: string; sub: string; detail: string; style?: CSSProperties; delay?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className={`bl-callout ${open ? "open" : ""}`}
      style={{ animationDelay: `${delay}s`, ...style }}
    >
      <b>{title}</b>
      <span>{sub}</span>
      <em>{detail}</em>
    </button>
  );
}
