"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { motion } from "framer-motion";
import { CATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CalendarBlank, Image as ImageIcon, CaretRight, Info,
  CurrencyDollar, Upload, X, ChartLine, Plus, Trash,
} from "@phosphor-icons/react";
import { CRYPTO_SYMBOLS } from "@/lib/pyth";

const CREATION_FEE_TZS = 2000;

export default function CreateMarketPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Politics",
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

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{t.markets.createMarket.title}</h1>
            <p className="text-[var(--muted)]">{t.markets.createMarket.subtitle}</p>
          </div>

          {/* Creation fee notice */}
          <div className="mb-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <CurrencyDollar size={18} weight="fill" className="text-[var(--accent)]" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-[var(--foreground)] mb-0.5">
                {t.markets.createMarket.fee}: {CREATION_FEE_TZS.toLocaleString()} TZS
              </p>
              <p className="text-[var(--muted)]">
                {t.markets.createMarket.feeDescription}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category first so Pyth can show early */}
            <div>
              <label className="block font-semibold mb-3">{t.markets.createMarket.category}</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const catKey = c.toLowerCase() as keyof typeof t.markets.createMarket.categories;
                  const label = t.markets.createMarket.categories?.[catKey] || c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-mono transition-all",
                        form.category === c
                          ? "border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold"
                          : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Market Type Toggle */}
            <div>
              <label className="block font-semibold mb-3">
                {locale === "sw" ? "Aina ya Soko" : "Market Type"}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMarketType("binary")}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-mono font-bold transition-all",
                    marketType === "binary"
                      ? "border-2 border-[var(--foreground)] text-[var(--foreground)]"
                      : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]"
                  )}
                >
                  {locale === "sw" ? "NDIO / HAPANA" : "YES / NO"}
                </button>
                <button
                  type="button"
                  onClick={() => setMarketType("multi")}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-mono font-bold transition-all",
                    marketType === "multi"
                      ? "border-2 border-[var(--foreground)] text-[var(--foreground)]"
                      : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]"
                  )}
                >
                  {locale === "sw" ? "Chaguzi Maalum" : "Custom Options"}
                </button>
              </div>
            </div>

            {/* Custom Options — only for multi-option markets */}
            {marketType === "multi" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <label className="block font-semibold">
                  {locale === "sw" ? "Chaguzi" : "Options"} <span className="text-red-400">*</span>
                  <span className="text-xs font-normal text-[var(--muted)] ml-1">
                    ({locale === "sw" ? "angalau 2, kiwango cha juu 10" : "min 2, max 10"})
                  </span>
                </label>
                {customOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-xs font-bold font-mono text-[var(--muted)]">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`${locale === "sw" ? "Chaguo" : "Option"} ${String.fromCharCode(65 + i)}...`}
                      className="flex-1 px-4 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                      maxLength={100}
                    />
                    {customOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {customOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-[var(--card-border)] rounded-xl text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all w-full justify-center"
                  >
                    <Plus size={14} />
                    {locale === "sw" ? "Ongeza Chaguo" : "Add Option"}
                  </button>
                )}
              </motion.div>
            )}

            {/* Pyth integration — only for Crypto category */}
            {isCrypto && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-[#00b4d8]/5 border border-[#00b4d8]/20 rounded-xl space-y-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ChartLine size={16} weight="fill" className="text-[#00b4d8]" />
                  <span className="text-sm font-bold text-[#00b4d8]">Pyth Price Feed — Auto-Resolution</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Crypto markets can auto-resolve based on live Pyth price feeds. The title will be
                  auto-generated if left blank.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[var(--muted)]">Asset</label>
                    <select
                      value={pythConfig.symbol}
                      onChange={(e) => setPythConfig({ ...pythConfig, symbol: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[#00b4d8] transition-colors"
                    >
                      {CRYPTO_SYMBOLS.map((s) => (
                        <option key={s.symbol} value={s.symbol}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[var(--muted)]">Target Price (USD)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={pythConfig.targetPrice}
                      onChange={(e) => setPythConfig({ ...pythConfig, targetPrice: e.target.value })}
                      className="w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[#00b4d8] transition-colors"
                      placeholder="e.g. 100000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[var(--muted)]">Condition</label>
                    <select
                      value={pythConfig.operator}
                      onChange={(e) => setPythConfig({ ...pythConfig, operator: e.target.value as "above" | "below" })}
                      className="w-full px-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[#00b4d8] transition-colors"
                    >
                      <option value="above">Above / ≥</option>
                      <option value="below">Below / ≤</option>
                    </select>
                  </div>
                </div>

                {pythConfig.targetPrice && (
                  <p className="text-xs bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-[var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Auto-title: </span>
                    Will {pythConfig.symbol} be {pythConfig.operator === "above" ? "≥" : "≤"} ${parseFloat(pythConfig.targetPrice || "0").toLocaleString()} USD by resolution?
                  </p>
                )}
              </motion.div>
            )}

            {/* Title */}
            <div>
              <label className="block font-semibold mb-2">
                {t.markets.createMarket.question} <span className="text-red-400">*</span>
                {isCrypto && <span className="text-xs font-normal text-[var(--muted)] ml-1">({locale === "sw" ? "inajengwa kiotomatiki kwa crypto" : "auto-generated for crypto"})</span>}
              </label>
              <textarea
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                placeholder={
                  isCrypto
                    ? "Will BTC reach $100,000 by end of 2025?"
                    : "Will CCM win the 2025 Tanzanian general election?"
                }
                rows={3}
                maxLength={200}
                required={!isCrypto}
              />
              <p className="text-xs text-[var(--muted)] mt-1 text-right">{form.title.length}/200</p>
            </div>

            {/* Description */}
            <div>
              <label className="block font-semibold mb-2">
                {t.markets.createMarket.description} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                placeholder="Describe the market and how it will be resolved. Be specific about what constitutes YES vs NO."
                rows={4}
                required
              />
            </div>

            {/* Resolution date */}
            <div>
              <label className="block font-semibold mb-2">
                <CalendarBlank size={15} className="inline mr-1" />
                {t.markets.createMarket.resolutionDate} <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.resolvesAt || defaultDate}
                onChange={(e) => setForm({ ...form, resolvesAt: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-[var(--muted)] mt-1">{t.markets.createMarket.resolutionDateHint}</p>
            </div>

            {/* Cover image — URL or file upload */}
            <div>
              <label className="block font-semibold mb-2">
                <ImageIcon size={15} className="inline mr-1" />
                {t.markets.createMarket.coverImage}
              </label>

              {/* Image preview */}
              {(imagePreview || form.imageUrl) && (
                <div className="relative mb-3 rounded-xl overflow-hidden aspect-video bg-[var(--card)] border border-[var(--card-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview || form.imageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                {/* File upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium hover:border-[var(--accent)]/40 transition-colors shrink-0"
                >
                  <Upload size={14} />
                  {locale === "sw" ? "Pakia" : "Upload"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* URL input */}
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => {
                    setForm({ ...form, imageUrl: e.target.value });
                    if (e.target.value) {
                      setImageFile(null);
                      setImagePreview("");
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder={locale === "sw" ? "Au bandika URL ya picha: https://..." : "Or paste image URL: https://..."}
                  disabled={!!imageFile}
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">{locale === "sw" ? "JPEG, PNG, GIF au WebP. Hadi 5 MB." : "JPEG, PNG, GIF or WebP. Max 5 MB."}</p>
            </div>

            {/* Preview */}
            {(form.title || (isCrypto && pythConfig.targetPrice)) && (
              <div className="p-4 bg-[var(--card)] border border-[var(--card-border)] rounded-xl">
                <p className="text-xs text-[var(--muted)] mb-2 font-medium uppercase tracking-wider">{locale === "sw" ? "Hakiki" : "Preview"}</p>
                <p className="font-semibold text-sm mb-2">
                  {form.title ||
                    (isCrypto && pythConfig.targetPrice
                      ? `Will ${pythConfig.symbol} be ${pythConfig.operator === "above" ? "≥" : "≤"} $${parseFloat(pythConfig.targetPrice).toLocaleString()} USD by resolution?`
                      : "")}
                </p>
                <div className="flex gap-3 text-xs">
                  <span className="px-2 py-0.5 bg-[var(--card)] text-[var(--foreground)] rounded-full border border-[var(--card-border)]">
                    {form.category}
                  </span>
                  {marketType === "multi" && customOptions.filter(o => o.trim()).length >= 2 ? (
                    <span className="text-[var(--muted)]">
                      {customOptions.filter(o => o.trim()).map((opt, i) => (
                        <span key={i}>
                          {opt.trim().slice(0, 12)}{opt.trim().length > 12 ? "…" : ""} {Math.round(100 / customOptions.filter(o => o.trim()).length)}%
                          {i < customOptions.filter(o => o.trim()).length - 1 ? " • " : ""}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">YES 50% • NO 50%</span>
                  )}
                  {isCrypto && (
                    <span className="px-2 py-0.5 bg-[#00b4d8]/10 text-[#00b4d8] rounded-full border border-[#00b4d8]/20">
                      Pyth Auto-Resolve
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] font-bold font-mono rounded-xl hover:opacity-80 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg tracking-wider uppercase"
            >
              {loading || uploadingImage
                ? uploadingImage ? (locale === "sw" ? "Inapakia picha…" : "Uploading image…") : (locale === "sw" ? "Inaunda…" : "Creating…")
                : `${t.markets.createMarket.submit} · ${CREATION_FEE_TZS.toLocaleString()} TZS`}
              {!loading && !uploadingImage && <CaretRight size={20} />}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
