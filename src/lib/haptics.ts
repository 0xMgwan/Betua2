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

// ── iOS fallback: hidden <input type="checkbox" switch> ───────────────────────
let iosSwitch: HTMLInputElement | null = null;

function ensureIosSwitch(): HTMLInputElement | null {
  if (typeof document === "undefined") return null;
  if (iosSwitch && document.body.contains(iosSwitch)) return iosSwitch;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  // Visually hidden but still rendered (display:none would disable the haptic).
  label.style.cssText =
    "position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);border:0;pointer-events:none;";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", ""); // iOS 17.4+ system switch control
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = input;
  return input;
}

// True if either Android vibration OR the iOS switch trick can run.
export function isHapticsSupported(): boolean {
  if (hasVibrate()) return true;
  // iOS 17.4+ Safari: assume the switch trick is available on touch Apple devices.
  return typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent);
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
  // iOS Safari 17.4+ fallback: toggle the hidden system switch to emit a tick.
  // Note: the switch produces a single fixed-intensity haptic; pattern is ignored.
  try {
    const sw = ensureIosSwitch();
    sw?.click();
  } catch {
    /* ignore */
  }
}
