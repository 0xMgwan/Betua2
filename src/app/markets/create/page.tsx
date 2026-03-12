"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { motion } from "framer-motion";
import { CATEGORIES, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Footer } from "@/components/Footer";
import {
  CalendarBlank, Image as ImageIcon, CaretRight, Info,
  CurrencyDollar, Upload, X, ChartLine, Plus, Trash,
  Bank, SoccerBall, FilmSlate, CurrencyBtc, Briefcase,
  Flask, CloudSun, Crosshair, Terminal, Lightning,
  CheckSquare, ListBullets, TextT, AlignLeft, Eye,
} from "@phosphor-icons/react";
import { CRYPTO_SYMBOLS } from "@/lib/pyth";
import { TerminalDatePicker } from "@/components/TerminalDatePicker";

const CREATION_FEE_TZS = 2000;

export default function CreateMarketPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Politics",
    subCategory: "",
    resolvesAt: "",
    imageUrl: "",
  });

  // Market type: "binary" (YES/NO) or "multi" (custom options)
  const [marketType, setMarketType] = useState<"binary" | "multi">("binary");
  const [customOptions, setCustomOptions] = useState<string[]>(["", ""]);

  function addOption() {
    if (customOptions.length >= 10) return;
    setCustomOptions([...customOptions, ""]);
  }

  function removeOption(index: number) {
    if (customOptions.length <= 2) return;
    setCustomOptions(customOptions.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...customOptions];
    updated[index] = value;
    setCustomOptions(updated);
  }

  // Pyth-specific state (only for Crypto markets)
  const [pythConfig, setPythConfig] = useState({
    symbol: "BTC",
    targetPrice: "",
    operator: "above" as "above" | "below",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Tomorrow default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const defaultDate = tomorrow.toISOString().slice(0, 16);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setForm((f) => ({ ...f, imageUrl: "" })); // clear URL if file selected
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview("");
    setForm((f) => ({ ...f, imageUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadImageFile(): Promise<string | null> {
    if (!imageFile) return form.imageUrl || null;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.resolvesAt) return setError("Set a resolution date");
    const resolveDate = new Date(form.resolvesAt);
    if (resolveDate <= new Date()) return setError("Resolution date must be in the future");

    if (form.category === "Crypto" && !pythConfig.targetPrice) {
      return setError("Set a target price for crypto market auto-resolution");
    }

    setLoading(true);
    setError("");

    try {
      // Upload image first if file was selected
      let finalImageUrl = form.imageUrl;
      if (imageFile) {
        const uploaded = await uploadImageFile();
        if (uploaded === null) { setLoading(false); return; }
        finalImageUrl = uploaded;
      }

      const body: Record<string, unknown> = {
        ...form,
        imageUrl: finalImageUrl,
        resolvesAt: form.resolvesAt || defaultDate,
      };

      // Add custom options for multi-option markets
      if (marketType === "multi") {
        const validOptions = customOptions.map(o => o.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          setLoading(false);
          return setError(locale === "sw" ? "Ongeza angalau chaguzi 2" : "Add at least 2 options");
        }
        body.options = validOptions;
      }

      // Add Pyth data for Crypto markets
      if (form.category === "Crypto" && pythConfig.targetPrice) {
        body.pythSymbol = pythConfig.symbol;
        body.pythTargetPrice = parseFloat(pythConfig.targetPrice);
        body.pythOperator = pythConfig.operator;
        // Auto-generate title from Pyth config if title is empty
        if (!body.title) {
          body.title = `Will ${pythConfig.symbol} be ${pythConfig.operator} $${parseFloat(pythConfig.targetPrice).toLocaleString()} USD by resolution?`;
        }
      }

      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to create market");
      router.push(`/markets/${data.market.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const isCrypto = form.category === "Crypto";

  // Category config with Phosphor icons and terminal colors
  const catConfig: Record<string, { icon: React.ReactNode; color: string; border: string; activeBg: string }> = {
    Politics: { icon: <Bank size={16} weight="fill" />, color: "text-purple-400", border: "border-purple-500/40", activeBg: "bg-purple-500/80" },
    Sports: { icon: <SoccerBall size={16} weight="fill" />, color: "text-[#00e5a0]", border: "border-[#00e5a0]/40", activeBg: "bg-[#00e5a0]" },
    Entertainment: { icon: <FilmSlate size={16} weight="fill" />, color: "text-pink-400", border: "border-pink-500/40", activeBg: "bg-pink-500/80" },
    Crypto: { icon: <CurrencyBtc size={16} weight="fill" />, color: "text-orange-400", border: "border-orange-500/40", activeBg: "bg-orange-500/80" },
    Business: { icon: <Briefcase size={16} weight="fill" />, color: "text-[#00b4d8]", border: "border-[#00b4d8]/40", activeBg: "bg-[#00b4d8]" },
    Science: { icon: <Flask size={16} weight="fill" />, color: "text-teal-400", border: "border-teal-500/40", activeBg: "bg-teal-500/80" },
    Weather: { icon: <CloudSun size={16} weight="fill" />, color: "text-sky-400", border: "border-sky-500/40", activeBg: "bg-sky-500/80" },
    Other: { icon: <Crosshair size={16} weight="fill" />, color: "text-gray-400", border: "border-gray-500/40", activeBg: "bg-gray-500/80" },
  };

  const optColors = ["text-[#00e5a0] border-[#00e5a0]/40", "text-[#00b4d8] border-[#00b4d8]/40", "text-orange-400 border-orange-500/40", "text-pink-400 border-pink-500/40", "text-purple-400 border-purple-500/40", "text-teal-400 border-teal-500/40", "text-yellow-400 border-yellow-500/40", "text-red-400 border-red-500/40", "text-sky-400 border-sky-500/40", "text-indigo-400 border-indigo-500/40"];

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* Terminal window wrapper */}
          <div className="bg-[var(--card)] border-2 border-[var(--card-border)] rounded-none overflow-hidden">

            {/* Terminal title bar */}
            <div className="bg-[var(--background)] border-b-2 border-[var(--card-border)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-[var(--accent)]/70" />
                </div>
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[var(--accent)]" />
                  <span className="text-xs font-mono text-[var(--accent)] tracking-wider">
                    NEW_MARKET.exe
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Lightning size={12} weight="fill" className="text-yellow-500 animate-pulse" />
                <span className="text-[10px] font-mono text-[var(--muted)]">
                  {locale === "sw" ? "ADA" : "READY"}
                </span>
              </div>
            </div>

            {/* Terminal body */}
            <div className="p-6 space-y-0">

              {/* Boot sequence header */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6 font-mono"
              >
                <p className="text-[var(--accent)] text-xs mb-1">
                  <span className="text-[var(--muted)]">[SYS]</span> {t.markets.createMarket.title}
                </p>
                <p className="text-[var(--muted)] text-xs mb-3">{t.markets.createMarket.subtitle}</p>
                <div className="h-px bg-gradient-to-r from-[var(--accent)]/50 via-[var(--accent)]/20 to-transparent" />
              </motion.div>

              {/* Fee notice — terminal style */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-6 p-3 border border-yellow-500/30 bg-yellow-500/5"
              >
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={14} weight="fill" className="text-yellow-500" />
                  <span className="text-xs font-mono text-yellow-500">
                    [FEE] {t.markets.createMarket.fee}: <span className="font-bold text-yellow-400">{CREATION_FEE_TZS.toLocaleString()} TZS</span>
                  </span>
                </div>
                <p className="text-[10px] font-mono text-[var(--muted)] mt-1 ml-6">{t.markets.createMarket.feeDescription}</p>
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-6 p-3 border border-red-500/40 bg-red-500/5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-red-400">
                    <Info size={14} weight="fill" />
                    <span>[ERR] {error}</span>
                  </div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── CATEGORY ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-3 uppercase tracking-wider">
                    <Crosshair size={12} weight="bold" />
                    {t.markets.createMarket.category}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map((c) => {
                      const catKey = c.toLowerCase() as keyof typeof t.markets.createMarket.categories;
                      const label = t.markets.createMarket.categories?.[catKey] || c;
                      const cfg = catConfig[c] || catConfig.Other;
                      const isActive = form.category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, category: c, subCategory: "" })}
                          className={cn(
                            "relative py-2.5 px-3 text-xs font-mono font-bold transition-all flex items-center gap-2",
                            isActive
                              ? `border-2 ${cfg.border} ${cfg.activeBg} text-white shadow-[0_0_15px_rgba(0,229,160,0.08)]`
                              : "border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/30 bg-[var(--background)]"
                          )}
                        >
                          <span className={isActive ? "text-white" : ""}>{cfg.icon}</span>
                          {label}
                          {isActive && (
                            <motion.div
                              layoutId="activeCat"
                              className="absolute top-0 right-0 w-1.5 h-1.5 bg-[var(--accent)]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* ── SPORTS SUB-CATEGORY ── */}
                {form.category === "Sports" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-[#00e5a0]/20 bg-[#00e5a0]/5 p-4"
                  >
                    <label className="flex items-center gap-2 text-[10px] font-mono text-[#00e5a0] mb-3 uppercase tracking-wider">
                      <SoccerBall size={10} weight="bold" />
                      {locale === "sw" ? "Ligi" : "League"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SPORTS_SUBCATEGORIES.map((sub) => {
                        const isActive = form.subCategory === sub.value;
                        return (
                          <button
                            key={sub.value}
                            type="button"
                            onClick={() => setForm({ ...form, subCategory: sub.value })}
                            className={cn(
                              "py-2.5 px-3 text-xs font-mono font-bold transition-all flex items-center gap-2",
                              isActive
                                ? "border-2 border-[#00e5a0]/50 bg-[#00e5a0] text-white shadow-[0_0_15px_rgba(0,229,160,0.15)]"
                                : "border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[#00e5a0]/30 bg-[var(--background)]"
                            )}
                          >
                            <span>{sub.icon}</span>
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* ── MARKET TYPE ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-3 uppercase tracking-wider">
                    <ListBullets size={12} weight="bold" />
                    {locale === "sw" ? "Aina ya Soko" : "Market Type"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMarketType("binary")}
                      className={cn(
                        "py-3 text-sm font-mono font-bold transition-all",
                        marketType === "binary"
                          ? "border-2 border-[var(--accent)]/50 bg-[var(--background)] shadow-[0_0_15px_rgba(0,229,160,0.08)]"
                          : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]/30 bg-[var(--background)]"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <CheckSquare size={14} weight="fill" className={marketType === "binary" ? "text-[var(--accent)]" : ""} />
                        <span className={marketType === "binary" ? "text-[#00e5a0]" : ""}>YES</span>
                        <span className="text-[var(--muted)]">/</span>
                        <span className={marketType === "binary" ? "text-red-400" : ""}>NO</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarketType("multi")}
                      className={cn(
                        "py-3 text-sm font-mono font-bold transition-all",
                        marketType === "multi"
                          ? "border-2 border-purple-500/50 bg-[var(--background)] shadow-[0_0_15px_rgba(168,85,247,0.08)]"
                          : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]/30 bg-[var(--background)]"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <ListBullets size={14} weight="fill" className={marketType === "multi" ? "text-purple-400" : ""} />
                        <span className={marketType === "multi" ? "text-purple-400" : ""}>
                          {locale === "sw" ? "CHAGUZI" : "MULTI"}
                        </span>
                      </div>
                    </button>
                  </div>
                </motion.div>

                {/* Custom Options */}
                {marketType === "multi" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-purple-500/20 bg-purple-500/5 p-4 space-y-2"
                  >
                    <label className="flex items-center gap-2 text-[10px] font-mono text-purple-400 mb-2 uppercase tracking-wider">
                      <ListBullets size={10} weight="bold" />
                      {locale === "sw" ? "Chaguzi" : "Options"} ({customOptions.filter(o => o.trim()).length}/{customOptions.length})
                    </label>
                    {customOptions.map((opt, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-2"
                      >
                        <span className={cn("w-7 h-7 flex items-center justify-center text-[10px] font-mono font-black border", optColors[i % optColors.length])}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(i, e.target.value)}
                          placeholder={`${locale === "sw" ? "Chaguo" : "Option"} ${String.fromCharCode(65 + i)}...`}
                          className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                          maxLength={100}
                        />
                        {customOptions.length > 2 && (
                          <button type="button" onClick={() => removeOption(i)} className="p-1.5 text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash size={14} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                    {customOptions.length < 10 && (
                      <button
                        type="button"
                        onClick={addOption}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-purple-500/30 text-xs font-mono text-purple-400 hover:text-purple-300 hover:border-purple-500/50 transition-all w-full justify-center"
                      >
                        <Plus size={12} weight="bold" />
                        {locale === "sw" ? "ONGEZA" : "ADD_OPTION"}
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Pyth integration */}
                {isCrypto && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-orange-500/20 bg-orange-500/5 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <ChartLine size={14} weight="fill" className="text-orange-400" />
                      <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">Pyth Price Feed</span>
                    </div>
                    <p className="text-[10px] font-mono text-[var(--muted)]">
                      Auto-resolve based on live Pyth price feeds. Title auto-generated if blank.
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono text-[var(--muted)] mb-1 uppercase">Asset</label>
                        <select
                          value={pythConfig.symbol}
                          onChange={(e) => setPythConfig({ ...pythConfig, symbol: e.target.value })}
                          className="w-full px-2 py-2 bg-[var(--background)] border border-orange-500/20 text-sm font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                        >
                          {CRYPTO_SYMBOLS.map((s) => (
                            <option key={s.symbol} value={s.symbol}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-[var(--muted)] mb-1 uppercase">Target $</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={pythConfig.targetPrice}
                          onChange={(e) => setPythConfig({ ...pythConfig, targetPrice: e.target.value })}
                          className="w-full px-2 py-2 bg-[var(--background)] border border-orange-500/20 text-sm font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                          placeholder="100000"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-[var(--muted)] mb-1 uppercase">Condition</label>
                        <select
                          value={pythConfig.operator}
                          onChange={(e) => setPythConfig({ ...pythConfig, operator: e.target.value as "above" | "below" })}
                          className="w-full px-2 py-2 bg-[var(--background)] border border-orange-500/20 text-sm font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                        >
                          <option value="above">Above / ≥</option>
                          <option value="below">Below / ≤</option>
                        </select>
                      </div>
                    </div>

                    {pythConfig.targetPrice && (
                      <div className="text-[10px] font-mono text-[var(--muted)] border border-orange-500/20 px-2 py-1.5 bg-[var(--background)]">
                        <span className="text-orange-400">[AUTO] </span>
                        Will {pythConfig.symbol} be {pythConfig.operator === "above" ? "≥" : "≤"} ${parseFloat(pythConfig.targetPrice || "0").toLocaleString()} USD?
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--card-border)] to-transparent" />

                {/* ── QUESTION ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">
                    <TextT size={12} weight="bold" />
                    {t.markets.createMarket.question}
                    {isCrypto && <span className="text-[var(--muted)] normal-case">(auto for crypto)</span>}
                  </label>
                  <textarea
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50 focus:shadow-[0_0_15px_rgba(0,229,160,0.05)] transition-all resize-none placeholder:text-[var(--muted)]/50"
                    placeholder={
                      isCrypto
                        ? "Will BTC reach $100,000 by end of 2025?"
                        : "Will CCM win the 2025 Tanzanian general election?"
                    }
                    rows={2}
                    maxLength={200}
                    required={!isCrypto}
                  />
                  <p className={cn("text-[10px] font-mono mt-1 text-right", form.title.length > 180 ? "text-red-400" : "text-[var(--muted)]")}>
                    {form.title.length}/200
                  </p>
                </motion.div>

                {/* ── DESCRIPTION ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">
                    <AlignLeft size={12} weight="bold" />
                    {t.markets.createMarket.description}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--accent)]/50 focus:shadow-[0_0_15px_rgba(0,229,160,0.05)] transition-all resize-none placeholder:text-[var(--muted)]/50"
                    placeholder="Describe the market and how it will be resolved..."
                    rows={3}
                    required
                  />
                </motion.div>

                {/* ── RESOLUTION DATE ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">
                    <CalendarBlank size={12} weight="bold" />
                    {t.markets.createMarket.resolutionDate}
                  </label>
                  
                  <TerminalDatePicker
                    selected={form.resolvesAt ? new Date(form.resolvesAt) : new Date(defaultDate)}
                    onChange={(date) => setForm({ ...form, resolvesAt: date ? date.toISOString().slice(0, 16) : "" })}
                    minDate={new Date()}
                    locale={locale}
                  />
                  
                  <p className="text-[10px] font-mono text-[var(--muted)] mt-1">{t.markets.createMarket.resolutionDateHint}</p>
                </motion.div>

                {/* ── COVER IMAGE ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">
                    <ImageIcon size={12} weight="bold" />
                    {t.markets.createMarket.coverImage}
                    <span className="text-[var(--muted)] normal-case">{locale === "sw" ? "(hiari)" : "(optional)"}</span>
                  </label>

                  {(imagePreview || form.imageUrl) && (
                    <div className="relative mb-3 overflow-hidden aspect-video bg-black/30 border-2 border-[var(--card-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview || form.imageUrl}
                        alt="Cover preview"
                        className="w-full h-full object-contain"
                      />
                      {/* Scanline overlay */}
                      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.05)_2px,rgba(0,0,0,0.05)_4px)] pointer-events-none" />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-red-500/80 hover:bg-red-500 transition-colors border border-red-500"
                      >
                        <X size={12} weight="bold" className="text-white" />
                      </button>
                    </div>
                  )}

                  {!(imagePreview || form.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-[var(--card-border)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/3 transition-all group"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors" />
                        <p className="text-xs font-mono text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                          {locale === "sw" ? "BOFYA_KUPAKIA" : "CLICK_TO_UPLOAD"}
                        </p>
                        <p className="text-[10px] font-mono text-[var(--muted)]">JPEG · PNG · GIF · WebP — 5 MB max</p>
                      </div>
                    </button>
                  )}

                  {(imagePreview || form.imageUrl) && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2 border border-[var(--card-border)] text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]/40 transition-colors mt-2"
                    >
                      <Upload size={12} />
                      {locale === "sw" ? "BADILISHA" : "CHANGE_IMAGE"}
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {!imageFile && (
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => {
                        setForm({ ...form, imageUrl: e.target.value });
                        if (e.target.value) { setImageFile(null); setImagePreview(""); }
                      }}
                      className="w-full mt-2 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-xs font-mono focus:outline-none focus:border-[var(--accent)]/50 transition-colors placeholder:text-[var(--muted)]/50"
                      placeholder={locale === "sw" ? "au_bandika_url: https://..." : "or_paste_url: https://..."}
                    />
                  )}
                </motion.div>

                {/* Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent" />

                {/* ── LIVE PREVIEW ── */}
                {(form.title || (isCrypto && pythConfig.targetPrice)) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-[var(--accent)]/30 bg-[var(--background)]"
                  >
                    {/* Preview title bar */}
                    <div className="bg-[var(--accent)]/5 border-b border-[var(--accent)]/20 px-3 py-2 flex items-center gap-2">
                      <Eye size={12} weight="fill" className="text-[var(--accent)]" />
                      <span className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider">
                        {locale === "sw" ? "Hakiki" : "Preview"}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border", catConfig[form.category]?.color || "text-[var(--muted)]", catConfig[form.category]?.border || "border-[var(--card-border)]")}>
                          [{form.category}]
                        </span>
                        {isCrypto && (
                          <span className="text-[10px] font-mono text-orange-400 border border-orange-500/30 px-1.5 py-0.5">PYTH</span>
                        )}
                      </div>
                      <p className="font-bold text-sm mb-3">
                        {form.title ||
                          (isCrypto && pythConfig.targetPrice
                            ? `Will ${pythConfig.symbol} be ${pythConfig.operator === "above" ? "≥" : "≤"} $${parseFloat(pythConfig.targetPrice).toLocaleString()} USD by resolution?`
                            : "")}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                        {marketType === "multi" && customOptions.filter(o => o.trim()).length >= 2 ? (
                          customOptions.filter(o => o.trim()).map((opt, i) => (
                            <span key={i} className={cn("px-2 py-0.5 border", optColors[i % optColors.length])}>
                              {opt.trim().slice(0, 15)} {Math.round(100 / customOptions.filter(o => o.trim()).length)}%
                            </span>
                          ))
                        ) : (
                          <>
                            <span className="px-2 py-0.5 border border-[#00e5a0]/30 text-[#00e5a0]">YES 50%</span>
                            <span className="px-2 py-0.5 border border-red-500/30 text-red-400">NO 50%</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── SUBMIT ── */}
                <motion.button
                  type="submit"
                  disabled={loading || uploadingImage}
                  whileHover={{ scale: loading ? 1 : 1.005 }}
                  whileTap={{ scale: loading ? 1 : 0.995 }}
                  className={cn(
                    "w-full py-4 font-mono font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all border-2",
                    loading || uploadingImage
                      ? "border-[var(--card-border)] text-[var(--muted)] bg-[var(--background)]"
                      : "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5 hover:bg-[var(--accent)] hover:text-[var(--background)] shadow-[0_0_20px_rgba(0,229,160,0.1)] hover:shadow-[0_0_30px_rgba(0,229,160,0.2)]"
                  )}
                >
                  {loading || uploadingImage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
                      {uploadingImage ? (locale === "sw" ? "INAPAKIA..." : "UPLOADING...") : (locale === "sw" ? "INAUNDA..." : "CREATING...")}
                    </>
                  ) : (
                    <>
                      <Lightning size={16} weight="fill" />
                      {t.markets.createMarket.submit} · {CREATION_FEE_TZS.toLocaleString()} TZS
                      <CaretRight size={16} weight="bold" />
                    </>
                  )}
                </motion.button>

              </form>
            </div>

            {/* Terminal footer bar */}
            <div className="bg-[var(--background)] border-t-2 border-[var(--card-border)] px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--muted)]">
                [{form.category.toUpperCase()}] {marketType === "multi" ? `${customOptions.filter(o => o.trim()).length} opts` : "YES/NO"} · {form.title.length} chars
              </span>
              <span className="text-[10px] font-mono text-[var(--accent)]">
                ● {locale === "sw" ? "TAYARI" : "ONLINE"}
              </span>
            </div>
          </div>

        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
