"use client";
import { useEffect, useState, use } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { formatTZS, formatNumber, timeUntil } from "@/lib/utils";
import { getSharesOut } from "@/lib/amm";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Clock, TrendUp, UsersThree, ChatCircle,
  CheckCircle, XCircle, Warning, PaperPlaneTilt,
  ShareNetwork, WhatsappLogo, XLogo, FacebookLogo, TelegramLogo,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface MarketData {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  resolvesAt: string;
  status: string;
  outcome?: number | null;
  creatorId: string;
  price: { yes: number; no: number };
  creator: { username: string; displayName?: string | null };
  _count: { trades: number; comments: number };
  trades: { id: string; side: string; amountTzs: number; shares: number; price: number; createdAt: string; user: { username: string } }[];
  comments: { id: string; body: string; createdAt: string; user: { username: string; avatarUrl?: string | null } }[];
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, fetchUser } = useUser();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trades" | "comments">("trades");

  // Trade state
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");
  const [tradeSuccess, setTradeSuccess] = useState("");

  // Comment state
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  async function loadMarket() {
    const res = await fetch(`/api/markets/${id}`);
    const data = await res.json();
    setMarket(data.market);
    setLoading(false);
  }

  useEffect(() => { loadMarket(); }, [id]);

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setTradeLoading(true);
    setTradeError("");
    setTradeSuccess("");
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: id, side, amountTzs: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTradeError(data.error || "Trade failed");
      } else {
        setTradeSuccess(`Got ${Math.round(data.shares)} ${side} shares!`);
        setAmount("");
        await loadMarket();
        fetchUser();
        setTimeout(() => setTradeSuccess(""), 4000);
      }
    } catch {
      setTradeError("Network error");
    } finally {
      setTradeLoading(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !user) return;
    setCommentLoading(true);
    try {
      await fetch(`/api/markets/${id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment }),
      });
      setComment("");
      await loadMarket();
    } finally {
      setCommentLoading(false);
    }
  }

  async function handleResolve(outcome: boolean) {
    if (!confirm(`Resolve as ${outcome ? "YES" : "NO"}?`)) return;
    await fetch(`/api/markets/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    loadMarket();
  }

  // Estimate shares for current input
  let estimatedShares = 0;
  let estimatedPrice = 0;
  if (market && amount && Number(amount) >= 100) {
    try {
      const result =
        side === "YES"
          ? getSharesOut(Number(amount), market.noPool, market.yesPool)
          : getSharesOut(Number(amount), market.yesPool, market.noPool);
      estimatedShares = Math.round(result.shares);
      estimatedPrice = result.avgPrice;
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="h-8 w-64 bg-[var(--card)] rounded-lg animate-pulse mb-4" />
          <div className="h-4 w-96 bg-[var(--card)] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-32 text-[var(--muted)]">Market not found</div>
      </div>
    );
  }

  const yesPct = Math.round(market.price.yes * 100);
  const noPct = 100 - yesPct;
  const isResolved = market.status === "RESOLVED";

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Market info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
              {market.imageUrl && (
                <Image src={market.imageUrl!} alt={market.title} width={800} height={192} className="w-full h-48 object-cover" />
              )}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-xs rounded-full border border-[var(--accent)]/20">
                    {market.category}
                  </span>
                  {isResolved && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20">
                      Resolved: {market.outcome === 1 ? "YES" : "NO"}
                    </span>
                  )}
                  {!isResolved && (
                    <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Clock size={11} />
                      {timeUntil(market.resolvesAt)}
                    </span>
                  )}
                </div>
                <h1 className="text-xl md:text-2xl font-bold mb-3">{market.title}</h1>
                <p className="text-[var(--muted)] text-sm leading-relaxed">{market.description}</p>

                <div className="flex items-center gap-4 mt-4 text-xs text-[var(--muted)]">
                  <span>by @{market.creator.username}</span>
                  <span className="flex items-center gap-1">
                    <TrendUp size={11} />
                    Vol: {formatTZS(market.totalVolume)}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersThree size={11} />
                    {market._count.trades} trades
                  </span>
                </div>

                {/* Share buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--card-border)]">
                  <span className="flex items-center gap-1 text-xs text-[var(--muted)] font-mono">
                    <ShareNetwork size={13} />
                    Share:
                  </span>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${market.title} - Predict now on GUAP! ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 border border-[var(--card-border)] text-[#25D366] hover:bg-[#25D366]/10 transition-all rounded"
                    title="Share on WhatsApp"
                  >
                    <WhatsappLogo size={16} weight="fill" />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${market.title} - Predict now on GUAP!`)}&url=${typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 border border-[var(--card-border)] text-[var(--foreground)] hover:bg-[var(--foreground)]/10 transition-all rounded"
                    title="Share on X"
                  >
                    <XLogo size={16} weight="fill" />
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 border border-[var(--card-border)] text-[#1877F2] hover:bg-[#1877F2]/10 transition-all rounded"
                    title="Share on Facebook"
                  >
                    <FacebookLogo size={16} weight="fill" />
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''}&text=${encodeURIComponent(market.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 border border-[var(--card-border)] text-[#0088cc] hover:bg-[#0088cc]/10 transition-all rounded"
                    title="Share on Telegram"
                  >
                    <TelegramLogo size={16} weight="fill" />
                  </a>
                </div>
              </div>
            </div>

            {/* Price bars */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6">
              <h2 className="font-semibold mb-4">Current Probability</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-bold text-[#00e5a0]">YES</span>
                    <span className="font-bold text-[#00e5a0]">{yesPct}%</span>
                  </div>
                  <div className="h-4 bg-[var(--background)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#00e5a0] to-[#00c896]"
                      initial={{ width: 0 }}
                      animate={{ width: `${yesPct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-bold text-red-400">NO</span>
                    <span className="font-bold text-red-400">{noPct}%</span>
                  </div>
                  <div className="h-4 bg-[var(--background)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${noPct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6 text-center text-sm">
                <div>
                  <div className="font-bold">{formatTZS(market.totalVolume)}</div>
                  <div className="text-xs text-[var(--muted)]">Volume</div>
                </div>
                <div>
                  <div className="font-bold">{market._count.trades}</div>
                  <div className="text-xs text-[var(--muted)]">Trades</div>
                </div>
                <div>
                  <div className="font-bold">{timeUntil(market.resolvesAt)}</div>
                  <div className="text-xs text-[var(--muted)]">Resolves</div>
                </div>
              </div>
            </div>

            {/* Creator resolve */}
            {user?.id === market.creatorId && !isResolved && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6">
                <h2 className="font-semibold mb-2 flex items-center gap-2">
                  <Warning size={16} className="text-yellow-500" />
                  Resolve Market (Creator only)
                </h2>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Once resolved, winners receive their payouts automatically.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#00e5a0]/10 border border-[#00e5a0]/30 text-[#00e5a0] rounded-xl font-semibold text-sm hover:bg-[#00e5a0]/20 transition-all"
                  >
                    <CheckCircle size={16} />
                    Resolve YES
                  </button>
                  <button
                    onClick={() => handleResolve(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-semibold text-sm hover:bg-red-500/20 transition-all"
                  >
                    <XCircle size={16} />
                    Resolve NO
                  </button>
                </div>
              </div>
            )}

            {/* Activity tabs */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
              <div className="flex border-b border-[var(--card-border)]">
                {(["trades", "comments"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex-1 py-3.5 text-sm font-medium capitalize transition-all",
                      tab === t
                        ? "text-[var(--foreground)] border-b-2 border-[var(--accent)]"
                        : "text-[var(--muted)]"
                    )}
                  >
                    {t === "trades" ? `Trades (${market._count.trades})` : `Comments (${market._count.comments})`}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {tab === "trades" ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {market.trades.length === 0 ? (
                      <p className="text-center text-[var(--muted)] text-sm py-8">No trades yet</p>
                    ) : (
                      market.trades.map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-2 text-sm border-b border-[var(--card-border)] last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-xs font-bold text-black">
                              {t.user.username[0].toUpperCase()}
                            </div>
                            <span className="font-medium">@{t.user.username}</span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-xs font-bold",
                                t.side === "YES" ? "yes-pill" : "no-pill"
                              )}
                            >
                              {t.side}
                            </span>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-medium">{formatTZS(t.amountTzs)}</div>
                            <div className="text-[var(--muted)]">{t.shares} shares @ {(t.price).toFixed(3)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {user && (
                      <form onSubmit={handleComment} className="flex gap-2">
                        <input
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Share your thoughts…"
                          className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={commentLoading || !comment.trim()}
                          className="p-2 bg-[var(--accent)] text-black rounded-xl disabled:opacity-50 hover:opacity-90 transition-all"
                        >
                          <PaperPlaneTilt size={16} />
                        </button>
                      </form>
                    )}
                    <div className="max-h-80 overflow-y-auto space-y-3">
                      {market.comments.length === 0 ? (
                        <p className="text-center text-[var(--muted)] text-sm py-8">No comments yet</p>
                      ) : (
                        market.comments.map((c) => (
                          <div key={c.id} className="flex gap-3 py-2 border-b border-[var(--card-border)] last:border-0">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
                              {c.user.username[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="font-medium text-sm mr-2">@{c.user.username}</span>
                              <span className="text-sm text-[var(--muted)]">{c.body}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Trade panel */}
          <div className="space-y-4">
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 sticky top-24">
              <h2 className="font-bold text-lg mb-4">Place a Trade</h2>

              {isResolved ? (
                <div className="text-center py-6 text-[var(--muted)]">
                  <CheckCircle size={32} className="mx-auto mb-2 text-[var(--accent)]" />
                  <p className="font-medium">Market Resolved</p>
                  <p className="text-sm mt-1">
                    Outcome: <strong className={market.outcome === 1 ? "text-[#00e5a0]" : "text-red-400"}>
                      {market.outcome === 1 ? "YES" : "NO"}
                    </strong>
                  </p>
                </div>
              ) : !user ? (
                <div className="text-center py-6">
                  <p className="text-[var(--muted)] mb-4 text-sm">Sign in to trade on this market</p>
                  <Link
                    href="/auth/login"
                    className="block py-3 bg-[var(--accent)] text-black font-bold rounded-xl hover:opacity-90 transition-all text-sm"
                  >
                    Sign in to trade
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleTrade} className="space-y-4">
                  {/* Side selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {(["YES", "NO"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSide(s)}
                        className={cn(
                          "py-3 rounded-xl font-bold text-sm transition-all",
                          side === s
                            ? s === "YES"
                              ? "bg-[#00e5a0] text-black"
                              : "bg-red-500 text-white"
                            : "bg-[var(--background)] border border-[var(--card-border)] text-[var(--muted)] hover:border-current"
                        )}
                      >
                        {s} {s === "YES" ? `${yesPct}%` : `${noPct}%`}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Amount (TZS)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                        placeholder="e.g. 5000"
                        min="100"
                        required
                      />
                    </div>
                    {/* Quick amounts */}
                    <div className="flex gap-2 mt-2">
                      {[1000, 5000, 10000, 50000].map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setAmount(String(a))}
                          className="flex-1 py-1 text-xs bg-[var(--background)] border border-[var(--card-border)] rounded-lg hover:border-[var(--accent)] transition-colors"
                        >
                          {a >= 1000 ? `${a / 1000}K` : a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estimate */}
                  {estimatedShares > 0 && (
                    <div className="p-3 bg-[var(--background)] rounded-xl text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Estimated shares</span>
                        <span className="font-bold">{formatNumber(estimatedShares)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Avg price</span>
                        <span className="font-medium">{estimatedPrice.toFixed(4)} TZS/share</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Max payout</span>
                        <span className="font-bold text-[var(--accent)]">{formatTZS(estimatedShares)}</span>
                      </div>
                    </div>
                  )}

                  {tradeError && (
                    <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2">
                      {tradeError}
                    </p>
                  )}

                  <AnimatePresence>
                    {tradeSuccess && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[#00e5a0] text-sm text-center bg-[#00e5a0]/10 border border-[#00e5a0]/20 rounded-xl py-2 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        {tradeSuccess}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={tradeLoading || !amount || Number(amount) < 100}
                    className={cn(
                      "w-full py-3.5 font-bold rounded-xl transition-all disabled:opacity-50 text-sm",
                      side === "YES"
                        ? "bg-[#00e5a0] text-black hover:opacity-90"
                        : "bg-red-500 text-white hover:opacity-90"
                    )}
                  >
                    {tradeLoading ? "Processing…" : `Buy ${side} shares`}
                  </button>

                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>Balance: {formatTZS(user.balanceTzs || 0)}</span>
                    <Link href="/wallet" className="text-[var(--accent)] hover:underline">
                      Add funds →
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
