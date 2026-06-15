// Lightweight haptics helper.
// - Android (Chrome/Firefox): uses the Web Vibration API (navigator.vibrate).
// - iOS Safari 17.4+: navigator.vibrate is unsupported, so we fall back to the
//   hidden `<input type="checkbox" switch>` trick — programmatically toggling a
//   system "switch" control emits a subtle haptic tick on supported iPhones.
// - Anything else: gracefully no-ops.

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
  success: [12, 40, 18],
  error: [30, 45, 30],
};

const STORAGE_KEY = "haptics-enabled";
let enabled = true;

function hasVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

// ── iOS fallback: hidden <label><input type="checkbox" switch></label> ────────
// The proven technique (ios-haptics): a label wrapping a system "switch" control.
// Programmatically clicking the LABEL forwards a click to the switch, toggling it,
// which makes iOS 17.4+ emit a haptic tick. We click the label (not the input).
let iosHapticLabel: HTMLLabelElement | null = null;

function ensureIosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (iosHapticLabel && document.body.contains(iosHapticLabel)) return iosHapticLabel;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  // Visually hidden but actually rendered + laid out (not display:none), which is
  // the most reliable state for the switch to emit its haptic when toggled.
  label.style.cssText =
    "position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", ""); // iOS 17.4+ system switch control
  label.appendChild(input);
  document.body.appendChild(label);
  iosHapticLabel = label;
  return label;
}

function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPhone/iPod, plus iPadOS which reports as "MacIntel" with touch points.
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// True if either Android vibration OR the iOS switch trick can run.
export function isHapticsSupported(): boolean {
  return hasVibrate() || isAppleTouchDevice();
}

// Pre-create the iOS switch element so the first tap fires without a setup delay.
export function primeHaptics() {
  if (!hasVibrate()) ensureIosSwitch();
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

// Hydrate the preference once on the client.
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
  // iOS Safari 17.4+ fallback: click the hidden label to toggle the system switch.
  // Note: the switch produces a single fixed-intensity haptic; pattern is ignored.
  try {
    const label = ensureIosSwitch();
    label?.click();
  } catch {
    /* ignore */
  }
}
