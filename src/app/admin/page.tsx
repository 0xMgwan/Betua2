"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/store/useUser";
import { useRouter } from "next/navigation";
import { formatTZS } from "@/lib/utils";

const ADMIN_NTZS = [
  "3017ff5f-24f0-4063-bb35-4ddbc3cd1987",
  "994dcdcc-0bc4-4641-9e94-93e658ede56b",
  "5e89781c-b8c0-4a49-a235-0bb0048ac18d",
  "2e7ea0a6-472c-44b9-8a61-b6e2865fe558",
  "c458cdc9-db89-408e-a077-dacb72af789d",
];

type Tab = "overview" | "users" | "markets" | "tools";

interface Summary {
  totalUsers: number; totalBalanceTzs: number; totalVolume: number;
  openMarkets: number; resolvedMarkets: number; totalDeposits: number;
  totalWithdrawals: number; totalTrades: number; totalImpliedLiability: number;
  openSeedLiability: number; poolBalanceTzs: number; poolBalanceUsdc: number;
}
interface User {
  id: string; username: string; displayName: string; email: string; phone: string;
  country: string; balanceTzs: number; balanceUsdc: number; balanceKes: number;
  ntzsUserId: string | null; createdAt: string;
  _count: { trades: number; marketsCreated: number; positions: number };
}
interface Market {
  id: string; title: string; category: string; status: string; totalVolume: number;
  seedAmount: number; createdAt: string; resolvesAt: string; outcome: number | null;
  creator: { username: string };
  _count: { trades: number; positions: number };
}

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<{ summary: Summary; users: User[]; markets: Market[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // LP Repair state
  const [lpMarketId, setLpMarketId] = useState("");
  const [lpStatus, setLpStatus] = useState<"idle"|"diagnosing"|"repairing"|"done"|"error">("idle");
  const [lpDiagnosis, setLpDiagnosis] = useState<{
    market: { id: string; title: string; status: string; outcomeLabel: string; seedAmount: number; totalVolume: number };
    diagnosis: { hasPosition: boolean; positionRedeemed: boolean | null; hasLpRedeemTx: boolean; creatorWinShares: number; totalWinShares: number; netPayout: number; stuck: boolean };
  } | null>(null);
  const [lpRepairResult, setLpRepairResult] = useState<{ payoutTzs?: number; note?: string } | null>(null);
  const [lpError, setLpError] = useState("");

  const isAdmin = user && (ADMIN_NTZS.includes(user.ntzsUserId || ""));

  const loadDashboard = useCallback(async (isPoll = false) => {
    if (isPoll) setRefreshing(true);
    try {
      const d = await fetch("/api/admin/dashboard").then(r => r.json());
      setData(d);
      setLastUpdated(new Date());
    } catch { /* keep stale data on error */ }
    finally { setLoading(false); if (isPoll) setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (user && !isAdmin) { router.push("/"); return; }
    if (!user) return;
    loadDashboard();
    // Auto-refresh every 20s so deposits/trades/redeems/seeds reflect live
    const interval = setInterval(() => loadDashboard(true), 20000);
    return () => clearInterval(interval);
  }, [user, isAdmin, router, loadDashboard]);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMsg("");
    try {
      const res = await fetch("/api/admin/reconcile-balances", { method: "POST" });
      const d = await res.json();
      setReconcileMsg(`✅ Reconciled ${d.usersReconciled} users`);
      await loadDashboard(true);
    } catch { setReconcileMsg("❌ Failed"); }
    finally { setReconciling(false); }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-sm text-[var(--muted)]">
        {!user ? "Not authenticated" : "Loading..."}
      </div>
    );
  }
  if (!isAdmin) return null;

  const filteredUsers = (data?.users || []).filter(u =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );
  const filteredMarkets = (data?.markets || []).filter(m =>
    !search || m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.creator?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const s = data?.summary;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: `Users (${data?.users.length || 0})` },
    { key: "markets", label: `Markets (${data?.markets.length || 0})` },
    { key: "tools", label: "Tools" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] font-mono">
      {/* Header */}
      <div className="border-b border-[var(--card-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-widest">⚙ Admin Dashboard</h1>
          <p className="text-[10px] text-[var(--muted)] mt-0.5 flex items-center gap-2">
            Guap Platform · {new Date().toLocaleDateString()}
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? "bg-[#00e5a0] animate-pulse" : "bg-[#00e5a0]/50"}`} />
              {refreshing ? "Updating…" : lastUpdated ? `Live · updated ${lastUpdated.toLocaleTimeString()}` : "Live"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="px-3 py-1.5 text-[10px] font-bold border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors disabled:opacity-50"
          >
            ⟳ Refresh
          </button>
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="px-3 py-1.5 text-[10px] font-bold border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
          >
            {reconciling ? "Reconciling..." : "⟳ Reconcile Balances"}
          </button>
          {reconcileMsg && <span className="text-[10px] text-[var(--muted)]">{reconcileMsg}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--card-border)] px-6 flex gap-0">
        {TABS.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              tab === tb.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* ── OVERVIEW ── */}
        {tab === "overview" && s && (
          <div className="space-y-6">
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Users", value: s.totalUsers.toLocaleString(), color: "text-[var(--accent)]" },
                { label: "User Balances (DB)", value: formatTZS(s.totalBalanceTzs), color: "text-[var(--accent)]" },
                { label: "Platform Volume", value: formatTZS(s.totalVolume), color: "text-blue-400" },
                { label: "Total Trades", value: s.totalTrades.toLocaleString(), color: "text-purple-400" },
                { label: "Open Markets", value: s.openMarkets.toLocaleString(), color: "text-[#00e5a0]" },
                { label: "Resolved Markets", value: s.resolvedMarkets.toLocaleString(), color: "text-[var(--muted)]" },
                { label: "Total Deposits", value: formatTZS(s.totalDeposits), color: "text-[#00e5a0]" },
                { label: "Total Withdrawals", value: formatTZS(s.totalWithdrawals), color: "text-red-400" },
              ].map(kpi => (
                <div key={kpi.label} className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                  <p className="text-[9px] text-[var(--muted)] uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className={`text-xl font-black tabular-nums ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Settlement pool info */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/20">
              <p className="text-[10px] text-orange-400 uppercase font-bold mb-2">Settlement Pool (on-chain)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div><span className="text-[var(--muted)]">Pool wallet: </span><span className="text-[var(--foreground)] text-[10px]">f09f1742-4919-4e11-8591-583a1af280e6</span></div>
                <div><span className="text-[var(--muted)]">Live nTZS balance: </span><span className="font-bold text-[#00e5a0]">{formatTZS(s.poolBalanceTzs)}</span></div>
                <div><span className="text-[var(--muted)]">Live USDC: </span><span className="font-bold">{s.poolBalanceUsdc > 0 ? `$${s.poolBalanceUsdc.toFixed(2)}` : "—"}</span></div>
              </div>
            </div>

            {/* Pool health — based on REAL on-chain balance */}
            {(() => {
              // Total liability the pool must be able to cover:
              //  - what users can withdraw right now (DB balances)
              //  - worst-case fixed-odds payouts on open positions
              //  - seed capital locked in open markets (LP positions, parimutuel)
              const liability = s.totalBalanceTzs + s.totalImpliedLiability + s.openSeedLiability;
              const poolReal  = s.poolBalanceTzs; // actual on-chain wallet balance
              const coverage  = liability > 0 ? Math.round((poolReal / liability) * 100) : (poolReal > 0 ? 999 : 0);
              const surplus   = poolReal - liability;
              const healthy   = coverage >= 100;
              const warning   = coverage >= 70 && coverage < 100;
              return (
                <div className={`p-4 border ${healthy ? "bg-[#00e5a0]/5 border-[#00e5a0]/20" : warning ? "bg-yellow-500/5 border-yellow-500/20" : "bg-red-500/5 border-red-500/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-[10px] uppercase font-bold ${healthy ? "text-[#00e5a0]" : warning ? "text-yellow-400" : "text-red-400"}`}>
                      {healthy ? "✓ Pool Health: Solvent" : warning ? "⚠ Pool Health: Watch" : "✗ Pool Health: At Risk"}
                    </p>
                    <span className={`text-lg font-black tabular-nums ${healthy ? "text-[#00e5a0]" : warning ? "text-yellow-400" : "text-red-400"}`}>{coverage >= 999 ? "∞" : `${coverage}%`}</span>
                  </div>
                  <div className="w-full bg-[var(--card-border)] h-1.5 mb-3">
                    <div className={`h-full transition-all ${healthy ? "bg-[#00e5a0]" : warning ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${Math.min(100, coverage)}%` }} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                    <div><span className="text-[var(--muted)]">Pool balance (real): </span><span className="font-bold text-[#00e5a0]">{formatTZS(poolReal)}</span></div>
                    <div><span className="text-[var(--muted)]">User balances (DB): </span><span className="font-bold">{formatTZS(s.totalBalanceTzs)}</span></div>
                    <div><span className="text-[var(--muted)]">Open payouts: </span><span className="font-bold text-orange-400">{formatTZS(s.totalImpliedLiability)}</span></div>
                    <div><span className="text-[var(--muted)]">Locked seed: </span><span className="font-bold text-orange-400">{formatTZS(s.openSeedLiability)}</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[var(--card-border)] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--muted)]">Total liability: <span className="font-bold text-[var(--foreground)]">{formatTZS(liability)}</span></span>
                    <span className="text-[var(--muted)]">Surplus / (deficit): <span className={`font-bold ${surplus >= 0 ? "text-[#00e5a0]" : "text-red-400"}`}>{formatTZS(surplus)}</span></span>
                  </div>
                  <p className="text-[9px] text-[var(--muted)] mt-2">
                    Coverage = real on-chain pool balance ÷ (user balances + open payout obligations + locked seed). Pool needs ≥ 100% to guarantee all payouts. Reads live from nTZS wallet f09f1742.
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search by username, email or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    {["Username","Email","Phone","Country","TZS Balance","USDC","Trades","Markets","Positions","Wallet","Joined"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[9px] text-[var(--muted)] uppercase tracking-wider font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-b border-[var(--card-border)]/40 hover:bg-[var(--card)] transition-colors">
                      <td className="px-3 py-2 font-bold text-[var(--accent)]">@{u.username}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">{u.email}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">{u.phone || "—"}</td>
                      <td className="px-3 py-2">{u.country || "—"}</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-right">
                        <span className={(u.balanceTzs || 0) > 0 ? "text-[#00e5a0]" : "text-[var(--muted)]"}>
                          {formatTZS(Math.max(0, u.balanceTzs || 0))}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-right">{(u.balanceUsdc || 0) > 0 ? `$${(u.balanceUsdc || 0).toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2 text-center">{u._count.trades}</td>
                      <td className="px-3 py-2 text-center">{u._count.marketsCreated}</td>
                      <td className="px-3 py-2 text-center">{u._count.positions}</td>
                      <td className="px-3 py-2 text-[var(--muted)] text-[9px]">
                        {u.ntzsUserId ? <span className="text-[#00e5a0]">✓ wallet</span> : <span className="text-[var(--muted)]">DB only</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p className="text-center text-[var(--muted)] text-xs py-8">No users found</p>}
            </div>
          </div>
        )}

        {/* ── MARKETS ── */}
        {tab === "markets" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search by title or creator..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    {["Market ID","Title","Category","Creator","Status","Volume","Seed","Trades","Bettors","Resolves","Created",""].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[9px] text-[var(--muted)] uppercase tracking-wider font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.map(m => (
                    <tr key={m.id} className="border-b border-[var(--card-border)]/40 hover:bg-[var(--card)] transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          onClick={() => { navigator.clipboard.writeText(m.id); }}
                          title="Click to copy"
                          className="flex items-center gap-1.5 group"
                        >
                          <span className="text-[10px] font-mono text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
                            {m.id.slice(0, 8)}…
                          </span>
                          <span className="text-[9px] text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors opacity-0 group-hover:opacity-100">⎘</span>
                        </button>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <a href={`/markets/${m.id}`} target="_blank" className="text-[var(--accent)] hover:underline truncate block" title={m.title}>
                          {m.title.length > 40 ? m.title.slice(0, 40) + "…" : m.title}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">{m.category}</td>
                      <td className="px-3 py-2">@{m.creator?.username}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold ${
                          m.status === "OPEN" ? "bg-[#00e5a0]/10 text-[#00e5a0]" :
                          m.status === "RESOLVED" ? "bg-blue-500/10 text-blue-400" :
                          "bg-[var(--muted)]/10 text-[var(--muted)]"
                        }`}>{m.status}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums font-bold text-right">{formatTZS(m.totalVolume)}</td>
                      <td className="px-3 py-2 tabular-nums text-right text-[var(--muted)]">{m.seedAmount > 0 ? formatTZS(m.seedAmount) : "—"}</td>
                      <td className="px-3 py-2 text-center">{m._count.trades}</td>
                      <td className="px-3 py-2 text-center">{m._count.positions}</td>
                      <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap">{new Date(m.resolvesAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        {m.status === "RESOLVED" && m.seedAmount > 0 && (
                          <button
                            onClick={() => { setLpMarketId(m.id); setTab("tools"); }}
                            className="text-[9px] font-mono font-bold px-2 py-1 border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          >
                            LP Repair →
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMarkets.length === 0 && <p className="text-center text-[var(--muted)] text-xs py-8">No markets found</p>}
            </div>
          </div>
        )}

        {/* ── TOOLS ── */}
        {tab === "tools" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LP Repair */}
            <div className="space-y-4">
              <div className="border border-[var(--card-border)] bg-[var(--card)]">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--card-border)] bg-[var(--background)]">
                  <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500/70"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"/><div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]/70"/></div>
                  <span className="text-[10px] font-mono text-[var(--muted)]">admin::lp_repair.sh</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider mb-1">LP Repair Tool</p>
                    <p className="text-[10px] font-mono text-[var(--muted)]">Diagnose and fix stuck creator LP positions after resolution.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={lpMarketId}
                      onChange={e => setLpMarketId(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (async () => {
                        if (!lpMarketId.trim()) return;
                        setLpStatus("diagnosing"); setLpDiagnosis(null); setLpRepairResult(null); setLpError("");
                        try {
                          const res = await fetch(`/api/admin/lp-repair?marketId=${lpMarketId.trim()}`);
                          const d = await res.json();
                          if (!res.ok) { setLpError(d.error || "Failed"); setLpStatus("error"); return; }
                          setLpDiagnosis(d); setLpStatus("idle");
                        } catch { setLpError("Network error"); setLpStatus("error"); }
                      })()}
                      placeholder="Market ID..."
                      className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-[11px] font-mono focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      disabled={lpStatus === "diagnosing" || !lpMarketId.trim()}
                      onClick={async () => {
                        if (!lpMarketId.trim()) return;
                        setLpStatus("diagnosing"); setLpDiagnosis(null); setLpRepairResult(null); setLpError("");
                        try {
                          const res = await fetch(`/api/admin/lp-repair?marketId=${lpMarketId.trim()}`);
                          const d = await res.json();
                          if (!res.ok) { setLpError(d.error || "Failed"); setLpStatus("error"); return; }
                          setLpDiagnosis(d); setLpStatus("idle");
                        } catch { setLpError("Network error"); setLpStatus("error"); }
                      }}
                      className="px-3 py-2 border border-[var(--accent)] text-[var(--accent)] text-[10px] font-mono hover:bg-[var(--accent)]/10 disabled:opacity-40 transition-colors"
                    >
                      {lpStatus === "diagnosing" ? "..." : "Diagnose"}
                    </button>
                  </div>

                  {lpError && <p className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-1">{lpError}</p>}

                  {lpDiagnosis && (() => {
                    const d = lpDiagnosis.diagnosis;
                    const stuck = d.stuck || (d.hasPosition && d.positionRedeemed && !d.hasLpRedeemTx);
                    const canRepair = lpDiagnosis.market.status === "RESOLVED" && stuck;
                    return (
                      <div className="border border-[var(--card-border)] bg-[var(--background)] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-mono font-bold truncate">{lpDiagnosis.market.title}</p>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 ${stuck ? "bg-red-500/10 text-red-400" : d.hasLpRedeemTx ? "bg-[#00e5a0]/10 text-[#00e5a0]" : "bg-yellow-500/10 text-yellow-400"}`}>
                            {stuck ? "⚠ STUCK" : d.hasLpRedeemTx ? "✓ OK" : "? UNKNOWN"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                          <span className="text-[var(--muted)]">Seed</span><span className="text-right">{formatTZS(lpDiagnosis.market.seedAmount)}</span>
                          <span className="text-[var(--muted)]">Net payout</span><span className="text-right text-[var(--accent)]">{formatTZS(d.netPayout)}</span>
                          <span className="text-[var(--muted)]">Has position</span><span className="text-right">{d.hasPosition ? "✓" : "✗"}</span>
                          <span className="text-[var(--muted)]">LP tx exists</span><span className="text-right">{d.hasLpRedeemTx ? "✓" : "✗"}</span>
                        </div>
                        {canRepair && lpStatus !== "done" && (
                          <button
                            disabled={lpStatus === "repairing"}
                            onClick={async () => {
                              setLpStatus("repairing");
                              try {
                                const res = await fetch("/api/admin/lp-repair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketId: lpDiagnosis.market.id }) });
                                const rd = await res.json();
                                if (!res.ok) { setLpError(rd.error || "Repair failed"); setLpStatus("error"); return; }
                                setLpRepairResult(rd); setLpStatus("done");
                              } catch { setLpError("Network error"); setLpStatus("error"); }
                            }}
                            className="w-full py-2 bg-[var(--accent)] text-black text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {lpStatus === "repairing" ? "Sending..." : `Repair — Send ${formatTZS(d.netPayout)}`}
                          </button>
                        )}
                        {lpStatus === "done" && lpRepairResult && (
                          <div className="text-[10px] font-mono text-[#00e5a0] bg-[#00e5a0]/10 px-2 py-1">
                            ✅ Sent {formatTZS(lpRepairResult.payoutTzs || 0)} · {lpRepairResult.note || "Balance credited"}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <div className="border border-[var(--card-border)] bg-[var(--card)]">
                <div className="px-4 py-2 border-b border-[var(--card-border)] bg-[var(--background)]">
                  <span className="text-[10px] font-mono text-[var(--muted)]">admin::quick_actions.sh</span>
                </div>
                <div className="p-4 space-y-2">
                  <p className="text-[11px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider mb-3">Quick Actions</p>
                  {[
                    { label: "Reconcile All Balances", desc: "Recalculate balanceTzs from tx history", action: handleReconcile, loading: reconciling, msg: reconcileMsg, color: "border-orange-500/40 text-orange-400 hover:bg-orange-500/10" },
                  ].map(a => (
                    <div key={a.label} className="border border-[var(--card-border)] p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-mono font-bold">{a.label}</p>
                          <p className="text-[9px] font-mono text-[var(--muted)]">{a.desc}</p>
                        </div>
                        <button onClick={a.action} disabled={a.loading} className={`px-3 py-1.5 text-[10px] font-mono font-bold border transition-colors disabled:opacity-50 ${a.color}`}>
                          {a.loading ? "..." : "Run"}
                        </button>
                      </div>
                      {a.msg && <p className="text-[10px] font-mono text-[var(--muted)]">{a.msg}</p>}
                    </div>
                  ))}

                  {/* Admin links */}
                  <div className="pt-2 space-y-1">
                    <p className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">Other Admin Pages</p>
                    {[
                      { label: "LP Repair (standalone)", href: "/admin/lp-repair" },
                      { label: "Markets", href: "/markets" },
                      { label: "Create Market", href: "/markets/create" },
                    ].map(l => (
                      <a key={l.href} href={l.href} className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors border border-transparent hover:border-[var(--accent)]/20">
                        → {l.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
