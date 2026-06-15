"use client";
import { useEffect } from "react";
import { haptic, isHapticsSupported } from "@/lib/haptics";

// Selector for "tappable" elements. Add the `haptic` class to any custom element
// (e.g. a clickable div) to opt it in.
const INTERACTIVE =
  'button, [role="button"], a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], select, summary, label[for], .haptic';

// Globally vibrate on click of any button/link, so we don't have to wire haptics
// into every component. Bound to `click` (matches how ios-haptics is meant to be
// triggered) rather than pointerdown, which never fired the iOS switch haptic.
export function HapticProvider() {
  useEffect(() => {
    if (!isHapticsSupported()) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Ignore our own hidden haptic switch to avoid re-entrancy.
      if (target.hasAttribute?.("switch")) return;
      const el = target.closest?.(INTERACTIVE) as HTMLElement | null;
      if (!el) return;
      // Respect disabled controls.
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      haptic("light");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
