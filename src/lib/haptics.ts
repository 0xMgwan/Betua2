// Haptics helper.
// - Android (Chrome/Firefox): Web Vibration API (navigator.vibrate).
// - iOS Safari: the hidden <input type="checkbox" switch> hack (matches the
//   `ios-haptics` library) — build a throwaway switch, click its label to toggle
//   it, which makes iOS emit a haptic tick, then remove it.
// - Anything else: no-op.

export type HapticPattern =
  | "light"
  | "medium"
  | "heavy"
  | "selection"
  | "success"
  | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 22,
  heavy: 35,
  success: [50, 70, 50],
  error: [50, 70, 50, 70, 50],
};

const STORAGE_KEY = "haptics-enabled";
let enabled = true;

// Coarse pointer ⇒ touch device (phones / tablets). Used to gate the iOS path.
const isTouchDevice =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

function hasVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function isHapticsSupported(): boolean {
  return hasVibrate() || isTouchDevice;
}

// iOS: create a fresh hidden <label><input type="checkbox" switch></label> in
// <head>, click the LABEL (forwards to the switch → toggles it → haptic), then
// remove it. Verbatim technique from ios-haptics v2.
function fireIosSwitch() {
  if (typeof document === "undefined") return;
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  document.head.removeChild(label);
}

export function setHapticsEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getHapticsEnabled(): boolean {
  return enabled;
}

// Kept for API compatibility (no warming needed anymore).
export function primeHaptics() {
  /* no-op */
}

// Hydrate the saved preference once on the client.
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) enabled = stored === "1";
  } catch {
    /* ignore */
  }
}

export function haptic(pattern: HapticPattern = "light") {
  if (!enabled) return;

  // Android / anything exposing the Vibration API.
  if (hasVibrate()) {
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      /* ignore */
    }
    return;
  }

  // iOS Safari fallback. The switch emits one fixed tick, so multi-pulse
  // patterns are faked with repeats.
  if (!isTouchDevice) return;
  try {
    fireIosSwitch();
    if (pattern === "success") setTimeout(fireIosSwitch, 120);
    if (pattern === "error") {
      setTimeout(fireIosSwitch, 120);
      setTimeout(fireIosSwitch, 240);
    }
  } catch {
    /* ignore */
  }
}
