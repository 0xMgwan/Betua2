"use client";
import { useEffect, useState, use, useRef } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS, formatNumber, timeUntil, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { getSharesOut, getMultiOptionSharesOut } from "@/lib/amm";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Clock, TrendUp, UsersThree, ChatCircle,
  CheckCircle, XCircle, Warning, PaperPlaneTilt,
  ShareNetwork, WhatsappLogo, XLogo, FacebookLogo, TelegramLogo,
  PencilSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { UserProfileModal } from "@/components/UserProfileModal";
import { Footer } from "@/components/Footer";
import { PriceChart } from "@/components/PriceChart";

interface MarketData {
  id: string;
  title: string;
  description: string;
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  totalVolume: number;
  yesPool: number;
  noPool: number;
  resolvesAt: string;
  status: string;
  outcome?: number | null;
  outcomeLabel?: string | null;
  creatorId: string;
  price: { yes: number; no: number };
  options?: string[] | null;
  optionPools?: number[] | null;
  optionPrices?: number[] | null;
  totalYesShares: number;
  totalNoShares: number;
  totalOptionShares: Record<string, number>;
  creator: { username: string; displayName?: string | null; avatarUrl?: string | null };
  _count: { trades: number; comments: number };
  trades: { id: string; side: string; amountTzs: number; shares: number; price: number; createdAt: string; user: { username: string; avatarUrl?: string | null } }[];
  comments: { id: string; body: string; createdAt: string; user: { username: string; avatarUrl?: string | null } }[];
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, fetchUser } = useUser();
  const { t, locale } = useLanguage();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trades" | "comments">("trades");

  // Trade state
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");
  const [tradeSuccess, setTradeSuccess] = useState("");

  // Comment state
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Profile modal state
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    resolvesAt: "",
    category: "",
    subCategory: "",
  });
  const [resolveConfirm, setResolveConfirm] = useState<string | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [editUploading, setEditUploading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  function handleEditFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
  }

  function clearEditImage() {
    setEditImageFile(null);
    setEditImagePreview("");
    setEditForm((f) => ({ ...f, imageUrl: "" }));
    if (editFileRef.current) editFileRef.current.value = "";
  }

  async function uploadEditImage(): Promise<string | null> {
    if (!editImageFile) return editForm.imageUrl || null;
    setEditUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", editImageFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data.url;
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Image upload failed");
      return null;
    } finally {
      setEditUploading(false);
    }
  }

  async function loadMarket() {
    const res = await fetch(`/api/markets/${id}`);
    const data = await res.json();
    setMarket(data.market);
    setLoading(false);
  }

  useEffect(() => { loadMarket(); }, [id]);

  const isMultiOption = !!(market?.options && market.options.length >= 2);

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setTradeLoading(true);
    setTradeError("");
    setTradeSuccess("");
    try {
      const tradeBody = isMultiOption
        ? { marketId: id, optionIndex: selectedOption, amountTzs: Number(amount) }
        : { marketId: id, side, amountTzs: Number(amount) };

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setTradeError(data.error || "Trade failed");
      } else {
        const label = isMultiOption ? market!.options![selectedOption] : side;
        setTradeSuccess(`Got ${Math.round(data.shares)} ${label} shares!`);
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
    const key = outcome ? "YES" : "NO";
    if (resolveConfirm !== key) { setResolveConfirm(key); return; }
    setResolveLoading(true);
    try {
      await fetch(`/api/markets/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      loadMarket();
    } finally {
      setResolveLoading(false);
      setResolveConfirm(null);
    }
  }

  async function handleResolveOption(optIdx: number) {
    if (!market?.options) return;
    const key = `opt-${optIdx}`;
    if (resolveConfirm !== key) { setResolveConfirm(key); return; }
    setResolveLoading(true);
    try {
      await fetch(`/api/markets/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex: optIdx }),
      });
      loadMarket();
    } finally {
      setResolveLoading(false);
      setResolveConfirm(null);
    }
  }

  function openEditModal() {
    if (!market) return;
    setEditForm({
      title: market.title,
      description: market.description,
      imageUrl: market.imageUrl || "",
      resolvesAt: new Date(market.resolvesAt).toISOString().slice(0, 16),
      category: market.category,
      subCategory: market.subCategory || "",
    });
    setEditImageFile(null);
    setEditImagePreview("");
    setShowEditModal(true);
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    try {
      let finalImageUrl = editForm.imageUrl;
      if (editImageFile) {
        const uploaded = await uploadEditImage();
        if (uploaded === null) { setEditLoading(false); return; }
        finalImageUrl = uploaded;
      }

      const res = await fetch(`/api/markets/${id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, imageUrl: finalImageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update market");
      } else {
        setShowEditModal(false);
        await loadMarket();
      }
    } catch {
      setEditError("Network error");
    } finally {
      setEditLoading(false);
    }
  }

  // Estimate shares for current input (matching trade API: 5% fee then AMM)
  const FEE_PERCENT = 0.05;
  let estimatedShares = 0;
  let estimatedPrice = 0;
  if (market && amount && Number(amount) >= 100) {
    try {
      const feeAmt = Math.round(Number(amount) * FEE_PERCENT);
      const tradeAmt = Number(amount) - feeAmt;
      if (isMultiOption && market.optionPools) {
        const result = getMultiOptionSharesOut(tradeAmt, selectedOption, market.optionPools);
        estimatedShares = Math.round(result.shares);
        estimatedPrice = result.avgPrice;
      } else {
        const result =
          side === "YES"
            ? getSharesOut(tradeAmt, market.noPool, market.yesPool)
            : getSharesOut(tradeAmt, market.yesPool, market.noPool);
        estimatedShares = Math.round(result.shares);
        estimatedPrice = result.avgPrice;
      }
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
        <div className="text-center py-32 text-[var(--muted)]">{locale === "sw" ? "Soko halijapatikana" : "Market not found"}</div>
      </div>
    );
  }

  const yesPctRaw = market.price.yes * 100;
  const noPctRaw = market.price.no * 100;
  const yesPct = yesPctRaw % 1 === 0 ? Math.round(yesPctRaw) : parseFloat(yesPctRaw.toFixed(1));
  const noPct = noPctRaw % 1 === 0 ? Math.round(noPctRaw) : parseFloat(noPctRaw.toFixed(1));
  const isResolved = market.status === "RESOLVED";

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* ═══ Left column: Header + Chart + Options + Activity ═══ */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">

            {/* ── Compact header: image + title + meta ── */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
              <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5">
                {market.imageUrl ? (
                  <Image
                    src={market.imageUrl!}
                    alt={market.title}
                    width={80}
                    height={80}
                    className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0 border border-[var(--card-border)]"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-lg bg-[var(--background)] border border-[var(--card-border)] flex-shrink-0 flex items-center justify-center">
                    <TrendUp size={24} className="text-[var(--muted)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-mono rounded border border-[var(--accent)]/20">
                      {market.category}
                    </span>
                    {market.subCategory && (
                      <span className="px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-mono rounded border border-[var(--accent)]/20 flex items-center gap-1">
                        {SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)?.icon.startsWith('/') ? (
                          <Image 
                            src={SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)!.icon} 
                            alt={market.subCategory} 
                            width={12} 
                            height={12} 
                            className="object-contain" 
                          />
                        ) : (
                          <span>{SPORTS_SUBCATEGORIES.find(s => s.value === market.subCategory)?.icon}</span>
                        )}
                        {market.subCategory}
                      </span>
                    )}
                    {isResolved && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-mono rounded border border-blue-500/20">
                        {t.market.resolved}: {isMultiOption ? market.outcomeLabel : (market.outcome === 1 ? t.market.yes : t.market.no)}
                      </span>
                    )}
                    {!isResolved && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--muted)] font-mono">
                        <Clock size={10} />
                        {timeUntil(market.resolvesAt)}
                      </span>
                    )}
                  </div>
                  <h1 className="text-base sm:text-xl font-bold leading-tight">{market.title}</h1>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--muted)] font-mono">
                    <span>@{market.creator.username}</span>
                    <span className="flex items-center gap-0.5">
                      <TrendUp size={10} />
                      {formatTZS(market.totalVolume)} vol
                    </span>
                    <span className="flex items-center gap-0.5">
                      <UsersThree size={10} />
                      {market._count.trades}
                    </span>
                  </div>
                </div>
                {/* Share icons */}
                <div className="flex gap-1 flex-shrink-0">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${market.title} - Predict now on GUAP! ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-1 text-[#25D366] hover:bg-[#25D366]/10 rounded transition-all"
                  >
                    <WhatsappLogo size={14} weight="fill" />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${market.title} - Predict now on GUAP!`)}&url=${typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-1 text-[var(--foreground)] hover:bg-[var(--foreground)]/10 rounded transition-all"
                  >
                    <XLogo size={14} weight="fill" />
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''}&text=${encodeURIComponent(market.title)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-1 text-[#0088cc] hover:bg-[#0088cc]/10 rounded transition-all"
                  >
                    <TelegramLogo size={14} weight="fill" />
                  </a>
                </div>
              </div>
            </div>

            {/* ── Price Chart (prominent, like Kalshi) ── */}
            <PriceChart marketId={id} className="rounded-xl" />

            {/* ── Volume + Stats bar ── */}
            <div className="flex items-center justify-between px-1 text-xs font-mono text-[var(--muted)]">
              <span>{formatTZS(market.totalVolume)} vol</span>
              <span>{market._count.trades} {t.market.trades}</span>
            </div>

            {/* ── Options / Chance table (like Kalshi's list below chart) ── */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--card-border)]">
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                  {isMultiOption ? "OPTIONS" : "OUTCOME"}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                  {locale === "sw" ? "NAFASI" : "CHANCE"}
                </span>
              </div>

              {isMultiOption && market.options && market.optionPrices ? (
                <div className="divide-y divide-[var(--card-border)]">
                  {market.options.map((opt, i) => {
                    const pct = Math.round((market.optionPrices![i] || 0) * 100);
                    const dotColors = [
                      "bg-[#00e5a0]", "bg-[#00b4d8]", "bg-[#f59e0b]", "bg-[#ef4444]",
                      "bg-[#8b5cf6]", "bg-[#ec4899]", "bg-[#14b8a6]", "bg-[#f97316]",
                      "bg-[#6366f1]", "bg-[#84cc16]",
                    ];
                    const textColors = [
                      "text-[#00e5a0]", "text-[#00b4d8]", "text-[#f59e0b]", "text-red-400",
                      "text-[#8b5cf6]", "text-[#ec4899]", "text-[#14b8a6]", "text-[#f97316]",
                      "text-[#6366f1]", "text-[#84cc16]",
                    ];
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--background)]/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-2.5 h-2.5 rounded-full", dotColors[i % dotColors.length])} />
                          <span className="text-sm font-medium">{opt}</span>
                        </div>
                        <span className={cn("text-sm font-bold font-mono", textColors[i % textColors.length])}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-[var(--card-border)]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#00e5a0]" />
                      <span className="text-sm font-medium">YES</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-[#00e5a0]">{yesPct}%</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff4d6a]" />
                      <span className="text-sm font-medium">NO</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-[#ff4d6a]">{noPct}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Description ── */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--card-border)]">
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">
                  {locale === "sw" ? "MAELEZO" : "DESCRIPTION"}
                </span>
              </div>
              <div className="px-4 py-3 text-sm text-[var(--muted)] leading-relaxed">
                {market.description}
              </div>
            </div>

            {/* Creator resolve */}
            {user?.id === market.creatorId && !isResolved && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Warning size={16} className="text-yellow-500" />
                    {locale === "sw" ? "Tatua Soko (Muundaji tu)" : "Resolve Market (Creator only)"}
                  </h2>
                  <button
                    onClick={openEditModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] rounded-lg transition-all"
                  >
                    <PencilSimple size={14} />
                    {locale === "sw" ? "Hariri" : "Edit"}
                  </button>
                </div>
                <p className="text-sm text-[var(--muted)] mb-4">
                  {locale === "sw" ? "Mara ikitaruliwa, washindi watalipwa moja kwa moja." : "Once resolved, winners receive their payouts automatically."}
                </p>
                {isMultiOption && market.options ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {market.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleResolveOption(i)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] rounded-xl font-semibold text-sm hover:bg-[var(--accent)]/20 transition-all"
                        >
                          <CheckCircle size={16} />
                          {opt}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleResolveOption(-1)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-semibold text-sm hover:bg-red-500/20 transition-all"
                    >
                      <XCircle size={16} />
                      {locale === "sw" ? "Hakuna (Hakuna mshindi)" : "None (No winner)"}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResolve(true)}
                      disabled={resolveLoading}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all",
                        resolveConfirm === "YES"
                          ? "bg-[#00e5a0] text-black animate-pulse"
                          : "bg-[#00e5a0]/10 border border-[#00e5a0]/30 text-[#00e5a0] hover:bg-[#00e5a0]/20"
                      )}
                    >
                      <CheckCircle size={16} />
                      {resolveLoading && resolveConfirm === "YES" ? (locale === "sw" ? "Inatatua..." : "Resolving...") :
                       resolveConfirm === "YES" ? (locale === "sw" ? "Bonyeza tena kuthibitisha" : "Tap again to confirm") :
                       (locale === "sw" ? "Tatua NDIO" : "Resolve YES")}
                    </button>
                    <button
                      onClick={() => handleResolve(false)}
                      disabled={resolveLoading}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all",
                        resolveConfirm === "NO"
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                      )}
                    >
                      <XCircle size={16} />
                      {resolveLoading && resolveConfirm === "NO" ? (locale === "sw" ? "Inatatua..." : "Resolving...") :
                       resolveConfirm === "NO" ? (locale === "sw" ? "Bonyeza tena kuthibitisha" : "Tap again to confirm") :
                       (locale === "sw" ? "Tatua HAPANA" : "Resolve NO")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Activity tabs */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
              <div className="flex border-b border-[var(--card-border)]">
                {(["trades", "comments"] as const).map((tb) => (
                  <button
                    key={tb}
                    onClick={() => setTab(tb)}
                    className={cn(
                      "flex-1 py-3.5 text-sm font-medium capitalize transition-all",
                      tab === tb
                        ? "text-[var(--foreground)] border-b-2 border-[var(--accent)]"
                        : "text-[var(--muted)]"
                    )}
                  >
                    {tb === "trades" ? `${t.market.trades} (${market._count.trades})` : `${t.market.comments} (${market._count.comments})`}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {tab === "trades" ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {market.trades.length === 0 ? (
                      <p className="text-center text-[var(--muted)] text-sm py-8">{locale === "sw" ? "Hakuna biashara bado" : "No trades yet"}</p>
                    ) : (
                      market.trades.map((tr) => (
                        <div key={tr.id} className="flex items-center justify-between py-2 text-sm border-b border-[var(--card-border)] last:border-0">
                          <div className="flex items-center gap-2">
                            <UserAvatar username={tr.user.username} avatarUrl={tr.user.avatarUrl} size="xs" onClick={setProfileUsername} />
                            <button onClick={() => setProfileUsername(tr.user.username)} className="font-medium hover:text-[var(--accent)] transition-colors">@{tr.user.username}</button>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-xs font-bold",
                                tr.side === "YES" ? "yes-pill" : "no-pill"
                              )}
                            >
                              {tr.side}
                            </span>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-medium">{formatTZS(tr.amountTzs)}</div>
                            <div className="text-[var(--muted)]">{tr.shares} shares @ {(tr.price).toFixed(3)}</div>
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
                          placeholder={locale === "sw" ? "Shiriki mawazo yako…" : "Share your thoughts…"}
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
                        <p className="text-center text-[var(--muted)] text-sm py-8">{t.market.noComments}</p>
                      ) : (
                        market.comments.map((c) => (
                          <div key={c.id} className="flex gap-3 py-2 border-b border-[var(--card-border)] last:border-0">
                            <div className="flex-shrink-0">
                              <UserAvatar username={c.user.username} avatarUrl={c.user.avatarUrl} size="sm" onClick={setProfileUsername} />
                            </div>
                            <div>
                              <button onClick={() => setProfileUsername(c.user.username)} className="font-medium text-sm mr-2 hover:text-[var(--accent)] transition-colors">@{c.user.username}</button>
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

          {/* ═══ Right: Trade panel ═══ */}
          <div className="space-y-4">
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden sticky top-24">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)]">
                <div className="w-1.5 h-1.5 bg-[#00e5a0]" />
                <span className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">TRADE.PANEL</span>
              </div>
              <div className="p-4 sm:p-5">
              <h2 className="font-bold text-base mb-3 font-mono">{locale === "sw" ? "Fanya Biashara" : "Place a Trade"}</h2>

              {isResolved ? (
                <div className="text-center py-6 text-[var(--muted)]">
                  <CheckCircle size={32} className="mx-auto mb-2 text-[var(--accent)]" />
                  <p className="font-medium">{locale === "sw" ? "Soko Limetatuliwa" : "Market Resolved"}</p>
                  <p className="text-sm mt-1">
                    {t.market.outcome}: <strong className="text-[#00e5a0]">
                      {isMultiOption ? market.outcomeLabel : (market.outcome === 1 ? t.market.yes : t.market.no)}
                    </strong>
                  </p>
                </div>
              ) : !user ? (
                <div className="text-center py-6">
                  <p className="text-[var(--muted)] mb-4 text-sm font-mono">{t.market.signInToTrade}</p>
                  <Link
                    href="/auth/login"
                    className="block py-3 border-2 border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] font-mono font-bold tracking-wider uppercase text-sm hover:opacity-90 transition-all"
                  >
                    {t.market.signInToTrade}
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleTrade} className="space-y-4">
                  {/* Side selector */}
                  {isMultiOption && market.options && market.optionPrices ? (
                    <div className="space-y-2">
                      {market.options.map((opt, i) => {
                        const pct = Math.round((market.optionPrices![i] || 0) * 100);
                        const bgColors = [
                          "bg-[#00e5a0]", "bg-[#00b4d8]", "bg-[#f59e0b]", "bg-[#ef4444]",
                          "bg-[#8b5cf6]", "bg-[#ec4899]", "bg-[#14b8a6]", "bg-[#f97316]",
                          "bg-[#6366f1]", "bg-[#84cc16]",
                        ];
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedOption(i)}
                            className={cn(
                              "w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-between px-4",
                              selectedOption === i
                                ? `${bgColors[i % bgColors.length]} text-black`
                                : "bg-[var(--background)] border border-[var(--card-border)] text-[var(--muted)] hover:border-current"
                            )}
                          >
                            <span>{String.fromCharCode(65 + i)}. {opt}</span>
                            <span>{pct}%</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
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
                  )}

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{t.market.amount}</label>
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
                  {estimatedShares > 0 && market && (() => {
                    const FEE_PCT = 0.05;
                    const pot = Math.round(market.totalVolume * (1 - FEE_PCT));
                    const newPot = Math.round((market.totalVolume + Number(amount)) * (1 - FEE_PCT));
                    let totalSideShares: number;
                    if (isMultiOption) {
                      totalSideShares = (market.totalOptionShares?.[String(selectedOption)] || 0) + estimatedShares;
                    } else {
                      totalSideShares = (side === "YES" ? market.totalYesShares : market.totalNoShares) + estimatedShares;
                    }
                    const payoutIfWin = totalSideShares > 0
                      ? Math.round((estimatedShares / totalSideShares) * newPot * (1 - FEE_PCT))
                      : 0;
                    const netGain = payoutIfWin - Number(amount);
                    return (
                    <div className="p-3 bg-[var(--background)] rounded-xl text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">{locale === "sw" ? "Hisa zinazokadiriwa" : "Estimated shares"}</span>
                        <span className="font-bold">{formatNumber(estimatedShares)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">{locale === "sw" ? "Bei ya wastani" : "Avg price"}</span>
                        <span className="font-medium">{estimatedPrice.toFixed(4)} TZS/share</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">{locale === "sw" ? "Ukishinda" : "If you win"}</span>
                        <span className="font-bold text-[#00e5a0]">{formatTZS(payoutIfWin)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">{locale === "sw" ? "Faida halisi" : "Net gain"}</span>
                        <span className={cn("font-bold", netGain >= 0 ? "text-[var(--accent)]" : "text-yellow-400")}>
                          {netGain >= 0
                            ? `+${formatTZS(netGain)}`
                            : `${formatTZS(netGain)} (${locale === "sw" ? "ada" : "fee"})`}
                        </span>
                      </div>
                    </div>
                    );
                  })()}

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
                      isMultiOption
                        ? "bg-[var(--accent)] text-[var(--background)] hover:opacity-90"
                        : side === "YES"
                          ? "bg-[#00e5a0] text-black hover:opacity-90"
                          : "bg-red-500 text-white hover:opacity-90"
                    )}
                  >
                    {tradeLoading
                      ? (locale === "sw" ? "Inachakata…" : "Processing…")
                      : isMultiOption
                        ? `${t.market.buy} ${market.options![selectedOption]}`
                        : `${t.market.buy} ${side === "YES" ? t.market.yes : t.market.no}`
                    }
                  </button>

                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{locale === "sw" ? "Salio" : "Balance"}: {formatTZS(user.balanceTzs || 0)}</span>
                    <Link href="/wallet" className="text-[var(--accent)] hover:underline">
                      {locale === "sw" ? "Ongeza pesa →" : "Add funds →"}
                    </Link>
                  </div>
                </form>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Market Modal */}
      <AnimatePresence>
        {showEditModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-full max-w-2xl bg-[var(--card)] border-2 border-[var(--accent)] rounded-xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <PencilSimple size={20} className="text-[var(--accent)]" />
                  {locale === "sw" ? "Hariri Soko" : "Edit Market"}
                </h2>
                
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      {locale === "sw" ? "Swali" : "Question"}
                    </label>
                    <textarea
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                      rows={2}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      {locale === "sw" ? "Maelezo" : "Description"}
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      {locale === "sw" ? "Picha ya Jalada" : "Cover Image"}
                    </label>

                    {(editImagePreview || editForm.imageUrl) && (
                      <div className="relative mb-3 rounded-xl overflow-hidden border border-[var(--card-border)]">
                        <img
                          src={editImagePreview || editForm.imageUrl}
                          alt="Preview"
                          className="w-full h-40 object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearEditImage}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                        >
                          <XCircle size={18} className="text-white" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => editFileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[var(--card-border)] hover:border-[var(--accent)]/50 rounded-xl text-sm font-medium text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      <PencilSimple size={14} />
                      {editImagePreview || editForm.imageUrl
                        ? (locale === "sw" ? "Badilisha picha" : "Change image")
                        : (locale === "sw" ? "Pakia picha" : "Upload image")}
                    </button>
                    <input
                      ref={editFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleEditFileSelect}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      {locale === "sw" ? "Jamii" : "Category"}
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--background)] border-2 border-[var(--card-border)] rounded-none text-sm font-mono font-bold focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_10px_rgba(0,229,160,0.2)] transition-all appearance-none cursor-pointer hover:border-[var(--accent)]/40"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%2300e5a0' stroke-width='2' stroke-linecap='square'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                        paddingRight: '3rem',
                      }}
                      required
                    >
                      <option value="Politics">{locale === "sw" ? "Siasa" : "Politics"}</option>
                      <option value="Sports">{locale === "sw" ? "Michezo" : "Sports"}</option>
                      <option value="Business">{locale === "sw" ? "Biashara" : "Business"}</option>
                      <option value="Entertainment">{locale === "sw" ? "Burudani" : "Entertainment"}</option>
                      <option value="Technology">{locale === "sw" ? "Teknolojia" : "Technology"}</option>
                      <option value="Crypto">Crypto</option>
                      <option value="Science">{locale === "sw" ? "Sayansi" : "Science"}</option>
                      <option value="Weather">{locale === "sw" ? "Hali ya Hewa" : "Weather"}</option>
                      <option value="Other">{locale === "sw" ? "Nyingine" : "Other"}</option>
                    </select>
                  </div>

                  {/* Sports Sub-category */}
                  {editForm.category === "Sports" && (
                    <div>
                      <label className="block text-sm font-semibold mb-2">
                        {locale === "sw" ? "Ligi" : "League"}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SPORTS_SUBCATEGORIES.map((sub) => {
                          const isActive = editForm.subCategory === sub.value;
                          return (
                            <button
                              key={sub.value}
                              type="button"
                              onClick={() => setEditForm({ ...editForm, subCategory: sub.value })}
                              className={cn(
                                "py-2 px-3 text-xs font-mono font-bold transition-all flex items-center gap-2 rounded-none",
                                isActive
                                  ? "border-2 border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                                  : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]/40"
                              )}
                            >
                              {sub.icon.startsWith('/') ? (
                                <Image src={sub.icon} alt={sub.label} width={16} height={16} className="object-contain" />
                              ) : (
                                <span>{sub.icon}</span>
                              )}
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      {locale === "sw" ? "Tarehe ya Kutatua" : "Resolution Date"}
                    </label>
                    <input
                      type="datetime-local"
                      value={editForm.resolvesAt}
                      onChange={(e) => setEditForm({ ...editForm, resolvesAt: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                      min={new Date().toISOString().slice(0, 16)}
                      required
                    />
                  </div>

                  {editError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl">
                      {editError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 py-3 px-4 border border-[var(--card-border)] rounded-xl font-semibold text-sm hover:bg-[var(--background)] transition-all"
                    >
                      {locale === "sw" ? "Ghairi" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading || editUploading}
                      className="flex-1 py-3 px-4 bg-[var(--accent)] text-[var(--background)] rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {editUploading
                        ? (locale === "sw" ? "Inapakia picha..." : "Uploading image...")
                        : editLoading
                        ? (locale === "sw" ? "Inahifadhi..." : "Saving...")
                        : (locale === "sw" ? "Hifadhi" : "Save")}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Footer />
      <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
    </div>
  );
}
