"use client";
import { useEffect } from "react";
import { haptic, isHapticsSupported, primeHaptics } from "@/lib/haptics";

// Selector for "tappable" elements. Add the `haptic` class to any custom element
// (e.g. a clickable div) to opt it in.
const INTERACTIVE =
  'button, [role="button"], a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], select, summary, label[for], .haptic';

// Globally vibrate on touch interactions with any button/link, so we don't have
// to wire haptics into every component individually.
export function HapticProvider() {
  useEffect(() => {
    if (!isHapticsSupported()) return;
    // Pre-create the iOS switch element so the first tap fires instantly.
    primeHaptics();

    const onPointerDown = (e: PointerEvent) => {
      // Only meaningful for touch input; mouse/pen don't get haptics.
      if (e.pointerType !== "touch") return;
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.(INTERACTIVE) as HTMLElement | null;
      if (!el) return;
      // Respect disabled controls.
      if (
        (el as HTMLButtonElement).disabled ||
        el.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }
      haptic("light");
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
