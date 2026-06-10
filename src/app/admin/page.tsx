"use client";
import { useState, useEffect } from "react";
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

type Tab = "overview" | "users" | "markets";

interface Summary {
  totalUsers: number; totalBalanceTzs: number; totalVolume: number;
  openMarkets: number; resolvedMarkets: number; totalDeposits: number;
  totalWithdrawals: number; totalTrades: number;
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

  const isAdmin = user && (ADMIN_NTZS.includes(user.ntzsUserId || ""));

  useEffect(() => {
    if (user && !isAdmin) { router.push("/"); return; }
    if (!user) return;
    fetch("/api/admin/dashboard")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, isAdmin, router]);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMsg("");
    try {
      const res = await fetch("/api/admin/reconcile-balances", { method: "POST" });
      const d = await res.json();
      setReconcileMsg(`✅ Reconciled ${d.usersReconciled} users`);
      // Refresh data
      const fresh = await fetch("/api/admin/dashboard").then(r => r.json());
      setData(fresh);
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
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] font-mono">
      {/* Header */}
      <div className="border-b border-[var(--card-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-widest">⚙ Admin Dashboard</h1>
          <p className="text-[10px] text-[var(--muted)] mt-0.5">Guap Platform · {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-3">
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
              <p className="text-[10px] text-orange-400 uppercase font-bold mb-2">Settlement Pool</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div><span className="text-[var(--muted)]">Pool wallet: </span><span className="text-[var(--foreground)]">{process.env.NEXT_PUBLIC_POOL_ID || "f09f1742-4919-4e11-8591-583a1af280e6"}</span></div>
                <div><span className="text-[var(--muted)]">Net flow: </span><span className={s.totalDeposits >= s.totalWithdrawals ? "text-[#00e5a0]" : "text-red-400"}>{formatTZS(s.totalDeposits - s.totalWithdrawals)}</span></div>
                <div><span className="text-[var(--muted)]">DB liability: </span><span className="text-orange-400">{formatTZS(s.totalBalanceTzs)}</span></div>
              </div>
            </div>
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
                    {["Title","Category","Creator","Status","Volume","Seed","Trades","Bettors","Resolves","Created"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[9px] text-[var(--muted)] uppercase tracking-wider font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.map(m => (
                    <tr key={m.id} className="border-b border-[var(--card-border)]/40 hover:bg-[var(--card)] transition-colors">
                      <td className="px-3 py-2 max-w-[240px]">
                        <a href={`/markets/${m.id}`} target="_blank" className="text-[var(--accent)] hover:underline truncate block" title={m.title}>
                          {m.title.length > 48 ? m.title.slice(0, 48) + "…" : m.title}
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
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredMarkets.length === 0 && <p className="text-center text-[var(--muted)] text-xs py-8">No markets found</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
