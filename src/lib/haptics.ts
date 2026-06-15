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

// ── iOS fallback: hidden <input type="checkbox" switch> + linked <label> ──────
// Matches the canonical `use-haptic` implementation. Two SEPARATE sibling
// elements (not nested) linked by id/for; clicking the LABEL forwards a click to
// the switch, toggling it, which makes iOS 18+ emit a haptic tick. Clicking the
// input directly does NOT work — WebKit only fires the haptic via the label.
const IOS_SWITCH_ID = "haptic-switch";
let iosHapticLabel: HTMLLabelElement | null = null;

function ensureIosSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (iosHapticLabel && document.body.contains(iosHapticLabel)) return iosHapticLabel;

  let input = document.getElementById(IOS_SWITCH_ID) as HTMLInputElement | null;
  if (!input) {
    input = document.createElement("input");
    input.type = "checkbox";
    input.id = IOS_SWITCH_ID;
    input.setAttribute("switch", ""); // iOS 18+ system switch control
    input.style.display = "none";
    document.body.appendChild(input);
  }

  const label = document.createElement("label");
  label.htmlFor = IOS_SWITCH_ID;
  label.style.display = "none";
  document.body.appendChild(label);
  iosHapticLabel = label;
  return label;
}

function fireIosHaptic() {
  ensureIosSwitch()?.click();
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

// Pre-create the iOS switch + label so the first tap fires without setup delay.
export function primeHaptics() {
  if (!hasVibrate() && isAppleTouchDevice()) ensureIosSwitch();
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
  // iOS Safari 17.4+ fallback: toggle a throwaway system switch to emit a tick.
  // Note: the switch produces a single fixed-intensity haptic; pattern is ignored.
  try {
    fireIosHaptic();
  } catch {
    /* ignore */
  }
}
