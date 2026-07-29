"use client";
import { useEffect, useRef } from "react";

/**
 * Run `fn` immediately and then every `intervalMs`, but only while the tab is
 * visible. Backgrounded tabs stop polling entirely and refetch once when the
 * user comes back.
 *
 * This matters more than it looks: Neon bills compute time and autosuspends an
 * idle database. Unconditional setInterval polling means any tab left open
 * anywhere keeps the database awake 24/7, which burns the compute quota
 * regardless of how much traffic the site actually gets.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled = true
) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const start = () => {
      if (!timer) timer = setInterval(() => saved.current(), intervalMs);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { saved.current(); start(); }
    };

    saved.current();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
