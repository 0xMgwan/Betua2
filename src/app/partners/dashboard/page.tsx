"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Terminal, Key, Users, ChartLine, Copy, Check, SignOut, Eye, EyeSlash, Warning } from "@phosphor-icons/react";

export default function PartnerDashboard() {
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/partners/me"), fetch("/api/partners/stats")])
      .then(async ([meRes, statsRes]) => {
        if (!meRes.ok) { router.push("/partners"); return; }
        setPartner((await meRes.json()).partner);
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

  if (loading) return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center"><span className="text-[var(--muted)]">Loading...</span></div>;
  if (!partner) return null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--card-border)] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold"><Terminal size={24} className="text-[var(--accent)]" />GUAP <span className="text-[var(--muted)] text-sm ml-2">Partner Dashboard</span></Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--muted)]">{partner.email}</span>
            <button onClick={() => { fetch("/api/partners/logout", { method: "POST" }); router.push("/partners"); }} className="text-[var(--muted)] hover:text-red-500"><SignOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!partner.isApproved && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
            <Warning size={24} className="text-yellow-500" />
            <div><p className="font-bold text-yellow-500">Account Pending Approval</p><p className="text-sm text-[var(--muted)]">API calls will be rejected until approved.</p></div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[var(--card)] border border-[var(--card-border)] p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Key size={20} className="text-[var(--accent)]" />API Credentials</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono overflow-hidden">{showApiKey && partner.rawApiKey ? partner.rawApiKey : `${partner.apiKeyPrefix}${"•".repeat(24)}`}</code>
                  <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 text-[var(--muted)]">{showApiKey ? <EyeSlash size={18} /> : <Eye size={18} />}</button>
                  <button onClick={copyApiKey} className="p-2 text-[var(--muted)]">{copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-[var(--muted)]">Tier:</span> <span className="text-[var(--accent)]">{partner.tier}</span></div>
                <div><span className="text-[var(--muted)]">Rate:</span> {partner.rateLimit}/min</div>
                <div><span className="text-[var(--muted)]">Status:</span> <span className={partner.isApproved ? "text-green-500" : "text-yellow-500"}>{partner.isApproved ? "Active" : "Pending"}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--card-border)] p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><ChartLine size={20} className="text-[var(--accent)]" />Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[var(--background)] border border-[var(--card-border)]"><div className="text-2xl font-bold text-[var(--accent)]">{stats?.users || 0}</div><div className="text-xs text-[var(--muted)]">Users</div></div>
              <div className="p-3 bg-[var(--background)] border border-[var(--card-border)]"><div className="text-2xl font-bold">{stats?.trades?.count || 0}</div><div className="text-xs text-[var(--muted)]">Trades</div></div>
              <div className="p-3 bg-[var(--background)] border border-[var(--card-border)]"><div className="text-2xl font-bold">{stats?.apiCalls?.today || 0}</div><div className="text-xs text-[var(--muted)]">Calls Today</div></div>
              <div className="p-3 bg-[var(--background)] border border-[var(--card-border)]"><div className="text-2xl font-bold">{((stats?.trades?.volume || 0) / 1000).toFixed(1)}K</div><div className="text-xs text-[var(--muted)]">Volume TZS</div></div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[var(--card)] border border-[var(--card-border)] p-6 text-center"><Users size={32} className="mx-auto mb-2 text-[var(--accent)]" /><div className="text-3xl font-bold">{stats?.users || 0}</div><div className="text-sm text-[var(--muted)]">Registered Users</div></div>
          <div className="bg-[var(--card)] border border-[var(--card-border)] p-6 text-center"><ChartLine size={32} className="mx-auto mb-2 text-[var(--accent)]" /><div className="text-3xl font-bold">{stats?.apiCalls?.thisMonth || 0}</div><div className="text-sm text-[var(--muted)]">Calls This Month</div></div>
          <div className="bg-[var(--card)] border border-[var(--card-border)] p-6 text-center"><ChartLine size={32} className="mx-auto mb-2 text-[var(--accent)]" /><div className="text-3xl font-bold">{stats?.apiCalls?.total || 0}</div><div className="text-sm text-[var(--muted)]">Total Calls</div></div>
        </div>

        <div className="text-center"><Link href="/developers" className="text-[var(--accent)] hover:underline">View API Documentation →</Link></div>
      </main>
    </div>
  );
}
