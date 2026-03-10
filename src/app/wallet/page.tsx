"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft, ArrowUpRight, Clock, CheckCircle,
  XCircle, Copy, Check, ArrowsClockwise,
  CurrencyCircleDollar, SmileySad, PaperPlaneRight,
} from "@phosphor-icons/react";

interface Transaction {
  id: string;
  type: string;
  amountTzs: number;
  status: string;
  phone?: string | null;
  ntzsDepositId?: string | null;
  recipientUsername?: string | null;
  createdAt: string;
}

const QUICK_AMOUNTS = [5000, 10000, 50000, 100000];

export default function WalletPage() {
  const { user, fetchUser } = useUser();
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"deposit" | "withdraw" | "send">("deposit");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [recipient, setRecipient] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  const fetchTransactions = useCallback(async () => {
    const res = await fetch("/api/wallet/transactions");
    const data = await res.json();
    setTransactions(data.transactions || []);
    return data.transactions || [];
  }, []);

  const syncStatus = useCallback(async (quiet = false) => {
    if (!quiet) setSyncing(true);
    try {
      const res = await fetch("/api/wallet/sync");
      const data = await res.json();
      setTransactions(data.transactions || []);
      // If any got updated, refresh balance
      if (data.updated > 0) {
        await fetchUser();
      }
      return data.transactions || [];
    } finally {
      if (!quiet) setSyncing(false);
    }
  }, [fetchUser]);

  // Initial load
  useEffect(() => {
    fetchTransactions().finally(() => setLoading(false));
  }, [fetchTransactions]);

  // Auto-poll while any transaction is PENDING
  useEffect(() => {
    const hasPending = transactions.some((tx) => tx.status === "PENDING");
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(() => syncStatus(true), 4000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [transactions, syncStatus]);

  async function handleAction(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setMessage(null);
    try {
      const endpoint = tab === "deposit" ? "/api/wallet/deposit" : tab === "withdraw" ? "/api/wallet/withdraw" : "/api/wallet/send";
      const body = tab === "send" 
        ? { amountTzs: Number(amount), recipientUsername: recipient }
        : { amountTzs: Number(amount), phone };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed. Please try again." });
      } else {
        setMessage({
          type: "success",
          text: tab === "deposit"
            ? `✅ ${t.wallet.depositSuccess}`
            : tab === "withdraw"
            ? `⏳ ${t.wallet.withdrawSuccess}`
            : `✅ Transfer successful!`,
        });
        setAmount("");
        setRecipient("");
        // Refresh immediately, then poll
        await fetchTransactions();
        await fetchUser();
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please check your connection." });
    } finally {
      setActionLoading(false);
    }
  }

  function copyAddress() {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <CurrencyCircleDollar size={48} className="text-[var(--muted)]" weight="duotone" />
          <p className="text-[var(--muted)]">{t.wallet.signInToView}</p>
          <Link href="/auth/login" className="px-6 py-2.5 bg-[var(--accent)] text-black rounded-xl font-semibold text-sm">
            {t.nav.signIn}
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = transactions.filter((tx) => tx.status === "PENDING").length;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black">{t.wallet.title}</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">{t.wallet.subtitle}</p>
          </div>
          <button
            onClick={() => syncStatus()}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[var(--card-border)] rounded-xl hover:bg-[var(--card)] transition-colors text-[var(--muted)] disabled:opacity-50"
          >
            <ArrowsClockwise size={14} className={cn(syncing && "animate-spin")} />
            {syncing ? `${t.wallet.sync}...` : t.wallet.sync}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left column ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Balance card */}
            <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-[#00e5a0]/20 via-[#00c896]/10 to-[#00b4d8]/15 border border-[var(--accent)]/25">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[var(--accent)]/10 blur-2xl pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <CurrencyCircleDollar size={20} className="text-[var(--accent)]" weight="fill" />
                  <span className="text-sm font-semibold">nTZS Balance</span>
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 animate-pulse">
                      <Clock size={10} weight="fill" />
                      {pendingCount}
                    </span>
                  )}
                </div>
                <div className="text-4xl font-black mb-0.5 tabular-nums">
                  {formatTZS(user.balanceTzs || 0)}
                </div>
                <p className="text-xs text-[var(--muted)]">{t.wallet.tanzanianShillings}</p>

                {user.walletAddress && (
                  <button
                    onClick={copyAddress}
                    className="mt-4 w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-[var(--background)]/60 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]/30 transition-colors group"
                  >
                    <span className="text-xs font-mono text-[var(--muted)] truncate">
                      {user.walletAddress}
                    </span>
                    {copied
                      ? <Check size={14} className="text-[var(--accent)] shrink-0" weight="bold" />
                      : <Copy size={14} className="text-[var(--muted)] shrink-0 group-hover:text-[var(--foreground)]" />}
                  </button>
                )}
              </div>
            </div>

            {/* Deposit / Withdraw panel */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
              {/* Tabs */}
              <div className="flex">
                {(["deposit", "withdraw", "send"] as const).map((tb) => (
                  <button
                    key={tb}
                    onClick={() => { setTab(tb); setMessage(null); }}
                    className={cn(
                      "flex-1 py-3.5 text-sm font-semibold capitalize transition-all flex items-center justify-center gap-2",
                      tab === tb
                        ? "bg-[var(--background)] text-[var(--foreground)] border-b-2 border-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {tb === "deposit"
                      ? <ArrowDownLeft size={16} weight="bold" className="text-[var(--accent)]" />
                      : tb === "withdraw"
                      ? <ArrowUpRight size={16} weight="bold" className="text-red-400" />
                      : <ArrowUpRight size={16} weight="bold" className="text-blue-400" />}
                    {tb === "deposit" ? t.wallet.deposit : tb === "withdraw" ? t.wallet.withdraw : t.wallet.send}
                  </button>
                ))}
              </div>

              <div className="p-5">
                <p className="text-xs text-[var(--muted)] mb-4 leading-relaxed">
                  {tab === "deposit"
                    ? t.wallet.depositDescription
                    : tab === "withdraw"
                    ? t.wallet.withdrawDescription
                    : t.wallet.sendDescription}
                </p>

                <AnimatePresence mode="wait">
                  {message && (
                    <motion.div
                      key={message.text}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        "mb-4 p-3.5 rounded-xl text-sm leading-relaxed",
                        message.type === "success"
                          ? "bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)]"
                          : "bg-red-500/10 border border-red-500/20 text-red-400"
                      )}
                    >
                      {message.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleAction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wide">
                      {t.wallet.amount}
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors font-medium"
                      placeholder="e.g. 10,000"
                      min="1000"
                      required
                    />
                  </div>

                  {/* Quick select */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAmount(String(a))}
                        className={cn(
                          "py-2 text-xs font-semibold rounded-lg border transition-all",
                          amount === String(a)
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                            : "border-[var(--card-border)] hover:border-[var(--accent)]/40 text-[var(--muted)]"
                        )}
                      >
                        {a >= 1000 ? `${a / 1000}K` : a}
                      </button>
                    ))}
                  </div>

                  {tab === "send" ? (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wide">
                        {t.wallet.recipient}
                      </label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                        placeholder="username"
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wide">
                        {t.wallet.phone}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                        placeholder="255712345678"
                        required
                      />
                      <p className="text-xs text-[var(--muted)] mt-1">{t.wallet.phoneFormat}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={actionLoading || !amount || Number(amount) < 1000 || (tab === "send" && !recipient)}
                    className={cn(
                      "w-full py-3.5 font-black rounded-xl transition-all disabled:opacity-40 text-sm flex items-center justify-center gap-2",
                      tab === "deposit"
                        ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                        : tab === "withdraw"
                        ? "bg-red-500 text-white hover:opacity-90"
                        : "bg-blue-500 text-white hover:opacity-90"
                    )}
                  >
                    {tab === "deposit"
                      ? <ArrowDownLeft size={16} weight="bold" />
                      : <ArrowUpRight size={16} weight="bold" />}
                    {actionLoading
                      ? t.wallet.processing
                      : tab === "deposit"
                      ? t.wallet.depositButton
                      : tab === "withdraw"
                      ? t.wallet.withdrawButton
                      : t.wallet.sendButton}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* ── Right: Transaction history ─────────────── */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-base">{t.wallet.transactions}</h2>
              {pendingCount > 0 && (
                <span className="text-xs text-[var(--muted)] animate-pulse">
                  {t.wallet.autoUpdating}
                </span>
              )}
            </div>

            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
              {loading ? (
                <div className="space-y-px p-1">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-14 bg-[var(--background)] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--muted)]">
                  <SmileySad size={40} weight="duotone" className="opacity-30" />
                  <p className="text-sm">{t.wallet.noTransactions}</p>
                  <p className="text-xs opacity-60">{tab === "deposit" ? t.wallet.depositDescription : ""}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--card-border)]">
                  {transactions.map((tx, i) => (
                    <TxRow key={tx.id} tx={tx} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TxRow({ tx, index }: { tx: Transaction; index: number }) {
  const { t, locale } = useLanguage();
  const isDeposit = tx.type === "DEPOSIT";
  const isSend = tx.type === "SEND";
  const isReceive = tx.type === "RECEIVE";
  const isWithdraw = tx.type === "WITHDRAW";

  const statusConfig = {
    COMPLETED: { icon: <CheckCircle size={13} weight="fill" className="text-[var(--accent)]" />, label: locale === "sw" ? "Imethibitishwa" : "Confirmed", color: "text-[var(--accent)]" },
    FAILED: { icon: <XCircle size={13} weight="fill" className="text-red-400" />, label: locale === "sw" ? "Imeshindwa" : "Failed", color: "text-red-400" },
    PENDING: { icon: <Clock size={13} weight="fill" className="text-yellow-400 animate-pulse" />, label: locale === "sw" ? "Inasubiri" : "Pending", color: "text-yellow-400" },
  }[tx.status] ?? { icon: <Clock size={13} />, label: tx.status, color: "text-[var(--muted)]" };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center justify-between px-5 py-4 hover:bg-[var(--background)]/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          isDeposit || isReceive ? "bg-[var(--accent)]/10" : isSend ? "bg-blue-500/10" : "bg-red-500/10"
        )}>
          {isDeposit || isReceive
            ? <ArrowDownLeft size={18} weight="bold" className="text-[var(--accent)]" />
            : isSend
            ? <PaperPlaneRight size={18} weight="bold" className="text-blue-400" />
            : <ArrowUpRight size={18} weight="bold" className="text-red-400" />}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {isDeposit ? t.wallet.deposit : isReceive ? (locale === "sw" ? "Pokea" : "Receive") : isSend ? t.wallet.send : t.wallet.withdraw}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {new Date(tx.createdAt).toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-TZ", { day: "2-digit", month: "short", year: "numeric" })}
            {tx.phone && <span className="ml-1.5 opacity-70">· {tx.phone}</span>}
            {isSend && tx.recipientUsername && <span className="ml-1.5 opacity-70">→ @{tx.recipientUsername}</span>}
            {isReceive && tx.recipientUsername && <span className="ml-1.5 opacity-70">← @{tx.recipientUsername}</span>}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className={cn("font-black text-sm tabular-nums", isDeposit || isReceive ? "text-[var(--accent)]" : isSend ? "text-blue-400" : "text-red-400")}>
          {isDeposit || isReceive ? "+" : "−"}{formatTZS(tx.amountTzs)}
        </p>
        <div className={cn("flex items-center gap-1 justify-end text-xs font-medium mt-0.5", statusConfig.color)}>
          {statusConfig.icon}
          {statusConfig.label}
        </div>
      </div>
    </motion.div>
  );
}
