"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass, Wrench, CheckCircle, WarningCircle,
  ArrowRight, Terminal, XCircle, Spinner,
} from "@phosphor-icons/react";

interface Diagnosis {
  market: {
    id: string;
    title: string;
    status: string;
    outcomeLabel: string;
    seedAmount: number;
    totalVolume: number;
  };
  creatorPosition: {
    id: string;
    redeemed: boolean;
    yesShares: number;
    noShares: number;
    optionShares?: Record<string, number> | null;
  } | null;
  lpRedeemTransaction: { id: string } | null;
  diagnosis: {
    hasPosition: boolean;
    positionRedeemed: boolean | null;
    hasLpRedeemTx: boolean;
    creatorWinShares: number;
    totalWinShares: number;
    netPayout: number;
    stuck: boolean;
  };
}

type Status = "idle" | "diagnosing" | "repairing" | "done" | "error";

export default function LpRepairPage() {
  const [marketId, setMarketId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [repairResult, setRepairResult] = useState<{ payoutTzs?: number; note?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleDiagnose() {
    if (!marketId.trim()) return;
    setStatus("diagnosing");
    setDiagnosis(null);
    setRepairResult(null);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/lp-repair?marketId=${marketId.trim()}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Diagnosis failed");
        setStatus("error");
        return;
      }
      setDiagnosis(data);
      setStatus("idle");
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }
  }

  async function handleRepair() {
    if (!diagnosis) return;
    setStatus("repairing");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/lp-repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: diagnosis.market.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Repair failed");
        setStatus("error");
        return;
      }
      setRepairResult(data);
      setStatus("done");
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }
  }

  const d = diagnosis?.diagnosis;
  const isStuck = d?.stuck || (d?.hasPosition && d?.positionRedeemed && !d?.hasLpRedeemTx);
  const canRepair = diagnosis && diagnosis.market.status === "RESOLVED" && isStuck && status !== "repairing";

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)] bg-[var(--background)]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27ca40]" />
            <span className="ml-2 text-[10px] font-mono text-[var(--muted)]">admin::lp_repair.sh</span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Terminal size={20} className="text-[var(--accent)]" />
              <h1 className="text-lg font-mono font-bold text-[var(--foreground)]">LP Repair Tool</h1>
            </div>
            <p className="text-xs font-mono text-[var(--muted)]">
              Diagnose and manually repair stuck creator LP positions after market resolution.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 space-y-3">
          <label className="block text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">
            $ enter market ID
          </label>
          <div className="flex gap-2">
            <input
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDiagnose()}
              placeholder="cmoy0hujl000204kzusdmfgma"
              className="flex-1 px-3 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={handleDiagnose}
              disabled={status === "diagnosing" || !marketId.trim()}
              className="flex items-center gap-2 px-4 py-2.5 border border-[var(--accent)] text-[var(--accent)] font-mono text-xs uppercase tracking-wider hover:bg-[var(--accent)]/10 disabled:opacity-40 transition-all rounded-lg"
            >
              {status === "diagnosing"
                ? <Spinner size={14} className="animate-spin" />
                : <MagnifyingGlass size={14} />}
              {status === "diagnosing" ? "Scanning..." : "Diagnose"}
            </button>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {status === "error" && errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
            >
              <XCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm font-mono text-red-400">{errorMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diagnosis Result */}
        <AnimatePresence>
          {diagnosis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden"
            >
              {/* Terminal header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--card-border)] bg-[var(--background)]">
                <span className="text-[10px] font-mono text-[var(--muted)]">diagnosis.output</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isStuck
                    ? "bg-red-500/10 text-red-400"
                    : d?.hasLpRedeemTx
                      ? "bg-green-500/10 text-green-400"
                      : "bg-yellow-500/10 text-yellow-400"
                }`}>
                  {isStuck ? "⚠ STUCK" : d?.hasLpRedeemTx ? "✓ HEALTHY" : "? UNKNOWN"}
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* Market info */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Market</p>
                  <p className="font-mono font-bold text-[var(--foreground)] text-sm">{diagnosis.market.title}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--card-border)] text-[var(--muted)]">
                      {diagnosis.market.status}
                    </span>
                    {diagnosis.market.outcomeLabel && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]">
                        Outcome: {diagnosis.market.outcomeLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid of stats */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Seed Amount", value: `${diagnosis.market.seedAmount?.toLocaleString() ?? 0} TZS` },
                    { label: "Total Volume", value: `${diagnosis.market.totalVolume?.toLocaleString() ?? 0} TZS` },
                    { label: "Creator Win Shares", value: d?.creatorWinShares?.toLocaleString() ?? "0" },
                    { label: "Total Win Shares", value: d?.totalWinShares?.toLocaleString() ?? "0" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-3">
                      <p className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-widest mb-1">{label}</p>
                      <p className="text-sm font-mono font-bold text-[var(--foreground)]">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Net payout */}
                <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Net Payout to Creator</span>
                  <span className="font-mono font-bold text-[var(--accent)] text-lg">
                    {d?.netPayout?.toLocaleString() ?? 0} TZS
                  </span>
                </div>

                {/* Status checks */}
                <div className="space-y-1.5">
                  {[
                    { label: "Has creator position", ok: d?.hasPosition },
                    { label: "Position marked redeemed", ok: d?.positionRedeemed },
                    { label: "LP_REDEEM transaction exists", ok: d?.hasLpRedeemTx },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle size={14} className="text-green-400 shrink-0" />
                        : <XCircle size={14} className="text-red-400 shrink-0" />}
                      <span className={`text-xs font-mono ${ok ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Stuck explanation */}
                {isStuck && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                    <WarningCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-xs font-mono text-yellow-300">
                      Position is locked as redeemed but no LP_REDEEM transaction found.
                      The nTZS transfer failed after the position was marked. Click Repair to re-send funds.
                    </p>
                  </div>
                )}

                {!isStuck && d?.hasLpRedeemTx && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                    <p className="text-xs font-mono text-green-300">
                      LP already redeemed successfully. No action needed.
                    </p>
                  </div>
                )}

                {/* Repair button */}
                {canRepair && status !== "done" && (
                  <button
                    onClick={handleRepair}
                    disabled={status === "repairing"}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--accent)] text-[var(--background)] font-mono font-bold text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-all rounded-lg"
                  >
                    {status === "repairing"
                      ? <><Spinner size={16} className="animate-spin" /> Sending Transfer...</>
                      : <><Wrench size={16} /> Repair — Send {d?.netPayout?.toLocaleString()} TZS</>}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Repair success */}
        <AnimatePresence>
          {status === "done" && repairResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--card)] border-2 border-[var(--accent)]/60 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,229,160,0.15)]"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--accent)]/20 bg-[var(--accent)]/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[var(--accent)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--accent)]/50" />
                  <div className="w-3 h-3 rounded-full bg-[var(--accent)]/30" />
                </div>
                <span className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider ml-2">
                  REPAIR.SUCCESS
                </span>
              </div>
              <div className="p-6 text-center space-y-3">
                <CheckCircle size={40} weight="fill" className="text-[var(--accent)] mx-auto" />
                <div>
                  <p className="font-mono font-bold text-[var(--foreground)]">Transfer Sent!</p>
                  {repairResult.note
                    ? <p className="text-xs font-mono text-[var(--muted)] mt-1">{repairResult.note}</p>
                    : <p className="text-[var(--accent)] font-mono font-bold text-xl mt-2">
                        {repairResult.payoutTzs?.toLocaleString()} TZS
                      </p>
                  }
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-[var(--muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  nTZS transfer confirmed + balance credited
                </div>
                <button
                  onClick={() => {
                    setStatus("idle");
                    setDiagnosis(null);
                    setRepairResult(null);
                    setMarketId("");
                  }}
                  className="w-full py-2.5 border border-[var(--card-border)] text-[var(--muted)] font-mono text-xs uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all rounded-lg flex items-center justify-center gap-2"
                >
                  <ArrowRight size={14} /> Repair Another Market
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
