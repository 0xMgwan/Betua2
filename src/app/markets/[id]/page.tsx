"use client";
import { useEffect, useState, use, useRef, useCallback } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS, formatPercent, formatNumber, timeUntil, timeAgo, toEATDateTimeLocal, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { convertCurrency, getUserCurrency, formatCurrency, type Currency } from "@/lib/currency";
import { useCurrency } from "@/store/useCurrency";
import { getSharesOut, getMultiOptionSharesOut, getPayoutForShares, getMultiOptionPayoutForShares, getPrice, getMultiOptionPrices } from "@/lib/amm";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Clock, TrendUp, UsersThree, ChatCircle,
  CheckCircle, XCircle, Warning, PaperPlaneTilt,
  ShareNetwork, WhatsappLogo, XLogo, FacebookLogo, TelegramLogo,
  PencilSimple, QrCode,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ShareCardButton } from "@/components/ShareCard";
import { QRCodeModal } from "@/components/QRCodeModal";
import { UserAvatar } from "@/components/UserAvatar";
import { MentionText } from "@/components/MentionText";
import { MentionInput } from "@/components/MentionInput";
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
  seedAmount?: number;
  fxRate?: number | null;
  yesPool: number;
  noPool: number;
  resolvesAt: string;
  createdAt: string;
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
  userPosition?: { yesShares: number; noShares: number; optionShares: Record<string, number> } | null;
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
  
  // Translation state
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [translatedOptions, setTranslatedOptions] = useState<string[] | null>(null);

  // Trade state
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");
  const [tradeSuccess, setTradeSuccess] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePayload, setSharePayload] = useState<{
    label: string; shares: number; amountTzs: number; payoutIfWin: number; oddsPrice: number;
  } | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState<{ depositId: string; phone: string; amountTzs: number; tradeBody: Record<string, unknown> } | null>(null);

  // Sell state
  const [sellShares, setSellShares] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");
  const [sellSuccess, setSellSuccess] = useState("");

  // Hedge Calculator state (FX & Commodities markets only)
  const [showHedge, setShowHedge] = useState(false);
  const [hedgeExposure, setHedgeExposure] = useState("");
  const [hedgeCurrency, setHedgeCurrency] = useState<"TZS"|"USD"|"EUR"|"GBP"|"AED"|"KES"|"CNY">("USD");
  const [hedgeCoverage, setHedgeCoverage] = useState(50);
  const [hedgeCurrencyOpen, setHedgeCurrencyOpen] = useState(false);

  // Comment state
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Profile modal state
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // Share modal
  const [showMarketShareModal, setShowMarketShareModal] = useState(false);

  // Related markets
  const [relatedMarkets, setRelatedMarkets] = useState<{
    id: string; title: string; category: string; imageUrl?: string | null;
    totalVolume: number; yesPool: number; noPool: number;
    options?: string[] | null; optionPools?: number[] | null; status: string;
  }[]>([]);

  // Edit state
  const [showQR, setShowQR] = useState(false);
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
  const [editMarketType, setEditMarketType] = useState<"binary" | "multi">("binary");
  const [editCustomOptions, setEditCustomOptions] = useState<string[]>(["", ""]);
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

  const loadMarket = useCallback(async () => {
    const res = await fetch(`/api/markets/${id}`);
    const data = await res.json();
    setMarket(data.market);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadMarket(); const i = setInterval(loadMarket, 30000); return () => clearInterval(i); }, [loadMarket]);

  // Reset translations when market changes
  useEffect(() => {
    setTranslatedTitle(null);
    setTranslatedDesc(null);
    setTranslatedOptions(null);
  }, [market?.id]);

  // Fetch translation when locale is Swahili
  useEffect(() => {
    if (locale === "sw" && market && !translatedTitle) {
      console.log(`[Translation] Fetching translation for market ${market.id}`);
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, language: "sw" }),
      })
        .then((r) => r.json())
        .then((data) => {
          console.log(`[Translation] Received translation:`, data);
          if (data.title) setTranslatedTitle(data.title);
          if (data.description) setTranslatedDesc(data.description);
          if (data.options) setTranslatedOptions(data.options);
        })
        .catch((err) => console.error("[Translation] Error:", err));
    } else if (locale === "en") {
      setTranslatedTitle(null);
      setTranslatedDesc(null);
      setTranslatedOptions(null);
    }
  }, [locale, market?.id, translatedTitle]);

  // Fetch related markets when market loads
  useEffect(() => {
    if (!market) return;
    const params = new URLSearchParams({ category: market.category, sort: "volume" });
    fetch(`/api/markets?${params}`)
      .then(r => r.json())
      .then(data => {
        const others = (data.markets || []).filter(
          (m: { id: string }) => m.id !== market.id
        ).slice(0, 6);
        setRelatedMarkets(others);
      })
      .catch(() => {});
  }, [market?.id, market?.category]);

  const isMultiOption = !!(market?.options && market.options.length >= 2);
  
  // Global currency preference
  const { format: formatAmount, currency: displayCurrency, toDisplay, fromDisplay } = useCurrency();
  
  // Quick amounts based on currency (in TZS, will be converted for display)
  const QUICK_AMOUNTS_TZS = [1000, 5000, 10000, 50000];
  const QUICK_AMOUNTS_KES = [50, 100, 500, 1000];
  const QUICK_AMOUNTS = displayCurrency === 'USDC' 
    ? [1, 5, 10, 20] // USDC amounts
    : displayCurrency === 'KES'
    ? QUICK_AMOUNTS_KES
    : QUICK_AMOUNTS_TZS;
  
  // Get user balance based on selected currency
  const getUserBalance = () => {
    if (displayCurrency === 'USDC') {
      return user?.balanceUsdc || 0;
    }
    if (displayCurrency === 'KES') {
      return user?.balanceKes || 0;
    }
    return user?.balanceTzs || 0;
  };
  const userBalance = getUserBalance();
  const balanceDisplay = displayCurrency === 'USDC' 
    ? `$${userBalance.toFixed(2)}` 
    : displayCurrency === 'KES'
    ? `KES ${Math.round(userBalance).toLocaleString()}`
    : formatAmount(userBalance);
  
  // Use translated content if available
  const displayTitle = locale === "sw" && translatedTitle ? translatedTitle : market?.title;
  const displayDesc = locale === "sw" && translatedDesc ? translatedDesc : market?.description;
  const displayOptions = locale === "sw" && translatedOptions ? translatedOptions : market?.options;
  
  // Helper to translate trade side names
  const getDisplaySide = (side: string) => {
    if (!isMultiOption || !market?.options || !displayOptions) return side;
    const optionIndex = market.options.indexOf(side);
    if (optionIndex >= 0 && displayOptions[optionIndex]) {
      return displayOptions[optionIndex];
    }
    return side;
  };

  // Poll every 3s while awaiting STK payment confirmation, then auto-retry trade
  useEffect(() => {
    if (!awaitingPayment) return;
    const interval = setInterval(async () => {
      try {
        const syncRes = await fetch("/api/wallet/sync");
        const syncData = await syncRes.json();
        const confirmed = (syncData.transactions || []).find(
          (tx: { ntzsDepositId?: string; status: string }) =>
            tx.ntzsDepositId === awaitingPayment.depositId && tx.status === "COMPLETED"
        );
        if (!confirmed) return;
        clearInterval(interval);
        setAwaitingPayment(null);
        // Retry trade now balance is credited
        const res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(awaitingPayment.tradeBody),
        });
        const data = await res.json();
        if (!res.ok) { setTradeError(data.error || "Trade failed"); return; }
        const label = isMultiOption ? market!.options![selectedOption] : side;
        const oddsPrice = data.oddsPrice ?? (isMultiOption
          ? (getMultiOptionPrices(market!.optionPools as number[])[selectedOption] ?? 0.5)
          : (side === "YES" ? market!.price.yes : market!.price.no));
        setSharePayload({ label, shares: Math.round(data.shares), amountTzs: awaitingPayment.amountTzs, payoutIfWin: data.payoutIfWin ?? 0, oddsPrice });
        setShowShareModal(true);
        setTradeSuccess(`Got ${Math.round(data.shares)} ${label} shares!`);
        setAmount("");
        await loadMarket();
        fetchUser();
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPayment]);

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setTradeLoading(true);
    setTradeError("");
    setTradeSuccess("");
    try {
      const amountNum = Number(amount);
      const amountInTzs = fromDisplay(amountNum);
      const amountPayload = displayCurrency === 'USDC'
        ? { amountUsdc: amountNum }
        : displayCurrency === 'KES'
        ? { amountKes: amountNum }
        : { amountTzs: amountInTzs };
      const tradeBody = isMultiOption
        ? { marketId: id, optionIndex: selectedOption, ...amountPayload }
        : { marketId: id, side, ...amountPayload };

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeBody),
      });
      const data = await res.json();

      if (res.status === 402 && data.paymentRequired) {
        // STK push sent — wait for confirmation before executing trade
        setAwaitingPayment({ depositId: data.depositId, phone: data.phone, amountTzs: amountInTzs, tradeBody });
        return;
      }

      if (!res.ok) {
        setTradeError(data.error || "Trade failed");
      } else {
        const label = isMultiOption ? market!.options![selectedOption] : side;
        const amtTzs = fromDisplay(Number(amount));
        const oddsPrice = data.oddsPrice ?? (isMultiOption
          ? (getMultiOptionPrices(market!.optionPools as number[])[selectedOption] ?? 0.5)
          : (side === "YES" ? market!.price.yes : market!.price.no));
        setSharePayload({ label, shares: Math.round(data.shares), amountTzs: amtTzs, payoutIfWin: data.payoutIfWin ?? 0, oddsPrice });
        setShowShareModal(true);
        setTradeSuccess(`Got ${Math.round(data.shares)} ${label} shares!`);
        setAmount("");
        await loadMarket();
        fetchUser();
      }
    } catch {
      setTradeError("Network error");
    } finally {
      setTradeLoading(false);
    }
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSellLoading(true);
    setSellError("");
    setSellSuccess("");
    try {
      const sellBody = isMultiOption
        ? { marketId: id, optionIndex: selectedOption, sharesToSell: Number(sellShares) }
        : { marketId: id, side, sharesToSell: Number(sellShares) };

      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sellBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setSellError(data.error || "Sell failed");
      } else {
        const label = isMultiOption ? market!.options![selectedOption] : side;
        setSellSuccess(`Sold ${data.sharesToSell} ${label} shares for ${formatTZS(data.netPayout)}!`);
        setSellShares("");
        await loadMarket();
        fetchUser();
        setTimeout(() => setSellSuccess(""), 4000);
      }
    } catch {
      setSellError("Network error");
    } finally {
      setSellLoading(false);
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
      resolvesAt: (() => {
        const d = new Date(market.resolvesAt);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        const h = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        return `${y}-${mo}-${da}T${h}:${mi}`;
      })(),
      category: market.category,
      subCategory: market.subCategory || "",
    });
    // Initialize market type from current market
    const hasOptions = market.options && market.options.length >= 2;
    setEditMarketType(hasOptions ? "multi" : "binary");
    setEditCustomOptions(hasOptions ? [...market.options!] : ["", ""]);
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

      // Build edit payload with optional market type change
      const editPayload: Record<string, unknown> = { ...editForm, imageUrl: finalImageUrl };
      if (editMarketType === "multi") {
        const validOptions = editCustomOptions.map(o => o.trim()).filter(Boolean);
        editPayload.options = validOptions;
      } else {
        editPayload.options = null;
      }

      const res = await fetch(`/api/markets/${id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPayload),
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
  // Early-exit fee on sells (matches /api/sell SELL_FEE_PERCENT default)
  const SELL_FEE_PCT = 0.5;
  let estimatedShares = 0;
  let estimatedPrice = 0;
  const minTradeAmount = displayCurrency === 'USDC' ? 0.5 : displayCurrency === 'KES' ? 50 : 100;
  if (market && amount && Number(amount) >= minTradeAmount) {
    try {
      // Convert user input to TZS for AMM calculations
      const amountInTzs = fromDisplay(Number(amount));
      const feeAmt = Math.round(amountInTzs * FEE_PERCENT);
      const tradeAmt = amountInTzs - feeAmt;
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

  // Estimate sell payout
  let estimatedPayout = 0;
  let estimatedSellPrice = 0;
  let sellFee = 0;
  if (market && sellShares && Number(sellShares) >= 1) {
    try {
      if (isMultiOption && market.optionPools) {
        const result = getMultiOptionPayoutForShares(Number(sellShares), selectedOption, market.optionPools);
        const gross = result.payout;
        sellFee = Math.round(gross * SELL_FEE_PCT);
        estimatedPayout = gross - sellFee;
        estimatedSellPrice = result.avgPrice;
      } else {
        const result = side === "YES"
          ? getPayoutForShares(Number(sellShares), market.yesPool, market.noPool)
          : getPayoutForShares(Number(sellShares), market.noPool, market.yesPool);
        const gross = Math.round(result.payout);
        sellFee = Math.round(gross * SELL_FEE_PCT);
        estimatedPayout = gross - sellFee;
        estimatedSellPrice = result.avgPrice;
      }
    } catch {}
  }

  // Get user's current sellable shares for the selected side/option.
  // Prefer the authoritative position returned by the API (userPosition); fall
  // back to summing the visible trades only if the position isn't available
  // (e.g. legacy responses) — the trades list is capped at 20 so it can undercount.
  let mySharesForSide = 0;
  if (market && user) {
    const up = market.userPosition;
    if (up) {
      mySharesForSide = isMultiOption
        ? (up.optionShares?.[String(selectedOption)] || 0)
        : (side === "YES" ? up.yesShares : up.noShares);
    } else {
      const myTrades = market.trades.filter(tr => tr.user.username === user.username);
      if (isMultiOption && market.options) {
        const optName = market.options[selectedOption];
        mySharesForSide = myTrades
          .filter(tr => tr.side === optName || tr.side === `SELL_${optName}`)
          .reduce((s, tr) => s + tr.shares, 0);
      } else {
        mySharesForSide = myTrades
          .filter(tr => tr.side === side || tr.side === `SELL_${side}`)
          .reduce((s, tr) => s + tr.shares, 0);
      }
    }
    mySharesForSide = Math.max(0, mySharesForSide);
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
  const isExpired = new Date(market.resolvesAt) < new Date();
  const isTradeable = !isResolved && !isExpired;

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
                    <Link 
                      href={`/markets?category=${market.category}`}
                      className="px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-mono rounded border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 transition-all cursor-pointer"
                    >
                      {market.category}
                    </Link>
                    {market.subCategory && (
                      <Link
                        href={`/markets?category=${market.category}&subCategory=${market.subCategory}`}
                        className="px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-mono rounded border border-[var(--accent)]/20 flex items-center gap-1 hover:bg-[var(--accent)]/20 transition-all cursor-pointer"
                      >
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
                      </Link>
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
                  <h1 className="text-base sm:text-xl font-bold leading-tight">{displayTitle}</h1>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--muted)] font-mono">
                    <span>@{market.creator.username}</span>
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} />
                      Created {timeAgo(market.createdAt)}
                    </span>
                    {market.status === "OPEN" && (
                      <span className="flex items-center gap-0.5 text-[#00e5a0]">
                        <CheckCircle size={10} weight="fill" />
                        ACTIVE
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <TrendUp size={10} />
                      {formatAmount(market.totalVolume)} vol
                      {market.seedAmount && market.seedAmount > 0 ? (
                        <span
                          className="text-[#00e5a0] text-[9px] font-mono border border-[#00e5a0]/30 rounded px-1 py-0.5 leading-none"
                          title="Creator backed this market with real liquidity"
                        >
                          💧 LP
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <UsersThree size={10} />
                      {market._count.trades}
                    </span>
                  </div>
                </div>
                {/* Share button */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setShowMarketShareModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold text-[var(--accent)] border border-[var(--accent)]/30 rounded-lg hover:bg-[var(--accent)]/10 transition-all"
                  >
                    <ShareNetwork size={13} weight="bold" />
                    Share
                  </button>
                  <button
                    onClick={() => setShowQR(true)}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-all"
                    title="Get QR code"
                  >
                    <QrCode size={14} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Price Chart (prominent, like Kalshi) ── */}
            <PriceChart marketId={id} className="rounded-xl" displayOptions={displayOptions} />

            {/* ── Volume + Stats bar ── */}
            <div className="flex items-center justify-between px-1 text-xs font-mono text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                {formatAmount(market.totalVolume)} vol
                {market.seedAmount && market.seedAmount > 0 ? (
                  <span
                    className="text-[#00e5a0] text-[9px] border border-[#00e5a0]/30 rounded px-1 py-0.5 leading-none"
                    title="Creator backed this market with real liquidity"
                  >
                    💧 LP
                  </span>
                ) : null}
              </span>
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

              {isMultiOption && displayOptions && market.optionPrices ? (
                <div className="divide-y divide-[var(--card-border)]">
                  {displayOptions.map((opt, i) => {
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
                {displayDesc}
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
                {isMultiOption && displayOptions ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {displayOptions.map((opt, i) => (
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
                              {getDisplaySide(tr.side)}
                            </span>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-medium">{formatAmount(tr.amountTzs)}</div>
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
                        <MentionInput
                          value={comment}
                          onChange={setComment}
                          placeholder={locale === "sw" ? "Shiriki mawazo yako… (@ kutaja)" : "Share your thoughts… (@ to mention)"}
                          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
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
                              <span className="text-sm text-[var(--muted)]"><MentionText text={c.body} /></span>
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
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)]">
                <div className="w-1.5 h-1.5 bg-[#00e5a0]" />
                <span className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">TRADE.PANEL</span>
              </div>
              <div className="p-4 sm:p-5">
              {/* Buy / Sell toggle */}
              <div className="flex items-center bg-[var(--background)] rounded-xl p-1 mb-3">
                <button
                  type="button"
                  onClick={() => { setTradeMode("buy"); setSellError(""); setSellSuccess(""); }}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold font-mono rounded-lg transition-all",
                    tradeMode === "buy"
                      ? "bg-[#00e5a0] text-black"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {locale === "sw" ? "Nunua" : "Buy"}
                </button>
                <button
                  type="button"
                  onClick={() => { setTradeMode("sell"); setTradeError(""); setTradeSuccess(""); }}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold font-mono rounded-lg transition-all",
                    tradeMode === "sell"
                      ? "bg-[#ff4d6a] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {locale === "sw" ? "Uza" : "Sell"}
                </button>
              </div>

              {!isTradeable ? (
                <div className="text-center py-6 text-[var(--muted)]">
                  <CheckCircle size={32} className="mx-auto mb-2 text-[var(--accent)]" />
                  <p className="font-medium">
                    {isResolved 
                      ? (locale === "sw" ? "Soko Limetatuliwa" : "Market Resolved")
                      : (locale === "sw" ? "Soko Limeisha" : "Market Expired")}
                  </p>
                  {isResolved && (
                    <p className="text-sm mt-1">
                      {t.market.outcome}: <strong className="text-[#00e5a0]">
                        {isMultiOption ? market.outcomeLabel : (market.outcome === 1 ? t.market.yes : t.market.no)}
                      </strong>
                    </p>
                  )}
                  {user && (() => {
                    const myTrades = market.trades.filter(tr => tr.user.username === user.username);
                    const myInvestedTzs = myTrades.reduce((s, tr) => s + tr.amountTzs, 0);
                    const myYesShares = myTrades.filter(tr => tr.side === "YES").reduce((s, tr) => s + tr.shares, 0);
                    const myNoShares = myTrades.filter(tr => tr.side === "NO").reduce((s, tr) => s + tr.shares, 0);
                    const myPick = isMultiOption
                      ? (myTrades.length > 0 ? myTrades[0].side : "Option")
                      : myYesShares >= myNoShares ? "YES" : "NO";
                    const winningShares = isMultiOption ? 0 : (market.outcome === 1 ? myYesShares : myNoShares);
                    const totalWinShares = isMultiOption ? 1 : (market.outcome === 1 ? market.totalYesShares : market.totalNoShares);
                    const pot = Math.round(market.totalVolume * 0.95);
                    const myPayout = totalWinShares > 0 ? Math.round((winningShares / totalWinShares) * pot * 0.95) : 0;
                    const didWin = myPayout > 0;
                    const myShares = Math.max(myYesShares, myNoShares);
                    return myTrades.length > 0 ? (
                      <div className="mt-4">
                        <ShareCardButton
                          marketTitle={market.title}
                          category={market.category}
                          subCategory={market.subCategory}
                          imageUrl={market.imageUrl}
                          outcome={myPick}
                          won={didWin}
                          payout={myPayout}
                          invested={myInvestedTzs}
                          username={user.username || ""}
                          shares={myShares}
                          marketUrl={`/markets/${market.id}`}
                        />
                      </div>
                    ) : null;
                  })()}
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
              ) : (<>
                {tradeMode === "buy" ? (
                <form onSubmit={handleTrade} className="space-y-4">
                  {/* Side selector */}
                  {isMultiOption && displayOptions && market.optionPrices ? (
                    <div className="space-y-2">
                      {displayOptions.map((opt, i) => {
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
                    <label className="block text-sm font-medium mb-1.5">{displayCurrency === 'USDC' ? 'Amount (USDC)' : displayCurrency === 'KES' ? 'Amount (KES)' : t.market.amount}</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                        placeholder={displayCurrency === 'USDC' ? "e.g. 5" : displayCurrency === 'KES' ? "e.g. 100" : "e.g. 5000"}
                        min={displayCurrency === 'USDC' ? "0.5" : displayCurrency === 'KES' ? "50" : "100"}
                        step={displayCurrency === 'USDC' ? "0.01" : "1"}
                        required
                      />
                    </div>
                    {/* Quick amounts */}
                    <div className="flex gap-2 mt-2">
                      {QUICK_AMOUNTS.map((a) => (
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
                    const amountInTzs = fromDisplay(Number(amount));
                    const netAmountIn = Math.round(amountInTzs * (1 - FEE_PCT));
                    // Price-based payout: standard prediction market display
                    // Shows what you'd win at current market odds (netAmount / probability × (1 - settlement fee))
                    let currentOddsPrice: number;
                    if (isMultiOption && market.optionPools) {
                      const prices = getMultiOptionPrices(market.optionPools as number[]);
                      currentOddsPrice = prices[selectedOption] ?? 0.5;
                    } else {
                      const prices = getPrice(market.yesPool, market.noPool);
                      currentOddsPrice = side === "YES" ? prices.yes : prices.no;
                    }
                    const payoutIfWin = currentOddsPrice > 0
                      ? Math.round(netAmountIn / currentOddsPrice * (1 - FEE_PCT))
                      : 0;
                    const avgPriceDisplay = displayCurrency === 'USDC' 
                      ? `$${(estimatedPrice / 2630).toFixed(4)}`
                      : displayCurrency === 'KES'
                      ? `KES ${(estimatedPrice / 18.5).toFixed(2)}`
                      : `TSh ${estimatedPrice.toFixed(2)}`;
                    return (
                    <div className="p-3 bg-[var(--background)] rounded-xl text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">{locale === "sw" ? "Hisa zinazokadiriwa" : "Estimated shares"}</span>
                        <span className="font-bold">{formatNumber(estimatedShares)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">{locale === "sw" ? "Bei ya wastani" : "Avg price"}</span>
                        <span className="font-medium">{avgPriceDisplay}/share</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted)] flex items-center gap-1">
                          {locale === "sw" ? "Unatumia" : "You spend"}
                        </span>
                        <span className="font-bold text-[var(--foreground)]">{displayCurrency === 'USDC' ? `$${Number(amount).toFixed(2)}` : displayCurrency === 'KES' ? `KES ${Math.round(Number(amount)).toLocaleString()}` : formatTZS(Number(amount))}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--muted)] flex items-center gap-1">
                          {locale === "sw" ? "Ukishinda utapata" : "If correct, you get"}
                        </span>
                        <span className="font-bold text-[#00e5a0]">{formatAmount(payoutIfWin)}</span>
                      </div>
                    </div>
                    );
                  })()}

                  {/* ── Hedge Calculator (FX & Commodities only) ── */}
                  {market.category === "FX & Commodities" && !isMultiOption && (() => {
                    const BASE_RATES: Record<string, number> = { TZS: 1, USD: 2630, EUR: 2850, GBP: 3320, AED: 716, KES: 20, CNY: 362 };
                    const RATES: Record<string, number> = { ...BASE_RATES, USD: market.fxRate ?? BASE_RATES.USD };
                    const CURRENCIES = ["TZS","USD","EUR","GBP","AED","KES","CNY"] as const;
                    const FEE_PCT = 0.05;
                    const feeSq = (1 - FEE_PCT) ** 2;
                    const yesPriceNow = market.price.yes;
                    const noPriceNow  = market.price.no;
                    const rate = RATES[hedgeCurrency] ?? 2630;
                    const exposureAmt = parseFloat(hedgeExposure) || 0;
                    const exposureTzs = Math.round(exposureAmt * rate);
                    const coverageTzs = Math.round(exposureTzs * hedgeCoverage / 100);
                    const yesCostGross = yesPriceNow > 0 ? Math.round(coverageTzs * yesPriceNow / feeSq) : 0;
                    const noCostGross  = noPriceNow  > 0 ? Math.round(coverageTzs * noPriceNow  / feeSq) : 0;
                    const sw = locale === "sw";
                    const rateSource = (hedgeCurrency === "USD" && market.fxRate) ? (sw ? "kiwango cha muundaji" : "creator rate") : (sw ? "wastani wa soko" : "est. mid-market");
                    const coverageHint = hedgeCoverage === 100
                      ? (sw ? "Ulinzi kamili wa hasara yako" : "Full coverage of your exposure")
                      : hedgeCoverage <= 10
                      ? (sw ? "Bafa ndogo tu" : "Just a small buffer")
                      : `${hedgeCoverage}% ${sw ? "ya mwanga wako" : "of your exposure"}`;
                    return (
                      <div className="border-2 border-orange-500/30 bg-orange-500/5">
                        <button
                          type="button"
                          onClick={() => setShowHedge(!showHedge)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono font-bold text-orange-400 uppercase tracking-wider hover:bg-orange-500/10 transition-colors"
                        >
                          <span>⚖ {sw ? "KIKOKOTOO CHA HEDGING" : "HEDGE CALCULATOR"}</span>
                          <span>{showHedge ? "▲" : "▼"}</span>
                        </button>
                        {showHedge && (
                          <div className="px-3 pb-3 space-y-3 border-t border-orange-500/20">
                            {/* Exposure + currency */}
                            <div className="pt-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <label className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">
                                  {sw ? "Mwanga wangu" : "My exposure"} ({hedgeCurrency})
                                </label>
                                <span className="text-[9px] font-mono text-orange-400/60 border border-orange-500/20 px-1 leading-tight cursor-default" title={sw ? "Ingiza kiasi unachohitaji kubadilisha au kupokea." : "Enter the amount you need to convert or receive. Not sure? Enter 0 to trade without hedging."}>?</span>
                              </div>
                              <div className="flex items-start gap-1.5 mb-2 text-[9px] font-mono text-[var(--muted)]/70 border border-orange-500/10 bg-[var(--background)] px-2 py-1.5">
                                <span className="text-orange-400/60 shrink-0">ⓘ</span>
                                <span>{sw ? "Ingiza kiasi unachohitaji kubadilisha au kupokea. Haujui? Ingiza 0 kuuza bila hedging." : "Enter the amount you need to convert or receive. Not sure? Enter 0 to trade without hedging."}</span>
                              </div>
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={hedgeExposure}
                                  onChange={(e) => setHedgeExposure(e.target.value)}
                                  placeholder="e.g. 500"
                                  className="flex-1 min-w-0 px-2 py-1.5 bg-[var(--background)] border-2 border-orange-500/20 text-sm font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                                />
                                {/* Custom terminal currency dropdown */}
                                <div className="relative shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setHedgeCurrencyOpen(!hedgeCurrencyOpen)}
                                    className="flex items-center gap-1 px-2 py-1.5 bg-[var(--card)] border-2 border-orange-500/30 hover:border-orange-500/60 text-[10px] font-mono font-bold text-orange-400 transition-colors min-w-[52px] justify-between"
                                  >
                                    <span>{hedgeCurrency}</span>
                                    <span className="text-[8px]">{hedgeCurrencyOpen ? "▲" : "▼"}</span>
                                  </button>
                                  {hedgeCurrencyOpen && (
                                    <div className="absolute right-0 bottom-full mb-0.5 z-50 bg-[var(--card)] border-2 border-orange-500/40 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] min-w-[64px]">
                                      {CURRENCIES.map(c => (
                                        <button
                                          key={c}
                                          type="button"
                                          onClick={() => { setHedgeCurrency(c); setHedgeCurrencyOpen(false); }}
                                          className={`w-full text-left px-2 py-1.5 text-[10px] font-mono font-bold transition-colors ${
                                            c === hedgeCurrency
                                              ? "bg-orange-500/20 text-orange-400"
                                              : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-orange-400"
                                          }`}
                                        >
                                          {c}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {exposureAmt > 0 && hedgeCurrency !== "TZS" && (
                                <div className="mt-1 space-y-0.5">
                                  <p className="text-[9px] font-mono text-[var(--muted)]">≈ TSh {exposureTzs.toLocaleString()} {sw ? "kwa kiwango cha sasa" : "at current rate"}</p>
                                  <p className="text-[9px] font-mono text-orange-400/60">{sw ? "Kiwango" : "Rate"}: {rate.toLocaleString()} TZS/{hedgeCurrency} ({rateSource})</p>
                                </div>
                              )}
                            </div>
                            {/* Coverage slider */}
                            {exposureAmt > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">{sw ? "Kiwango cha ulinzi" : "Coverage level"}</label>
                                  <span className="text-[10px] font-mono font-bold text-orange-400">{hedgeCoverage}%</span>
                                </div>
                                <input type="range" min={5} max={100} step={5} value={hedgeCoverage} onChange={(e) => setHedgeCoverage(Number(e.target.value))} className="w-full accent-orange-400 h-1.5 cursor-pointer" />
                                <p className="text-[9px] font-mono text-[var(--muted)] mt-1">{coverageHint}</p>
                                <p className="text-[9px] font-mono text-orange-400/80 mt-0.5">
                                  {sw ? "Kulinda kila kitu? Sogeza hadi 100%." : "Hedge everything? Move to 100%."}{" "}
                                  {sw ? "Bafa ndogo? Sogeza hadi 10%." : "Just a buffer? Move to 10%."}
                                </p>
                              </div>
                            )}
                            {/* YES / NO blocks */}
                            {exposureAmt > 0 && coverageTzs > 0 && (
                              <div className="space-y-2">
                                <div className="p-2 bg-[var(--background)] border border-[#00e5a0]/20 space-y-1">
                                  <div className="text-[9px] font-mono font-bold text-[#00e5a0] uppercase mb-1">{sw ? "NUNUA NDIYO (Hedge)" : "BUY YES hedge"}</div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                                    <span className="text-[var(--muted)]">{sw ? "Gharama" : "Total cost"}</span>
                                    <span className="text-right font-bold">TSh {yesCostGross.toLocaleString()}</span>
                                    <span className="text-[var(--muted)]">{sw ? "Malipo kama NDIYO" : "Payout if YES wins"}</span>
                                    <span className="text-right font-bold text-[#00e5a0]">TSh {coverageTzs.toLocaleString()}</span>
                                    <span className="text-[var(--muted)]">{sw ? "Ada ya bima" : "Insurance premium"}</span>
                                    <span className="text-right text-orange-400">TSh {yesCostGross.toLocaleString()}</span>
                                  </div>
                                  <button type="button" onClick={() => { setSide("YES"); setAmount(String(yesCostGross)); setShowHedge(false); }} className="w-full mt-1.5 py-1.5 bg-[#00e5a0] text-black text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                                    {sw ? "Tumia → Nunua NDIYO" : "Apply → Buy YES"}
                                  </button>
                                </div>
                                <div className="p-2 bg-[var(--background)] border border-red-500/20 space-y-1">
                                  <div className="text-[9px] font-mono font-bold text-red-400 uppercase mb-1">{sw ? "NUNUA HAPANA (Hedge)" : "BUY NO hedge"}</div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                                    <span className="text-[var(--muted)]">{sw ? "Gharama" : "Total cost"}</span>
                                    <span className="text-right font-bold">TSh {noCostGross.toLocaleString()}</span>
                                    <span className="text-[var(--muted)]">{sw ? "Malipo kama HAPANA" : "Payout if NO wins"}</span>
                                    <span className="text-right font-bold text-red-400">TSh {coverageTzs.toLocaleString()}</span>
                                    <span className="text-[var(--muted)]">{sw ? "Ada ya bima" : "Insurance premium"}</span>
                                    <span className="text-right text-orange-400">TSh {noCostGross.toLocaleString()}</span>
                                  </div>
                                  <button type="button" onClick={() => { setSide("NO"); setAmount(String(noCostGross)); setShowHedge(false); }} className="w-full mt-1.5 py-1.5 bg-red-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
                                    {sw ? "Tumia → Nunua HAPANA" : "Apply → Buy NO"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Awaiting STK payment confirmation */}
                  {awaitingPayment && (
                    <div className="p-3 border border-orange-500/40 bg-orange-500/5 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-orange-400 text-xs font-bold">
                        <span className="animate-pulse">●</span>
                        <span>{locale === "sw" ? "Subiri Uthibitisho" : "Awaiting Payment"}</span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)]">
                        {locale === "sw"
                          ? `STK push imetumwa kwa ${awaitingPayment.phone}. Thibitisha kwenye simu yako.`
                          : `STK push sent to ${awaitingPayment.phone}. Approve on your phone to complete trade.`}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <span className="animate-spin inline-block">↻</span>
                        <span>{locale === "sw" ? "Inangoja..." : "Checking confirmation..."}</span>
                      </div>
                      <button type="button" onClick={() => setAwaitingPayment(null)}
                        className="text-[10px] text-[var(--muted)] hover:text-red-400 underline transition-colors">
                        {locale === "sw" ? "Ghairi" : "Cancel"}
                      </button>
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
                    disabled={tradeLoading || !amount || Number(amount) < (displayCurrency === 'USDC' ? 0.5 : displayCurrency === 'KES' ? 50 : 100)}
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
                        ? `${t.market.buy} ${displayOptions![selectedOption]}`
                        : `${t.market.buy} ${side === "YES" ? t.market.yes : t.market.no}`
                    }
                  </button>

                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{locale === "sw" ? "Salio" : "Balance"}: {balanceDisplay}</span>
                    <Link href="/wallet" className="text-[var(--accent)] hover:underline">
                      {locale === "sw" ? "Ongeza pesa →" : "Add funds →"}
                    </Link>
                  </div>
                </form>
                ) : (
                /* ═══ SELL FORM ═══ */
                <form onSubmit={handleSell} className="space-y-4">
                  {/* Side selector (same as buy) */}
                  {isMultiOption && displayOptions && market.optionPrices ? (
                    <div className="space-y-2">
                      {displayOptions.map((opt, i) => {
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
                            onClick={() => { setSelectedOption(i); setSellShares(""); }}
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
                          onClick={() => { setSide(s); setSellShares(""); }}
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

                  {/* Your shares */}
                  <div className="p-3 bg-[var(--background)] rounded-xl text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--muted)]">{locale === "sw" ? "Hisa zako" : "Your shares"}</span>
                      <span className="font-bold">{formatNumber(mySharesForSide)}</span>
                    </div>
                  </div>

                  {mySharesForSide > 0 ? (
                    <>
                      {/* Shares to sell */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          {locale === "sw" ? "Hisa za kuuza" : "Shares to sell"}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={sellShares}
                            onChange={(e) => setSellShares(e.target.value)}
                            className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[#ff4d6a] transition-colors"
                            placeholder={`Max ${mySharesForSide}`}
                            min="1"
                            max={mySharesForSide}
                            required
                          />
                        </div>
                        {/* Quick sell amounts */}
                        <div className="flex gap-2 mt-2">
                          {[25, 50, 75, 100].map((pct) => {
                            const qty = Math.floor(mySharesForSide * pct / 100);
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setSellShares(String(qty))}
                                disabled={qty < 1}
                                className="flex-1 py-1 text-xs bg-[var(--background)] border border-[var(--card-border)] rounded-lg hover:border-[#ff4d6a] transition-colors disabled:opacity-30"
                              >
                                {pct}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sell estimate */}
                      {estimatedPayout > 0 && (
                        <div className="p-3 bg-[var(--background)] rounded-xl text-sm space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-[var(--muted)]">{locale === "sw" ? "Utapata" : "You receive"}</span>
                            <span className="font-bold text-[#00e5a0]">{formatAmount(estimatedPayout)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--muted)]">{locale === "sw" ? "Bei ya wastani" : "Avg price"}</span>
                            <span className="font-medium">{displayCurrency === 'USDC' ? `$${(estimatedSellPrice / 2630).toFixed(4)}` : displayCurrency === 'KES' ? `KES ${(estimatedSellPrice / 18.5).toFixed(2)}` : `TSh ${estimatedSellPrice.toFixed(2)}`}/share</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--muted)]">{locale === "sw" ? "Ada ya kutoka mapema" : "Early exit fee"}</span>
                            <span className="text-[var(--muted)]">-{formatAmount(sellFee)}</span>
                          </div>
                        </div>
                      )}

                      {sellError && (
                        <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2">
                          {sellError}
                        </p>
                      )}

                      <AnimatePresence>
                        {sellSuccess && (
                          <motion.p
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-[#00e5a0] text-sm text-center bg-[#00e5a0]/10 border border-[#00e5a0]/20 rounded-xl py-2 flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle size={14} />
                            {sellSuccess}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        disabled={sellLoading || !sellShares || Number(sellShares) < 1 || Number(sellShares) > mySharesForSide}
                        className="w-full py-3.5 font-bold rounded-xl transition-all disabled:opacity-50 text-sm bg-[#ff4d6a] text-white hover:opacity-90"
                      >
                        {sellLoading
                          ? (locale === "sw" ? "Inachakata…" : "Processing…")
                          : locale === "sw"
                            ? `Uza hisa ${sellShares || 0}`
                            : `Sell ${sellShares || 0} shares`
                        }
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-[var(--muted)] text-sm font-mono">
                        {locale === "sw"
                          ? `Huna hisa za ${isMultiOption ? market.options![selectedOption] : side} za kuuza`
                          : `No ${isMultiOption ? market.options![selectedOption] : side} shares to sell`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTradeMode("buy")}
                        className="mt-2 text-xs text-[var(--accent)] hover:underline font-mono"
                      >
                        {locale === "sw" ? "Nunua hisa kwanza →" : "Buy shares first →"}
                      </button>
                    </div>
                  )}
                </form>
                )}
              </>)}
              </div>
            </div>

            {/* ── Related Markets (desktop: under trade panel) ── */}
            {relatedMarkets.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)]">
                  <div className="w-1.5 h-1.5 bg-[var(--accent)]/50" />
                  <span className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">
                    {locale === "sw" ? "MASOKO.YANAYOHUSIANA" : "RELATED.MARKETS"}
                  </span>
                </div>
                <div className="divide-y divide-[var(--card-border)]">
                  {relatedMarkets.map(rm => {
                    const rmIsMulti = Array.isArray(rm.options) && rm.options.length >= 2 && Array.isArray(rm.optionPools);
                    let probLabel = "";
                    if (rmIsMulti) {
                      const pools = rm.optionPools as number[];
                      const inv = pools.reduce((s, p) => s + 1 / Math.max(p, 1), 0);
                      const probs = pools.map(p => Math.round(((1 / Math.max(p, 1)) / inv) * 100));
                      const maxIdx = probs.indexOf(Math.max(...probs));
                      probLabel = `${rm.options![maxIdx]}: ${probs[maxIdx]}%`;
                    } else {
                      const total = (rm.yesPool || 0) + (rm.noPool || 0);
                      const yes = total > 0 ? Math.round((rm.noPool / total) * 100) : 50;
                      probLabel = `YES ${yes}%`;
                    }
                    return (
                      <Link key={rm.id} href={`/markets/${rm.id}`}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--accent)]/5 transition-colors"
                      >
                        {rm.imageUrl ? (
                          <div className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                            <Image src={rm.imageUrl} alt={rm.title} fill className="object-cover" sizes="36px" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex-shrink-0 bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center">
                            <TrendUp size={14} className="text-[var(--accent)]/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                            {rm.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono font-bold text-[var(--accent)]">{probLabel}</span>
                            {rm.totalVolume > 0 && (
                              <span className="text-[9px] font-mono text-[var(--muted)]">· {formatAmount(rm.totalVolume)} vol</span>
                            )}
                          </div>
                        </div>
                        {rm.status === "RESOLVED" && (
                          <span className="text-[9px] font-mono text-[var(--muted)] flex-shrink-0">✓</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
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

                  {/* Market Type Toggle — only if no trades yet */}
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      {locale === "sw" ? "Aina ya Soko" : "Market Type"}
                    </label>
                    {market && market._count.trades > 0 ? (
                      isMultiOption ? (
                        // Multi-option with trades: renaming labels is safe (pools/positions
                        // are keyed by index), so allow it — but lock the option count.
                        <div className="space-y-2">
                          <p className="text-[11px] font-mono text-[var(--muted)]">
                            {locale === "sw"
                              ? "Unaweza kubadilisha majina ya chaguzi tu (huwezi kuongeza/kuondoa baada ya biashara)."
                              : "You can rename options only — options can't be added or removed after trades."}
                          </p>
                          {editCustomOptions.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[var(--muted)] w-5">{i + 1}.</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...editCustomOptions];
                                  updated[i] = e.target.value;
                                  setEditCustomOptions(updated);
                                }}
                                placeholder={`${locale === "sw" ? "Chaguo" : "Option"} ${i + 1}`}
                                className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                                maxLength={100}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-mono text-[var(--muted)] px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-xl">
                          {locale === "sw" ? "Ndiyo/Hapana (haiwezi kubadilishwa baada ya biashara)" : "YES/NO (cannot change after trades)"}
                        </p>
                      )
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditMarketType("binary")}
                            className={cn(
                              "py-3 text-sm font-mono font-bold transition-all rounded-xl",
                              editMarketType === "binary"
                                ? "border-2 border-[var(--accent)]/50 bg-[var(--background)]"
                                : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]/30 bg-[var(--background)]"
                            )}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={editMarketType === "binary" ? "text-[#00e5a0]" : ""}>YES</span>
                              <span className="text-[var(--muted)]">/</span>
                              <span className={editMarketType === "binary" ? "text-red-400" : ""}>NO</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditMarketType("multi")}
                            className={cn(
                              "py-3 text-sm font-mono font-bold transition-all rounded-xl",
                              editMarketType === "multi"
                                ? "border-2 border-purple-500/50 bg-[var(--background)]"
                                : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]/30 bg-[var(--background)]"
                            )}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={editMarketType === "multi" ? "text-purple-400" : ""}>
                                {locale === "sw" ? "CHAGUZI" : "MULTI"}
                              </span>
                            </div>
                          </button>
                        </div>

                        {editMarketType === "multi" && (
                          <div className="mt-3 space-y-2">
                            <label className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">
                              {locale === "sw" ? "Chaguzi" : "Options"} ({editCustomOptions.filter(o => o.trim()).length}/{editCustomOptions.length})
                            </label>
                            {editCustomOptions.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-[var(--muted)] w-5">{i + 1}.</span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...editCustomOptions];
                                    updated[i] = e.target.value;
                                    setEditCustomOptions(updated);
                                  }}
                                  placeholder={`${locale === "sw" ? "Chaguo" : "Option"} ${i + 1}`}
                                  className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                                  maxLength={100}
                                />
                                {editCustomOptions.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => setEditCustomOptions(editCustomOptions.filter((_, j) => j !== i))}
                                    className="p-1.5 text-red-400 hover:bg-red-500/10 transition-colors rounded"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                            {editCustomOptions.length < 10 && (
                              <button
                                type="button"
                                onClick={() => setEditCustomOptions([...editCustomOptions, ""])}
                                className="w-full py-2 border border-dashed border-purple-500/30 text-purple-400 text-xs font-mono hover:bg-purple-500/5 transition-colors rounded-lg"
                              >
                                + {locale === "sw" ? "Ongeza chaguo" : "Add option"}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
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
                      <option value="Geopolitics">{locale === "sw" ? "Siasa za Kimataifa" : "Geopolitics"}</option>
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

      {/* ── Market Share Modal (no trade required) ── */}
      <AnimatePresence>
        {showMarketShareModal && market && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-4 sm:p-4"
            onClick={() => setShowMarketShareModal(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative w-full max-w-md bg-[var(--card)] border border-[var(--accent)]/30 rounded-2xl overflow-y-auto max-h-[90vh] shadow-[0_0_60px_rgba(0,229,160,0.12)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)] to-[var(--accent)]/0" />
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  {market.imageUrl ? (
                    <img src={market.imageUrl} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[var(--card-border)]" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                      <ShareNetwork size={18} weight="bold" className="text-[var(--accent)]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-sm text-[var(--foreground)] uppercase tracking-wider">Share Market</p>
                    <p className="text-xs text-[var(--muted)] line-clamp-1">{displayTitle || market.title}</p>
                  </div>
                  <button onClick={() => setShowMarketShareModal(false)} className="ml-auto text-[var(--muted)] hover:text-[var(--foreground)] shrink-0">
                    <XCircle size={20} />
                  </button>
                </div>

                {/* Live odds snapshot */}
                {(() => {
                  if (isMultiOption && market.optionPools) {
                    const prices = getMultiOptionPrices(market.optionPools as number[]);
                    const allOptions = prices.map((p, i) => ({ label: market.options![i], prob: Math.round(p * 100), i }))
                      .sort((a, b) => b.prob - a.prob);
                    const useTwoCol = allOptions.length >= 4;
                    return (
                      <div className={`grid gap-1.5 ${useTwoCol ? "grid-cols-2" : ""}`}>
                        {allOptions.map(o => (
                          <div key={o.i} className="flex items-center justify-between bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 font-mono text-xs">
                            <span className="text-[var(--muted)] truncate mr-2">{o.label}</span>
                            <span className="font-black text-[var(--accent)] shrink-0">{o.prob}%</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  const yesP = Math.round(market.price.yes * 100);
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#00e5a0]/5 border border-[#00e5a0]/20 rounded-xl p-3 text-center font-mono">
                        <p className="text-[10px] text-[var(--muted)] uppercase mb-1">YES</p>
                        <p className="text-2xl font-black text-[#00e5a0]">{yesP}%</p>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-center font-mono">
                        <p className="text-[10px] text-[var(--muted)] uppercase mb-1">NO</p>
                        <p className="text-2xl font-black text-red-400">{100 - yesP}%</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Share buttons */}
                <div>
                  <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-mono mb-2">Share with friends 👇</p>
                  {(() => {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guap.gold";
                    const marketUrl = `${appUrl}/markets/${id}`;
                    const title = displayTitle || market.title;
                    const oddsSnap = isMultiOption && market.optionPools
                      ? getMultiOptionPrices(market.optionPools as number[])
                          .map((p, i) => `${market.options![i]}: ${Math.round(p * 100)}%`)
                          .join(" · ")
                      : `YES ${Math.round(market.price.yes * 100)}% · NO ${Math.round(market.price.no * 100)}%`;
                    const waMsg = `📊 *${title}*\n${oddsSnap}\n\nPredict on Guap 👇\n${marketUrl}`;
                    const tgMsg = `📊 ${title} — ${oddsSnap}. Make your prediction on Guap!`;
                    const xMsg  = `📊 "${title}" — ${oddsSnap} · Predict on Guap 👇`;
                    const waUrl = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
                    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(marketUrl)}&text=${encodeURIComponent(tgMsg)}`;
                    const xUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xMsg)}&url=${encodeURIComponent(marketUrl)}`;
                    return (
                      <div className="flex gap-2">
                        {[
                          { href: waUrl, bg: "bg-[#25D366]/10", border: "border-[#25D366]/20", hover: "hover:bg-[#25D366]/20", color: "text-[#25D366]", icon: <WhatsappLogo size={22} weight="fill" />, label: "WhatsApp" },
                          { href: tgUrl, bg: "bg-[#229ED9]/10", border: "border-[#229ED9]/20", hover: "hover:bg-[#229ED9]/20", color: "text-[#229ED9]", icon: <TelegramLogo size={22} weight="fill" />, label: "Telegram" },
                          { href: xUrl,  bg: "bg-white/5",       border: "border-white/10",     hover: "hover:bg-white/10",     color: "text-white",     icon: <XLogo size={22} weight="fill" />,        label: "X / Twitter" },
                        ].map(s => (
                          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl ${s.bg} border ${s.border} ${s.hover} transition-colors ${s.color}`}>
                            {s.icon}
                            <span className="text-[10px] font-mono font-bold">{s.label}</span>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <button
                  onClick={() => setShowMarketShareModal(false)}
                  className="w-full py-2.5 font-mono text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--card-border)] rounded-xl transition-colors"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trade Success / Share Modal ── */}
      <AnimatePresence>
        {showShareModal && sharePayload && market && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative w-full max-w-md bg-[var(--card)] border border-[var(--accent)]/30 rounded-2xl overflow-y-auto max-h-[90vh] shadow-[0_0_60px_rgba(0,229,160,0.15)]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header glow bar */}
              <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)]/0 via-[var(--accent)] to-[var(--accent)]/0" />

              <div className="p-5 space-y-4">
                {/* Confirm icon + title */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                    <CheckCircle size={22} weight="fill" className="text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-sm text-[var(--foreground)] uppercase tracking-wider">Trade Confirmed</p>
                    <p className="text-xs text-[var(--muted)] line-clamp-1">{market.title}</p>
                  </div>
                  <button onClick={() => setShowShareModal(false)} className="ml-auto text-[var(--muted)] hover:text-[var(--foreground)]">
                    <XCircle size={20} />
                  </button>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "You bet", value: formatTZS(sharePayload.amountTzs) },
                    { label: "Position", value: sharePayload.label, accent: true },
                    { label: "Odds", value: `${Math.round(sharePayload.oddsPrice * 100)}%` },
                  ].map(s => (
                    <div key={s.label} className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-mono mb-1">{s.label}</p>
                      <p className={`text-sm font-black font-mono ${s.accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-mono">If correct, you get</p>
                    <p className="text-lg font-black text-[var(--accent)] font-mono">{formatTZS(sharePayload.payoutIfWin)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--muted)] font-mono">Profit</p>
                    <p className={`text-sm font-bold font-mono ${sharePayload.payoutIfWin > sharePayload.amountTzs ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
                      {sharePayload.payoutIfWin > sharePayload.amountTzs ? "+" : ""}{formatTZS(sharePayload.payoutIfWin - sharePayload.amountTzs)}
                    </p>
                  </div>
                </div>

                {/* Share prompt */}
                <div>
                  <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-mono mb-2">Share your call 🔥</p>
                  {(() => {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guap.gold";
                    const marketUrl = `${appUrl}/markets/${id}`;
                    const odds = `${Math.round(sharePayload.oddsPrice * 100)}%`;
                    const betStr = formatTZS(sharePayload.amountTzs);
                    const msg = `🔥 I just bet ${betStr} on *${sharePayload.label}* — "${market.title}"\nOdds: ${odds} | Payout if correct: ${formatTZS(sharePayload.payoutIfWin)}\n\nJoin me on Guap 👇\n${marketUrl}`;
                    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(marketUrl)}&text=${encodeURIComponent(`🔥 I just bet ${betStr} on ${sharePayload.label} — "${market.title}". Odds: ${odds}. Join me on Guap!`)}`;
                    const xUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🔥 I just bet ${betStr} on "${market.title}" — ${sharePayload.label} @ ${odds} odds. Join me on Guap 👇`)}&url=${encodeURIComponent(marketUrl)}`;
                    return (
                      <div className="flex gap-2">
                        {[
                          { href: waUrl, bg: "bg-[#25D366]/10", border: "border-[#25D366]/20", hover: "hover:bg-[#25D366]/20", color: "text-[#25D366]", icon: <WhatsappLogo size={22} weight="fill" />, label: "WhatsApp" },
                          { href: tgUrl, bg: "bg-[#229ED9]/10", border: "border-[#229ED9]/20", hover: "hover:bg-[#229ED9]/20", color: "text-[#229ED9]", icon: <TelegramLogo size={22} weight="fill" />, label: "Telegram" },
                          { href: xUrl,  bg: "bg-white/5",       border: "border-white/10",     hover: "hover:bg-white/10",     color: "text-white",     icon: <XLogo size={22} weight="fill" />,        label: "X / Twitter" },
                        ].map(s => (
                          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl ${s.bg} border ${s.border} ${s.hover} transition-colors ${s.color}`}>
                            {s.icon}
                            <span className="text-[10px] font-mono font-bold">{s.label}</span>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-2.5 font-mono text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--card-border)] rounded-xl transition-colors"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || ''}/markets/${id}`}
        title={market?.title || ''}
      />
    </div>
  );
}
