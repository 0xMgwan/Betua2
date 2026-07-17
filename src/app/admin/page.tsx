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
// Admins identified by userId (e.g. pooled users with no nTZS wallet)
const ADMIN_IDS = [
  "cmqr2tyew000004icz2ibal5y", // @goodmusic__tz
];

type Tab = "overview" | "users" | "markets" | "partners" | "referrals" | "cashflow" | "tools";

interface CashflowItem {
  id: string; ntzsId: string | null; reference: string | null;
  username: string; email: string; amountTzs: number; currency: string;
  status: string; phone: string | null; createdAt: string;
}
interface CashflowData { kind: string; items: CashflowItem[]; totalCompletedTzs: number; count: number }
type AnyUser = { externalId: string; username: string | null; email: string | null; phone: string | null; balanceTzs: number; balanceUsdc: number };

interface Summary {
  totalUsers: number; totalBalanceTzs: number; totalVolume: number;
  openMarkets: number; resolvedMarkets: number; totalDeposits: number;
  totalWithdrawals: number; totalTrades: number; totalImpliedLiability: number;
  openSeedLiability: number; poolBalanceTzs: number; poolBalanceUsdc: number;
}
interface User {
  id: string; username: string; displayName: string; email: string; phone: string;
  country: string; balanceTzs: number; balanceUsdc: number; balanceKes: number;
  inPositionsTzs?: number;
  depositedTzs?: number; depositCount?: number; withdrawnTzs?: number; withdrawCount?: number;
  onchainBalanceTzs?: number | null; onchainBalanceUsdc?: number | null;
  ntzsUserId: string | null; createdAt: string; systemWallet?: string | null;
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
  const [cashKind, setCashKind] = useState<"deposit" | "withdrawal">("deposit");
  const [cashflow, setCashflow] = useState<CashflowData | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashSearch, setCashSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState("");
  const [resolvingPyth, setResolvingPyth] = useState(false);
  const [resolvePythMsg, setResolvePythMsg] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [partners, setPartners] = useState<any[] | null>(null);
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [referrals, setReferrals] = useState<any | null>(null);
  const [retryingRef, setRetryingRef] = useState(false);
  const [retryRefMsg, setRetryRefMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // LP Repair state
  const [lpMarketId, setLpMarketId] = useState("");
  const [auditUser, setAuditUser] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [lpStatus, setLpStatus] = useState<"idle"|"diagnosing"|"repairing"|"done"|"error">("idle");
  const [lpDiagnosis, setLpDiagnosis] = useState<{
    market: { id: string; title: string; status: string; outcomeLabel: string; seedAmount: number; totalVolume: number };
    diagnosis: { hasPosition: boolean; positionRedeemed: boolean | null; hasLpRedeemTx: boolean; creatorWinShares: number; totalWinShares: number; netPayout: number; stuck: boolean };
  } | null>(null);
  const [lpRepairResult, setLpRepairResult] = useState<{ payoutTzs?: number; note?: string } | null>(null);
  const [lpError, setLpError] = useState("");

  const isAdmin = user && (ADMIN_NTZS.includes(user.ntzsUserId || "") || ADMIN_IDS.includes(user.id || ""));

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

  // Lazy-load partners the first time the Partners tab is opened
  useEffect(() => {
    if (tab === "partners" && partners === null && isAdmin) {
      fetch("/api/admin/partners").then(r => r.ok ? r.json() : { partners: [] }).then(d => setPartners(d.partners || []));
    }
  }, [tab, partners, isAdmin]);

  // Lazy-load referrals the first time the Referrals tab is opened
  useEffect(() => {
    if (tab === "referrals" && referrals === null && isAdmin) {
      fetch("/api/admin/referrals").then(r => r.ok ? r.json() : null).then(d => d && setReferrals(d));
    }
  }, [tab, referrals, isAdmin]);

  // Cashflow (deposits/withdrawals): reload on tab open, kind toggle, or search
  useEffect(() => {
    if (tab !== "cashflow" || !isAdmin) return;
    setCashLoading(true);
    const params = new URLSearchParams({ kind: cashKind });
    if (cashSearch.trim()) params.set("q", cashSearch.trim());
    const t = setTimeout(() => {
      fetch(`/api/admin/transactions?${params}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setCashflow(d))
        .finally(() => setCashLoading(false));
    }, cashSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [tab, cashKind, cashSearch, isAdmin]);

  // Load behavior analytics for the overview; refetch when the window changes
  useEffect(() => {
    if (!isAdmin) return;
    setAnalyticsLoading(true);
    fetch(`/api/admin/analytics?days=${analyticsDays}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setAnalytics(d))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [isAdmin, analyticsDays]);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileMsg("");
    try {
      const res = await fetch("/api/admin/reconcile-balances", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success) {
        setReconcileMsg(`❌ ${d?.error || `Failed (${res.status})`}`);
      } else {
        setReconcileMsg(`✅ Reconciled ${d.usersReconciled} of ${d.scanned} users`);
        await loadDashboard(true);
      }
    } catch (e) { setReconcileMsg(`❌ ${e instanceof Error ? e.message : "Network/timeout error"}`); }
    finally { setReconciling(false); }
  };

  const handleRetryReferrals = async () => {
    setRetryingRef(true);
    setRetryRefMsg("");
    try {
      const res = await fetch("/api/admin/referrals/retry", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setRetryRefMsg(`❌ ${d.error || "Failed"}`);
      else {
        setRetryRefMsg(`✅ Paid ${d.credited} (${formatTZS(d.amountTzs)})${d.skipped ? `, ${d.skipped} skipped` : ""}`);
        const r = await fetch("/api/admin/referrals");
        if (r.ok) setReferrals(await r.json());
      }
    } catch { setRetryRefMsg("❌ Failed"); }
    finally { setRetryingRef(false); }
  };

  const handleBackfillImplied = async () => {
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const res = await fetch("/api/admin/backfill-implied", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setBackfillMsg(`❌ ${d.error || "Failed"}`);
      else setBackfillMsg(`✅ Backfilled ${d.updated}/${d.scanned} open positions`);
    } catch { setBackfillMsg("❌ Failed"); }
    finally { setBackfilling(false); }
  };

  const handleResolvePyth = async (dryRun = false) => {
    setResolvingPyth(true);
    setResolvePythMsg("");
    try {
      const res = await fetch(`/api/cron/resolve-pyth${dryRun ? "?dry=1" : ""}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setResolvePythMsg(`❌ ${d.error || "Failed"}`);
      } else if (d.checked === 0) {
        setResolvePythMsg("✓ No due Pyth markets");
      } else if (dryRun) {
        const lines = (d.results || [])
          .map((r: { symbol?: string; price?: number; target?: number; operator?: string; wouldResolve?: string }) =>
            `${r.symbol} ${r.price} vs ${r.operator} ${r.target} → ${r.wouldResolve}`)
          .join(" · ");
        setResolvePythMsg(`🔍 ${d.checked} due: ${lines}`);
      } else {
        setResolvePythMsg(`✅ Resolved ${d.resolved}/${d.checked} due market(s)`);
        await loadDashboard(true);
      }
    } catch { setResolvePythMsg("❌ Failed"); }
    finally { setResolvingPyth(false); }
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
    { key: "partners", label: `Partners${partners ? ` (${partners.length})` : ""}` },
    { key: "referrals", label: "Referrals" },
    { key: "cashflow", label: "Cashflow" },
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

            {/* ── USER BEHAVIOR ANALYTICS (30d) ── */}
            {analytics && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-2">
                  <h2 className="text-sm font-mono font-black uppercase tracking-wider">Trading Behavior{analyticsLoading && <span className="text-[10px] text-[var(--muted)] ml-2">updating…</span>}</h2>
                  <div className="flex gap-1">
                    {[{ d: 7, l: "7D" }, { d: 30, l: "30D" }, { d: 90, l: "90D" }, { d: 0, l: "ALL" }].map(w => (
                      <button
                        key={w.d}
                        onClick={() => setAnalyticsDays(w.d)}
                        className={`px-2 py-1 text-[10px] font-mono border transition-colors ${analyticsDays === w.d ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                      >
                        {w.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buy/sell split + new vs returning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-3">Buys vs Sells</p>
                    {(() => {
                      const b = analytics.buySell.buys, sl = analytics.buySell.sells;
                      const tot = b.volume + sl.volume || 1;
                      return (
                        <>
                          <div className="flex h-3 overflow-hidden mb-2">
                            <div className="bg-[#00e5a0]" style={{ width: `${(b.volume / tot) * 100}%` }} />
                            <div className="bg-red-400" style={{ width: `${(sl.volume / tot) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-[#00e5a0]">Buys: {formatTZS(b.volume)} · {b.count}</span>
                            <span className="text-red-400">Sells: {formatTZS(sl.volume)} · {sl.count}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-3">New vs Returning Traders {analyticsDays === 0 && <span className="opacity-60">(n/a all-time)</span>}</p>
                    {(() => {
                      const n = analytics.newTraders, r = analytics.returningTraders;
                      const tot = n + r || 1;
                      return (
                        <>
                          <div className="flex h-3 overflow-hidden mb-2">
                            <div className="bg-blue-400" style={{ width: `${(n / tot) * 100}%` }} />
                            <div className="bg-purple-400" style={{ width: `${(r / tot) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-blue-400">New: {n}</span>
                            <span className="text-purple-400">Returning: {r}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Behavior KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Avg Trade", value: formatTZS(analytics.avgTrade), color: "text-[var(--accent)]" },
                    { label: `Trades (${analyticsDays === 0 ? "all" : analyticsDays + "d"})`, value: analytics.totalTrades.toLocaleString(), color: "text-blue-400" },
                    { label: `Volume (${analyticsDays === 0 ? "all" : analyticsDays + "d"})`, value: formatTZS(analytics.totalVolume), color: "text-[#00e5a0]" },
                    { label: "Active Traders", value: analytics.uniqueTraders.toLocaleString(), color: "text-purple-400" },
                  ].map(k => (
                    <div key={k.label} className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                      <p className="text-[9px] text-[var(--muted)] uppercase tracking-wider mb-1">{k.label}</p>
                      <p className={`text-xl font-black tabular-nums ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Volume by category */}
                  <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-3">Volume by Category</p>
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {analytics.categories.map((c: any) => {
                        const max = analytics.categories[0]?.volume || 1;
                        return (
                          <div key={c.category}>
                            <div className="flex justify-between text-[11px] font-mono mb-0.5 gap-2">
                              <span>{c.category}</span>
                              <span className="text-[var(--muted)] shrink-0">{c.pct}% · {c.count} trades · avg {formatTZS(c.avgTrade)}</span>
                            </div>
                            <div className="h-2 bg-[var(--background)] overflow-hidden">
                              <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.max(2, (c.volume / max) * 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {analytics.categories.length === 0 && <p className="text-[11px] text-[var(--muted)]">No trades in window.</p>}
                    </div>
                  </div>

                  {/* Top markets */}
                  <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-3">Top Markets by Volume</p>
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {analytics.topMarkets.map((m: any) => {
                        const max = analytics.topMarkets[0]?.volume || 1;
                        return (
                          <div key={m.title}>
                            <div className="flex justify-between text-[11px] font-mono mb-0.5 gap-2">
                              <span className="truncate">{m.title}</span>
                              <span className="text-[var(--muted)] shrink-0">{formatTZS(m.volume)}</span>
                            </div>
                            <div className="h-2 bg-[var(--background)] overflow-hidden">
                              <div className="h-full bg-blue-400" style={{ width: `${Math.max(2, (m.volume / max) * 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {analytics.topMarkets.length === 0 && <p className="text-[11px] text-[var(--muted)]">No trades in window.</p>}
                    </div>
                  </div>
                </div>

                {/* Trades by hour of day (EAT) */}
                <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                  <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-3">When Users Trade (hour of day · EAT)</p>
                  <div className="flex items-end gap-0.5 h-28">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {analytics.byHour.map((h: any, i: number) => {
                      const max = Math.max(...analytics.byHour.map((x: any) => x.count), 1);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className="w-full bg-purple-400/80 hover:bg-purple-400 transition-colors" style={{ height: `${(h.count / max) * 100}%` }} title={`${i}:00 — ${h.count} trades`} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-[var(--muted)] mt-1">
                    <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                  </div>
                </div>

                {/* Daily volume (last 14d) */}
                <div className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                  <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-3">Daily Volume (last 14 days)</p>
                  <div className="flex items-end gap-1 h-28">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {analytics.days.map((d: any, i: number) => {
                      const max = Math.max(...analytics.days.map((x: any) => x.volume), 1);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div className="w-full bg-[#00e5a0]/80 hover:bg-[#00e5a0] transition-colors" style={{ height: `${(d.volume / max) * 100}%` }} title={`${d.date} — ${formatTZS(d.volume)} · ${d.count} trades`} />
                          <span className="text-[7px] font-mono text-[var(--muted)] mt-1 rotate-0">{d.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
                    {["Username","Email","Phone","Country","TZS Balance","In Positions","Deposited","Withdrawn","USDC","Trades","Markets","Positions","Wallet","Joined"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[9px] text-[var(--muted)] uppercase tracking-wider font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={`border-b border-[var(--card-border)]/40 transition-colors ${u.systemWallet ? "bg-orange-500/5 hover:bg-orange-500/10" : "hover:bg-[var(--card)]"}`}>
                      <td className="px-3 py-2 font-bold text-[var(--accent)]">
                        @{u.username}
                        {u.systemWallet && <span className="ml-1.5 text-[8px] font-mono px-1 py-0.5 bg-orange-500/20 text-orange-400 align-middle">{u.systemWallet.toUpperCase()}</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">{u.email}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">{u.phone || "—"}</td>
                      <td className="px-3 py-2">{u.country || "—"}</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-right">
                        <span className={(u.balanceTzs || 0) > 0 ? "text-[#00e5a0]" : "text-[var(--muted)]"}>
                          {formatTZS(Math.max(0, u.balanceTzs || 0))}
                        </span>
                        {/* House wallets: show the real on-chain balance too (differs from the
                            DB balance because payouts drain the wallet without debiting DB). */}
                        {u.systemWallet && u.onchainBalanceTzs != null && (
                          <div className="text-[9px] text-orange-400/80 font-normal mt-0.5" title="Live on-chain settlement-wallet balance">
                            on-chain: {formatTZS(u.onchainBalanceTzs)}
                          </div>
                        )}
                      </td>
                      {/* Net stake locked in open markets — 0 balance + big "in positions" = fully invested, not broke */}
                      <td className="px-3 py-2 tabular-nums text-right">
                        <span className={(u.inPositionsTzs || 0) > 0 ? "text-yellow-400" : "text-[var(--muted)]"}>
                          {(u.inPositionsTzs || 0) > 0 ? formatTZS(u.inPositionsTzs || 0) : "—"}
                        </span>
                      </td>
                      {/* Lifetime real money in (deposits) and out (withdrawals) */}
                      <td className="px-3 py-2 tabular-nums text-right">
                        {(u.depositedTzs || 0) > 0 ? (
                          <span className="text-[#00e5a0]" title={`${u.depositCount || 0} deposit(s)`}>
                            {formatTZS(u.depositedTzs || 0)}
                          </span>
                        ) : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-right">
                        {(u.withdrawnTzs || 0) > 0 ? (
                          <span className="text-red-400" title={`${u.withdrawCount || 0} withdrawal(s)`}>
                            {formatTZS(u.withdrawnTzs || 0)}
                          </span>
                        ) : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-right">{(u.balanceUsdc || 0) > 0 ? `$${(u.balanceUsdc || 0).toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2 text-center">{u._count.trades}</td>
                      <td className="px-3 py-2 text-center">{u._count.marketsCreated}</td>
                      <td className="px-3 py-2 text-center">{u._count.positions}</td>
                      <td className="px-3 py-2 text-[var(--muted)] text-[9px]">
                        {u.systemWallet ? <span className="text-orange-400">⚙ house</span> : u.ntzsUserId ? <span className="text-[#00e5a0]">✓ wallet</span> : <span className="text-[var(--muted)]">DB only</span>}
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

        {/* ── PARTNERS ── */}
        {tab === "partners" && (
          <div className="space-y-3">
            {partners === null ? (
              <p className="text-center text-[var(--muted)] text-xs py-8">Loading partners…</p>
            ) : partners.length === 0 ? (
              <p className="text-center text-[var(--muted)] text-xs py-8">No partners yet</p>
            ) : (
              partners.map((p) => {
                const open = expandedPartner === p.id;
                return (
                  <div key={p.id} className="border border-[var(--card-border)] bg-[var(--card)]">
                    {/* Partner header row */}
                    <button
                      onClick={() => setExpandedPartner(open ? null : p.id)}
                      className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 hover:bg-[var(--background)]/40 transition-colors"
                    >
                      <div className="flex-1 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{p.name}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 border ${p.isApproved ? "border-green-500/40 text-green-500" : "border-yellow-500/40 text-yellow-500"}`}>{p.isApproved ? "approved" : "pending"}</span>
                          {!p.isActive && <span className="text-[9px] font-mono px-1.5 py-0.5 border border-red-500/40 text-red-500">inactive</span>}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--muted)]">{p.email} · {p.tier}</div>
                      </div>
                      <div className="text-center"><div className="text-sm font-mono font-bold">{p._count.users}</div><div className="text-[9px] text-[var(--muted)]">users</div></div>
                      <div className="text-center"><div className="text-sm font-mono font-bold">{p._count.markets}</div><div className="text-[9px] text-[var(--muted)]">markets</div></div>
                      <div className="text-center"><div className="text-sm font-mono font-bold">{p._count.apiLogs}</div><div className="text-[9px] text-[var(--muted)]">API calls</div></div>
                      <div className="text-center"><div className="text-sm font-mono font-bold text-[var(--accent)]">{(p.earningsTzs || 0).toLocaleString()}</div><div className="text-[9px] text-[var(--muted)]">earnings TZS</div></div>
                      <div className="text-center"><div className="text-sm font-mono font-bold">{(p.totalUserBalanceTzs || 0).toLocaleString()}</div><div className="text-[9px] text-[var(--muted)]">user bal TZS</div></div>
                      <span className="text-[var(--muted)] text-xs font-mono">{open ? "▾" : "▸"}</span>
                    </button>

                    {/* Expanded: webhook + users */}
                    {open && (
                      <div className="border-t border-[var(--card-border)] p-4 space-y-3">
                        <div className="text-[11px] font-mono text-[var(--muted)] flex flex-wrap gap-x-6 gap-y-1">
                          <span>Webhook: {p.webhookUrl ? <span className="text-[var(--foreground)]">{p.webhookUrl}</span> : "—"}</span>
                          <span>Rate: {p.rateLimit}/min</span>
                          <span>Joined: {new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        {p.users.length === 0 ? (
                          <p className="text-[11px] text-[var(--muted)]">No users yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs font-mono">
                              <thead>
                                <tr className="text-[var(--muted)] text-[10px] border-b border-[var(--card-border)]">
                                  <th className="text-left font-normal py-1.5">External ID</th>
                                  <th className="text-left font-normal py-1.5">Username</th>
                                  <th className="text-left font-normal py-1.5 hidden sm:table-cell">Contact</th>
                                  <th className="text-right font-normal py-1.5">Balance TZS</th>
                                  <th className="text-right font-normal py-1.5 hidden sm:table-cell">USDC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.users.map((u: AnyUser, i: number) => (
                                  <tr key={i} className="border-b border-[var(--card-border)]/40">
                                    <td className="py-1.5 text-[var(--muted)] max-w-[140px] truncate">{u.externalId}</td>
                                    <td className="py-1.5">{u.username || "—"}</td>
                                    <td className="py-1.5 text-[var(--muted)] hidden sm:table-cell max-w-[160px] truncate">{u.email || u.phone || "—"}</td>
                                    <td className="py-1.5 text-right tabular-nums">{(u.balanceTzs || 0).toLocaleString()}</td>
                                    <td className="py-1.5 text-right tabular-nums hidden sm:table-cell">{((u.balanceUsdc || 0) / 1_000_000).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {p.users.length >= 100 && <p className="text-[10px] text-[var(--muted)] mt-2">Showing first 100 users.</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── REFERRALS ── */}
        {tab === "referrals" && (
          <div className="space-y-4">
            {referrals === null ? (
              <p className="text-center text-[var(--muted)] text-xs py-8">Loading referrals…</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-mono text-[var(--muted)]">Reward = <span className="text-[var(--foreground)] font-bold">{formatTZS(referrals.rewardTzs)}</span> per referred user who onboards AND deposits (paid manually).</p>
                  <div className="flex items-center gap-2">
                    {retryRefMsg && <span className="text-[10px] font-mono text-[var(--muted)]">{retryRefMsg}</span>}
                    {referrals.summary.owedTzs > 0 && (
                      <button
                        onClick={handleRetryReferrals}
                        disabled={retryingRef}
                        className="px-3 py-1.5 text-[10px] font-mono font-bold border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 disabled:opacity-50 transition-colors"
                      >
                        {retryingRef ? "Paying…" : `Pay owed (${formatTZS(referrals.summary.owedTzs)})`}
                      </button>
                    )}
                  </div>
                </div>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Referred Users", value: referrals.summary.referredUsers.toLocaleString(), color: "text-[var(--accent)]" },
                    { label: "Deposited", value: referrals.summary.depositedCount.toLocaleString(), color: "text-blue-400" },
                    { label: "Paid Out", value: formatTZS(referrals.summary.paidTzs), color: "text-[#00e5a0]" },
                    { label: "Owed", value: formatTZS(referrals.summary.owedTzs), color: "text-orange-400" },
                  ].map(k => (
                    <div key={k.label} className="p-4 bg-[var(--card)] border border-[var(--card-border)]">
                      <p className="text-[9px] text-[var(--muted)] uppercase tracking-wider mb-1">{k.label}</p>
                      <p className={`text-lg font-black tabular-nums ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Top referrers */}
                <div className="border border-[var(--card-border)] bg-[var(--card)]">
                  <div className="px-4 py-2 border-b border-[var(--card-border)] bg-[var(--background)]"><span className="text-[10px] font-mono text-[var(--muted)] uppercase">Top Referrers</span></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-[var(--muted)] text-[10px] border-b border-[var(--card-border)]">
                          <th className="text-left font-normal px-4 py-2">User</th>
                          <th className="text-right font-normal px-4 py-2">Referred</th>
                          <th className="text-right font-normal px-4 py-2">Deposited</th>
                          <th className="text-right font-normal px-4 py-2">Paid</th>
                          <th className="text-right font-normal px-4 py-2">Owed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {referrals.topReferrers.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--card-border)]/40">
                            <td className="px-4 py-2">@{r.username}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{r.referrals}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{r.deposited}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-[#00e5a0]">{formatTZS(r.paid)}</td>
                            <td className={`px-4 py-2 text-right tabular-nums ${r.owed > 0 ? "text-orange-400" : "text-[var(--muted)]"}`}>{formatTZS(r.owed)}</td>
                          </tr>
                        ))}
                        {referrals.topReferrers.length === 0 && <tr><td colSpan={5} className="text-center text-[var(--muted)] py-6">No referrals yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Referred users — deposit status */}
                <div className="border border-[var(--card-border)] bg-[var(--card)]">
                  <div className="px-4 py-2 border-b border-[var(--card-border)] bg-[var(--background)]"><span className="text-[10px] font-mono text-[var(--muted)] uppercase">Referred Users · Deposit Status</span></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-[var(--muted)] text-[10px] border-b border-[var(--card-border)]">
                          <th className="text-left font-normal px-4 py-2">Referrer → Referred</th>
                          <th className="text-right font-normal px-4 py-2">Deposited</th>
                          <th className="text-right font-normal px-4 py-2">Amount</th>
                          <th className="text-right font-normal px-4 py-2">Reward</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {referrals.referredUsers.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--card-border)]/40">
                            <td className="px-4 py-2">@{r.referrer} <span className="text-[var(--muted)]">→</span> @{r.referred}</td>
                            <td className={`px-4 py-2 text-right ${r.deposited ? "text-[#00e5a0]" : "text-[var(--muted)]"}`}>{r.deposited ? "yes" : "no"}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{r.deposited ? formatTZS(r.depositedTzs) : "—"}</td>
                            <td className={`px-4 py-2 text-right tabular-nums ${r.rewardStatus === "COMPLETED" ? "text-[#00e5a0]" : r.rewardStatus ? "text-orange-400" : "text-[var(--muted)]"}`}>
                              {r.rewardStatus ? `${formatTZS(r.rewardTzs)} ${r.rewardStatus === "COMPLETED" ? "paid" : "owed"}` : "—"}
                            </td>
                          </tr>
                        ))}
                        {referrals.referredUsers.length === 0 && <tr><td colSpan={4} className="text-center text-[var(--muted)] py-6">No referred users yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TOOLS ── */}
        {/* ── CASHFLOW: deposits & withdrawals mapped to users ── */}
        {tab === "cashflow" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Deposit / Withdrawal toggle */}
              <div className="inline-flex border border-[var(--card-border)] rounded-lg overflow-hidden">
                {(["deposit", "withdrawal"] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => setCashKind(k)}
                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      cashKind === k ? "bg-[var(--accent)] text-black" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {k === "deposit" ? "Deposits" : "Withdrawals"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search username, phone, or nTZS ID…"
                value={cashSearch}
                onChange={(e) => setCashSearch(e.target.value)}
                className="flex-1 min-w-[220px] max-w-md px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50 rounded-lg"
              />
              {cashflow && (
                <span className="text-[11px] font-mono text-[var(--muted)] ml-auto">
                  {cashKind === "deposit" ? "Total deposited" : "Total withdrawn"}:{" "}
                  <span className={cashKind === "deposit" ? "text-[#00e5a0] font-bold" : "text-red-400 font-bold"}>
                    {formatTZS(cashflow.totalCompletedTzs)}
                  </span>{" "}
                  · {cashflow.count} {cashKind}s
                </span>
              )}
            </div>

            <div className="overflow-x-auto border border-[var(--card-border)] rounded-lg">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--card-border)] bg-[var(--background)]">
                    {["User", "Amount", "Status", "nTZS ID", "Payer Phone", "Date (EAT)"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[9px] text-[var(--muted)] uppercase tracking-wider font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashLoading ? (
                    <tr><td colSpan={6} className="text-center text-[var(--muted)] py-8">Loading…</td></tr>
                  ) : (cashflow?.items.length || 0) === 0 ? (
                    <tr><td colSpan={6} className="text-center text-[var(--muted)] py-8">No {cashKind}s found</td></tr>
                  ) : cashflow!.items.map(it => (
                    <tr key={it.id} className="border-b border-[var(--card-border)]/40 hover:bg-[var(--card)]">
                      <td className="px-3 py-2 font-bold text-[var(--accent)]" title={it.email}>@{it.username}</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-right">{formatTZS(it.amountTzs)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                          it.status === "COMPLETED" ? "text-[#00e5a0] border-[#00e5a0]/30 bg-[#00e5a0]/10"
                          : it.status === "PENDING" ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
                          : "text-red-400 border-red-400/30 bg-red-400/10"
                        }`}>{it.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--muted)]" title={it.ntzsId || ""}>{it.ntzsId ? `${it.ntzsId.slice(0, 10)}…` : "—"}</td>
                      <td className="px-3 py-2 font-mono text-[var(--muted)]">{it.phone || "—"}</td>
                      <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap">{new Date(it.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] font-mono text-[var(--muted)]">
              The <span className="text-[var(--foreground)]">nTZS ID</span> matches the &quot;ID&quot; column on the nTZS dashboard — paste it into search to find who a dashboard row belongs to. Payer phone is the number that paid (may differ from the user&apos;s registered phone).
            </p>
          </div>
        )}

        {tab === "tools" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Balance Audit — verify a user's balance against their ledger */}
            <div className="space-y-4 lg:col-span-2">
              <div className="border border-[var(--card-border)] bg-[var(--card)]">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--card-border)] bg-[var(--background)]">
                  <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500/70"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70"/><div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]/70"/></div>
                  <span className="text-[10px] font-mono text-[var(--muted)]">admin::audit_balance.sh</span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-[11px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider">Balance Audit</p>
                  <p className="text-[10px] font-mono text-[var(--muted)]">Verify a user&apos;s stored balance against their transaction ledger (credits − debits).</p>
                  <div className="flex gap-2">
                    <input
                      value={auditUser}
                      onChange={(e) => setAuditUser(e.target.value)}
                      placeholder="username or email"
                      className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-xs font-mono focus:border-[var(--accent)] outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!auditUser.trim()) return;
                        setAuditing(true); setAuditResult(null);
                        try {
                          const res = await fetch(`/api/admin/audit-balance?username=${encodeURIComponent(auditUser.trim())}`);
                          const d = await res.json();
                          setAuditResult(res.ok ? d : { error: d.error || "Failed" });
                        } catch { setAuditResult({ error: "Network error" }); }
                        finally { setAuditing(false); }
                      }}
                      disabled={auditing || !auditUser.trim()}
                      className="px-4 py-2 text-[10px] font-mono font-bold border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50 transition-colors"
                    >
                      {auditing ? "…" : "Audit"}
                    </button>
                  </div>
                  {auditResult && (auditResult.error ? (
                    <p className="text-[11px] font-mono text-red-400">❌ {auditResult.error}</p>
                  ) : (
                    <div className="space-y-2 text-[11px] font-mono">
                      <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <span>@{auditResult.username}</span>
                        <span className="text-[var(--muted)]">Stored: <span className="font-bold text-[var(--foreground)]">{formatTZS(auditResult.storedTzs)}</span></span>
                        <span className="text-[var(--muted)]">Ledger: <span className="font-bold text-[var(--foreground)]">{formatTZS(auditResult.computedTzs)}</span></span>
                        <span className={auditResult.match ? "text-[#00e5a0] font-bold" : "text-red-400 font-bold"}>{auditResult.match ? "✓ matches" : "✗ MISMATCH"}</span>
                        {auditResult.rawComputed < 0 && <span className="text-yellow-500">(raw {formatTZS(auditResult.rawComputed)} — spent phantom funds)</span>}
                      </div>
                      <table className="w-full text-[10px]">
                        <thead><tr className="text-[var(--muted)] border-b border-[var(--card-border)]"><th className="text-left font-normal py-1">Type</th><th className="text-right font-normal py-1">Count</th><th className="text-right font-normal py-1">Total</th><th className="text-right font-normal py-1">Dir</th></tr></thead>
                        <tbody>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {auditResult.breakdown.map((b: any, i: number) => (
                            <tr key={i} className="border-b border-[var(--card-border)]/40">
                              <td className="py-1">{b.type}</td>
                              <td className="py-1 text-right">{b.count}</td>
                              <td className="py-1 text-right tabular-nums">{formatTZS(b.total)}</td>
                              <td className={`py-1 text-right ${b.direction === "credit" ? "text-[#00e5a0]" : b.direction === "debit" ? "text-red-400" : "text-[var(--muted)]"}`}>{b.direction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
                    { label: "Reconcile All Balances", desc: "Recalculate balanceTzs from tx history", action: () => handleReconcile(), loading: reconciling, msg: reconcileMsg, color: "border-orange-500/40 text-orange-400 hover:bg-orange-500/10" },
                    { label: "Preview due Pyth (dry run)", desc: "Show what WOULD resolve — live price vs target, no settling", action: () => handleResolvePyth(true), loading: resolvingPyth, msg: resolvePythMsg, color: "border-[var(--card-border)] text-[var(--muted)] hover:bg-[var(--card)]" },
                    { label: "Resolve due Pyth now", desc: "Settle expired gold/FX/commodity markets from live Pyth prices", action: () => handleResolvePyth(false), loading: resolvingPyth, msg: resolvePythMsg, color: "border-[#00b4d8]/40 text-[#00b4d8] hover:bg-[#00b4d8]/10" },
                    { label: "Backfill fixed-odds payouts", desc: "Set locked-in payouts on legacy open positions (shares × 0.95)", action: () => handleBackfillImplied(), loading: backfilling, msg: backfillMsg, color: "border-purple-500/40 text-purple-400 hover:bg-purple-500/10" },
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
