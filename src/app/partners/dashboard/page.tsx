"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  Terminal, Key, Users, ChartLine, Copy, Check, SignOut, Eye, EyeSlash, Warning,
  Sun, Moon, Lightning, CurrencyDollar, Globe, FloppyDisk, BookOpen, Pulse,
} from "@phosphor-icons/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] p-4 rounded-lg">
      <div className="flex items-center gap-2 text-[var(--muted)] text-xs mb-2">{icon}{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function PartnerDashboard() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [partner, setPartner] = useState<AnyObj | null>(null);
  const [stats, setStats] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Settings form state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [tradingFee, setTradingFee] = useState("5");
  const [creationFee, setCreationFee] = useState("2000");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    Promise.all([fetch("/api/partners/me"), fetch("/api/partners/stats")])
      .then(async ([meRes, statsRes]) => {
        if (!meRes.ok) { router.push("/partners"); return; }
        const p = (await meRes.json()).partner;
        setPartner(p);
        setWebhookUrl(p.webhookUrl || "");
        const fees = p.metadata?.fees || {};
        if (fees.tradingFeePercent != null) setTradingFee(String(fees.tradingFeePercent));
        if (fees.creationFeeTzs != null) setCreationFee(String(fees.creationFeeTzs));
        if (statsRes.ok) setStats(await statsRes.json());
      })
      .catch(() => router.push("/partners"))
      .finally(() => setLoading(false));
  }, [router]);

  const copyApiKey = () => {
    if (partner?.rawApiKey) {
      navigator.clipboard.writeText(partner.rawApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateApiKey = async () => {
    if (!confirm("Regenerate your API key? Your old key stops working immediately.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/partners/regenerate-key", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.apiKey) {
        setPartner({ ...partner, rawApiKey: data.apiKey, apiKeyPrefix: "gp_live_" });
        setShowApiKey(true);
        alert("New API key generated! Copy it now.");
      } else {
        alert(data.error || "Failed to regenerate key");
      }
    } catch { alert("Network error"); }
    finally { setRegenerating(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/partners/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          tradingFeePercent: Number(tradingFee),
          creationFeeTzs: Number(creationFee),
        }),
      });
      const data = await res.json();
      setSavedMsg(res.ok ? "✓ Saved" : `✕ ${data.error || "Failed"}`);
    } catch { setSavedMsg("✕ Network error"); }
    finally { setSaving(false); setTimeout(() => setSavedMsg(""), 4000); }
  };

  if (loading) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center"><span className="text-[var(--muted)] font-mono">Loading dashboard…</span></div>;
  }
  if (!partner) return null;

  const memberSince = partner.createdAt ? new Date(partner.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
  const logs: AnyObj[] = stats?.recentLogs || [];

  const statusColor = (code: number) =>
    code < 300 ? "text-green-500" : code < 400 ? "text-blue-400" : code < 500 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="border-b border-[var(--card-border)] px-6 py-4 sticky top-0 bg-[var(--background)]/80 backdrop-blur-xl z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Terminal size={24} className="text-[var(--accent)]" />GUAP
            <span className="text-[var(--muted)] text-sm ml-2 hidden sm:inline">Partner Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--muted)] hidden sm:inline">{partner.email}</span>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--card-border)] rounded-md transition-colors"
              title="Toggle light / dark"
            >
              {mounted && (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />)}
            </button>
            <button
              onClick={() => { fetch("/api/partners/logout", { method: "POST" }); router.push("/partners"); }}
              className="p-2 text-[var(--muted)] hover:text-red-500 border border-[var(--card-border)] rounded-md transition-colors"
              title="Sign out"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {!partner.isApproved && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
            <Warning size={24} className="text-yellow-500 shrink-0" />
            <div><p className="font-bold text-yellow-500">Account Pending Approval</p><p className="text-sm text-[var(--muted)]">API calls will be rejected until your account is approved.</p></div>
          </div>
        )}

        {/* Stats overview */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users size={14} />} label="Users" value={stats?.users ?? 0} />
          <StatCard icon={<ChartLine size={14} />} label="Trades" value={stats?.trades?.count ?? 0} />
          <StatCard icon={<Lightning size={14} />} label="Calls Today" value={stats?.apiCalls?.today ?? 0} />
          <StatCard icon={<CurrencyDollar size={14} />} label="Volume (TZS)" value={`${((stats?.trades?.volume ?? 0) / 1000).toFixed(1)}K`} />
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* API Credentials */}
          <section className="bg-[var(--card)] border border-[var(--card-border)] p-6 rounded-lg">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Key size={20} className="text-[var(--accent)]" />API Credentials</h2>
            <label className="text-xs text-[var(--muted)] block mb-1">API Key</label>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {showApiKey && partner.rawApiKey ? partner.rawApiKey : `${partner.apiKeyPrefix}${"•".repeat(24)}`}
              </code>
              <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 text-[var(--muted)] hover:text-[var(--foreground)]">{showApiKey ? <EyeSlash size={18} /> : <Eye size={18} />}</button>
              <button onClick={copyApiKey} className="p-2 text-[var(--muted)] hover:text-[var(--foreground)]">{copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}</button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div><span className="text-[var(--muted)] block text-xs">Tier</span><span className="text-[var(--accent)] font-bold">{partner.tier}</span></div>
              <div><span className="text-[var(--muted)] block text-xs">Rate limit</span>{partner.rateLimit}/min</div>
              <div><span className="text-[var(--muted)] block text-xs">Status</span><span className={partner.isApproved ? "text-green-500" : "text-yellow-500"}>{partner.isApproved ? "Active" : "Pending"}</span></div>
            </div>
            <button onClick={regenerateApiKey} disabled={regenerating} className="w-full py-2 px-4 border border-red-500/50 text-red-500 text-sm font-mono rounded hover:bg-red-500/10 disabled:opacity-50 transition-colors">
              {regenerating ? "Regenerating…" : "Regenerate API Key"}
            </button>
          </section>

          {/* Account */}
          <section className="bg-[var(--card)] border border-[var(--card-border)] p-6 rounded-lg">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={20} className="text-[var(--accent)]" />Account</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Name</dt><dd className="font-medium">{partner.name}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Email</dt><dd className="font-medium">{partner.email}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Member since</dt><dd className="font-medium">{memberSince}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Base URL</dt><dd className="font-mono text-xs">{BASE_URL}/api/v1</dd></div>
            </dl>
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] grid grid-cols-2 gap-3 text-center">
              <div><div className="text-2xl font-bold">{stats?.apiCalls?.thisMonth ?? 0}</div><div className="text-xs text-[var(--muted)]">Calls this month</div></div>
              <div><div className="text-2xl font-bold">{stats?.apiCalls?.total ?? 0}</div><div className="text-xs text-[var(--muted)]">Total calls</div></div>
            </div>
          </section>
        </div>

        {/* Settings: webhook + fees */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] p-6 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold flex items-center gap-2"><FloppyDisk size={20} className="text-[var(--accent)]" />Settings</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-yellow-500/40 text-yellow-500 bg-yellow-500/10">Preview</span>
          </div>
          <p className="text-xs text-[var(--muted)] mb-4">Saved to your profile. Custom-fee enforcement and webhook delivery are rolling out — talk to us to activate them for your account.</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 flex items-center gap-1.5"><Globe size={13} />Webhook URL</label>
              <input
                type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://yourapp.com/webhooks/guap"
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm font-mono focus:border-[var(--accent)] outline-none"
              />
              <p className="text-[11px] text-[var(--muted)] mt-1">Where deposit/withdrawal/market events will be delivered.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 flex items-center gap-1.5"><CurrencyDollar size={13} />Trading fee %</label>
                <input type="number" min={0} max={20} step={0.5} value={tradingFee} onChange={(e) => setTradingFee(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm font-mono focus:border-[var(--accent)] outline-none" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 flex items-center gap-1.5"><CurrencyDollar size={13} />Creation fee (TZS)</label>
                <input type="number" min={0} max={100000} step={100} value={creationFee} onChange={(e) => setCreationFee(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm font-mono focus:border-[var(--accent)] outline-none" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={saveSettings} disabled={saving} className="py-2 px-5 bg-[var(--accent)] text-[var(--background)] text-sm font-mono font-bold rounded hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? "Saving…" : "Save settings"}
            </button>
            {savedMsg && <span className="text-sm font-mono text-[var(--muted)]">{savedMsg}</span>}
          </div>
        </section>

        {/* Recent API activity */}
        <section className="bg-[var(--card)] border border-[var(--card-border)] p-6 rounded-lg">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Pulse size={20} className="text-[var(--accent)]" />Recent API Activity</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">No API calls yet. Make your first request to see activity here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="text-[var(--muted)] text-xs border-b border-[var(--card-border)]">
                    <th className="text-left font-normal py-2">Method</th>
                    <th className="text-left font-normal py-2">Endpoint</th>
                    <th className="text-right font-normal py-2">Status</th>
                    <th className="text-right font-normal py-2 hidden sm:table-cell">Time</th>
                    <th className="text-right font-normal py-2 hidden md:table-cell">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i} className="border-b border-[var(--card-border)]/50">
                      <td className="py-2"><span className="text-[var(--accent)]">{log.method}</span></td>
                      <td className="py-2 text-[var(--muted)] max-w-[260px] truncate">{log.endpoint}</td>
                      <td className={`py-2 text-right ${statusColor(log.statusCode)}`}>{log.statusCode}</td>
                      <td className="py-2 text-right text-[var(--muted)] hidden sm:table-cell">{log.responseTime}ms</td>
                      <td className="py-2 text-right text-[var(--muted)] hidden md:table-cell">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quick links */}
        <section className="flex flex-wrap items-center justify-between gap-4 bg-[var(--card)] border border-[var(--card-border)] p-6 rounded-lg">
          <div>
            <h2 className="font-bold flex items-center gap-2"><BookOpen size={18} className="text-[var(--accent)]" />Build with GUAP</h2>
            <p className="text-sm text-[var(--muted)]">Full reference, endpoints, and the money model.</p>
          </div>
          <Link href="/developers" className="px-5 py-2 border-2 border-[var(--accent)] text-[var(--accent)] font-mono text-sm font-bold rounded hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors">
            API Documentation →
          </Link>
        </section>
      </main>
    </div>
  );
}
