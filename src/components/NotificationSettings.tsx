"use client";
import { useState, useEffect } from "react";

interface NotificationPrefs {
  pushEnabled: boolean;
  tradePlaced: boolean;
  positionExpiring: boolean;
  positionPriceChange: boolean;
  marketResolved: boolean;
  winnings: boolean;
  priceChangeThreshold: number;
  expiryWarningHours: number;
}

const defaultPrefs: NotificationPrefs = {
  pushEnabled: true,
  tradePlaced: true,
  positionExpiring: true,
  positionPriceChange: true,
  marketResolved: true,
  winnings: true,
  priceChangeThreshold: 10,
  expiryWarningHours: 24,
};

export function NotificationSettings() {
  const [locale, setLocale] = useState("en");
  const isSw = locale === "sw";

  useEffect(() => {
    // Get locale from cookie
    const match = document.cookie.match(/locale=([^;]+)/);
    if (match) setLocale(match[1]);
  }, []);
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check notification permission
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }

    // Load preferences
    fetch("/api/push/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setPrefs({ ...defaultPrefs, ...data });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === "granted") {
        // Re-initialize notifications
        const { notifications } = await import("@/lib/notifications");
        await notifications.initialize();
      }
    }
  };

  const updatePref = async (key: keyof NotificationPrefs, value: boolean | number) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setSaving(true);

    try {
      await fetch("/api/push/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      console.error("Failed to save preference:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-[var(--card)] rounded w-1/3"></div>
        <div className="h-12 bg-[var(--card)] rounded"></div>
        <div className="h-12 bg-[var(--card)] rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-mono font-bold text-lg">
          {isSw ? "🔔 Arifa" : "🔔 Notifications"}
        </h3>
        {saving && (
          <span className="text-xs text-[var(--muted)]">
            {isSw ? "Inahifadhi..." : "Saving..."}
          </span>
        )}
      </div>

      {/* Permission Status */}
      {permissionStatus !== "granted" && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400 mb-3">
            {isSw
              ? "Ruhusu arifa kupokea taarifa kwenye simu yako"
              : "Enable notifications to receive alerts on your phone"}
          </p>
          <button
            onClick={requestPermission}
            className="px-4 py-2 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400 transition"
          >
            {isSw ? "Ruhusu Arifa" : "Enable Notifications"}
          </button>
        </div>
      )}

      {/* Master Toggle */}
      <div className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
        <div>
          <p className="font-medium">{isSw ? "Arifa za Push" : "Push Notifications"}</p>
          <p className="text-sm text-[var(--muted)]">
            {isSw ? "Pokea arifa kwenye simu yako" : "Receive alerts on your phone"}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.pushEnabled}
            onChange={(e) => updatePref("pushEnabled", e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
        </label>
      </div>

      {/* Individual Settings */}
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)] font-mono">
          {isSw ? "AINA ZA ARIFA" : "NOTIFICATION TYPES"}
        </p>

        <ToggleItem
          label={isSw ? "Biashara Imefanikiwa" : "Trade Placed"}
          description={isSw ? "Unapofanya biashara mpya" : "When you place a new trade"}
          checked={prefs.tradePlaced}
          onChange={(v) => updatePref("tradePlaced", v)}
          disabled={!prefs.pushEnabled}
        />

        <ToggleItem
          label={isSw ? "Soko Linakaribia Kufungwa" : "Position Expiring"}
          description={isSw ? "Soko lako linakaribia kuisha" : "Your market is about to expire"}
          checked={prefs.positionExpiring}
          onChange={(v) => updatePref("positionExpiring", v)}
          disabled={!prefs.pushEnabled}
        />

        <ToggleItem
          label={isSw ? "Mabadiliko ya Bei" : "Price Changes"}
          description={isSw ? "Nafasi yako imebadilika sana" : "Your position moved significantly"}
          checked={prefs.positionPriceChange}
          onChange={(v) => updatePref("positionPriceChange", v)}
          disabled={!prefs.pushEnabled}
        />

        <ToggleItem
          label={isSw ? "Soko Limetatuliwa" : "Market Resolved"}
          description={isSw ? "Soko limetatuliwa" : "A market you're in has resolved"}
          checked={prefs.marketResolved}
          onChange={(v) => updatePref("marketResolved", v)}
          disabled={!prefs.pushEnabled}
        />

        <ToggleItem
          label={isSw ? "Umeshinda!" : "Winnings"}
          description={isSw ? "Umeshinda pesa" : "You won money"}
          checked={prefs.winnings}
          onChange={(v) => updatePref("winnings", v)}
          disabled={!prefs.pushEnabled}
        />
      </div>

      {/* Thresholds */}
      <div className="space-y-4 pt-4 border-t border-[var(--card-border)]">
        <p className="text-sm text-[var(--muted)] font-mono">
          {isSw ? "MIPAKA" : "THRESHOLDS"}
        </p>

        <div className="p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">{isSw ? "Kiwango cha Mabadiliko" : "Price Change Alert"}</p>
            <span className="font-mono text-[var(--accent)]">{prefs.priceChangeThreshold}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={prefs.priceChangeThreshold}
            onChange={(e) => updatePref("priceChangeThreshold", parseInt(e.target.value))}
            disabled={!prefs.pushEnabled || !prefs.positionPriceChange}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            {isSw
              ? `Pokea arifa bei inapobadilika ${prefs.priceChangeThreshold}%+`
              : `Get notified when price moves ${prefs.priceChangeThreshold}%+`}
          </p>
        </div>

        <div className="p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">{isSw ? "Onyo la Kuisha" : "Expiry Warning"}</p>
            <span className="font-mono text-[var(--accent)]">{prefs.expiryWarningHours}h</span>
          </div>
          <input
            type="range"
            min="1"
            max="48"
            step="1"
            value={prefs.expiryWarningHours}
            onChange={(e) => updatePref("expiryWarningHours", parseInt(e.target.value))}
            disabled={!prefs.pushEnabled || !prefs.positionExpiring}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            {isSw
              ? `Pokea arifa saa ${prefs.expiryWarningHours} kabla ya kuisha`
              : `Get notified ${prefs.expiryWarningHours} hours before expiry`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 bg-[var(--card)] border border-[var(--card-border)] rounded-lg ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)]"></div>
      </label>
    </div>
  );
}
