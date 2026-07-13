"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { motion } from "framer-motion";
import { CATEGORIES, SPORTS_SUBCATEGORIES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { convertCurrency, getUserCurrency, type Currency } from "@/lib/currency";
import { useCurrency } from "@/store/useCurrency";
import { Footer } from "@/components/Footer";
import {
  CalendarBlank, Image as ImageIcon, CaretRight, Info,
  CurrencyDollar, Upload, X, ChartLine, Plus, Trash,
  Bank, SoccerBall, FilmSlate, CurrencyBtc, Briefcase,
  Flask, CloudSun, Crosshair, Terminal, Lightning,
  CheckSquare, ListBullets, TextT, AlignLeft, Eye, Globe,
  Calendar, Stack,
} from "@phosphor-icons/react";
import { ALL_PYTH_SYMBOLS } from "@/lib/pyth";
import { TerminalDatePicker } from "@/components/TerminalDatePicker";
import { LogoUploadSlot } from "@/components/LogoUploadSlot";

const CREATION_FEE_TZS = 2000;
const USDC_TO_TZS_RATE = 2630;

export default function CreateMarketPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const { currency: displayCurrency } = useCurrency();
  
  // Currency detection for Kenya/Tanzania users
  const userCurrency: Currency = getUserCurrency(user?.country, user?.phone);
  const isKenya = userCurrency === 'KES';
  
  // Display fee in user's selected currency
  const CREATION_FEE_DISPLAY = displayCurrency === 'USDC'
    ? '$1.00' // Round to $1 for simplicity
    : isKenya 
      ? `${Math.round(CREATION_FEE_TZS / 18.5).toLocaleString()} KES` 
      : `${CREATION_FEE_TZS.toLocaleString()} TZS`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Politics",
    subCategory: "",
    resolvesAt: "",
    imageUrl: "",
  });

  // Initial probability for binary markets (1–99, default 50)
  const [initialProb, setInitialProb] = useState(50);

  // Optional liquidity seed: creator deposits real TZS to back the market pot
  const [seedAmount, setSeedAmount] = useState("");
  const [seedDistribution, setSeedDistribution] = useState<"equal" | "proportional">("equal");

  // Market type: "binary" (YES/NO), "multi" (custom options), or "event" (multiple markets)
  const [marketType, setMarketType] = useState<"binary" | "multi" | "event">("binary");
  const [customOptions, setCustomOptions] = useState<string[]>(["", ""]);
  // Per-option probabilities for multi-option markets (must sum to 100)
  const [optionProbs, setOptionProbs] = useState<number[]>([50, 50]);
  // Per-option image URLs (uploaded on submit or pasted), index-aligned with options.
  const [optionImages, setOptionImages] = useState<string[]>(["", ""]);
  const [optionImageFiles, setOptionImageFiles] = useState<(File | null)[]>([null, null]);

  async function handleOptionImageSelect(index: number, file: File | null) {
    const files = [...optionImageFiles];
    files[index] = file;
    setOptionImageFiles(files);
    if (file) {
      const imgs = [...optionImages];
      imgs[index] = URL.createObjectURL(file); // local preview until uploaded on submit
      setOptionImages(imgs);
    }
  }

  // Event markets (when marketType === "event")
  interface EventMarket {
    id: string;
    title: string;
    type: "binary" | "multi";
    options?: string[];
    optionProbs?: number[];
    initialProb?: number;
    // Local preview URLs (blob:) or files; uploaded on event submit. Binary: [0]=YES,[1]=NO.
    optionImages?: string[];
    optionImageFiles?: (File | null)[];
  }
  const [eventMarkets, setEventMarkets] = useState<EventMarket[]>([]);
  const [newEventMarket, setNewEventMarket] = useState<{ title: string; type: "binary" | "multi"; options: string[]; optionProbs: number[]; initialProb: number; optionImages: string[]; optionImageFiles: (File | null)[] }>({ title: "", type: "binary", options: ["", ""], optionProbs: [50, 50], initialProb: 50, optionImages: ["", ""], optionImageFiles: [null, null] });

  function setEventMarketLogo(idx: number, file: File | null) {
    setNewEventMarket(prev => {
      const files = [...prev.optionImageFiles]; files[idx] = file;
      const imgs = [...prev.optionImages]; if (file) imgs[idx] = URL.createObjectURL(file);
      return { ...prev, optionImageFiles: files, optionImages: imgs };
    });
  }

  const newEventProbsTotal = newEventMarket.optionProbs
    .slice(0, newEventMarket.options.length)
    .reduce((s, p) => s + (p || 0), 0);

  const optionProbsTotal = optionProbs.reduce((s, p) => s + p, 0);

  function addOption() {
    if (customOptions.length >= 10) return;
    setCustomOptions([...customOptions, ""]);
    setOptionProbs([...optionProbs, 0]);
    setOptionImages([...optionImages, ""]);
    setOptionImageFiles([...optionImageFiles, null]);
  }

  function removeOption(index: number) {
    if (customOptions.length <= 2) return;
    setCustomOptions(customOptions.filter((_, i) => i !== index));
    setOptionProbs(optionProbs.filter((_, i) => i !== index));
    setOptionImages(optionImages.filter((_, i) => i !== index));
    setOptionImageFiles(optionImageFiles.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...customOptions];
    updated[index] = value;
    setCustomOptions(updated);
  }

  function updateOptionProb(index: number, value: number) {
    const updated = [...optionProbs];
    updated[index] = Math.max(1, Math.min(98, value));
    setOptionProbs(updated);
  }

  // Distribute remaining probability evenly across all options
  function distributeEvenly() {
    const n = customOptions.length;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    setOptionProbs(optionProbs.map((_, i) => base + (i < remainder ? 1 : 0)));
  }

  // Pyth-specific state (only for FX & Commodities markets)
  const [fxMode, setFxMode] = useState<"pyth" | "custom">("pyth");
  const [fxRate, setFxRate] = useState(""); // Optional current rate for custom FX markets
  const [pythConfig, setPythConfig] = useState({
    symbol: "EUR/USD",
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

  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (Vercel limit is 4.5MB)

  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Max dimensions
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = (height / width) * MAX_DIM;
            width = MAX_DIM;
          } else {
            width = (width / height) * MAX_DIM;
            height = MAX_DIM;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      // Try to compress
      setError(locale === "sw" ? "Inapunguza ukubwa wa picha..." : "Compressing image...");
      const compressed = await compressImage(file);
      if (compressed.size > MAX_FILE_SIZE) {
        setError(locale === "sw" ? "Picha kubwa sana. Tumia picha chini ya 4MB." : "Image too large. Please use an image under 4MB.");
        return;
      }
      setError("");
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } else {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
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

    if (form.category === "FX & Commodities" && fxMode === "pyth" && !pythConfig.targetPrice) {
      return setError("Set a target price for FX & Commodities market auto-resolution");
    }

    // Event validation
    if (marketType === "event") {
      if (!form.title) return setError(locale === "sw" ? "Weka jina la tukio" : "Enter event name");
      if (eventMarkets.length === 0) return setError(locale === "sw" ? "Ongeza angalau soko 1" : "Add at least 1 market");
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

      // EVENT CREATION FLOW
      if (marketType === "event") {
        // Step 1: Create the event
        const eventRes = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            category: form.category,
            subCategory: form.subCategory,
            imageUrl: finalImageUrl,
            startsAt: form.resolvesAt,
          }),
        });
        const eventData = await eventRes.json();
        if (!eventRes.ok) return setError(eventData.error || "Failed to create event");

        const eventId = eventData.event.id;

        // Step 2: Create each market under the event
        for (const market of eventMarkets) {
          // Upload any per-side/per-option logo files for this sub-market.
          let marketOptionImages: string[] | undefined;
          if (market.optionImages?.some(Boolean) || market.optionImageFiles?.some(Boolean)) {
            const uploaded: string[] = [];
            for (let i = 0; i < (market.optionImages?.length || 0); i++) {
              const file = market.optionImageFiles?.[i];
              if (file) {
                const fd = new FormData();
                fd.append("file", file);
                try {
                  const r = await fetch("/api/upload", { method: "POST", body: fd });
                  const d = await r.json();
                  uploaded.push(r.ok ? d.url : "");
                } catch { uploaded.push(""); }
              } else {
                const u = market.optionImages?.[i] || "";
                uploaded.push(u.startsWith("blob:") ? "" : u);
              }
            }
            if (uploaded.some(Boolean)) marketOptionImages = uploaded;
          }
          const mRes = await fetch(`/api/events/${eventId}/markets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: market.title,
              resolvesAt: form.resolvesAt,
              options: market.type === "multi" ? market.options : undefined,
              optionProbs: market.type === "multi" ? market.optionProbs : undefined,
              initialProb: market.type === "binary" ? market.initialProb : undefined,
              optionImages: marketOptionImages,
            }),
          });
          if (!mRes.ok) {
            const mErr = await mRes.json().catch(() => ({}));
            setLoading(false);
            return setError(mErr.error || `Failed to create market "${market.title}"`);
          }
        }

        router.push(`/events/${eventId}`);
        return;
      }

      // REGULAR MARKET CREATION FLOW
      const body: Record<string, unknown> = {
        ...form,
        imageUrl: finalImageUrl,
        resolvesAt: form.resolvesAt || defaultDate,
      };

      // Add initial probability for binary markets
      if (marketType === "binary") {
        body.initialProb = initialProb;
        // Optional per-side logos: [0] = YES, [1] = NO. Upload files if picked.
        const sideImages: string[] = [];
        for (const idx of [0, 1]) {
          const file = optionImageFiles[idx];
          if (file) {
            const fd = new FormData();
            fd.append("file", file);
            try {
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const data = await res.json();
              sideImages.push(res.ok ? data.url : "");
            } catch { sideImages.push(""); }
          } else {
            const u = optionImages[idx] || "";
            sideImages.push(u.startsWith("blob:") ? "" : u);
          }
        }
        if (sideImages.some(Boolean)) body.optionImages = sideImages;
      }

      // Add custom options for multi-option markets
      if (marketType === "multi") {
        const validOptions = customOptions.map(o => o.trim()).filter(Boolean);
        if (validOptions.length < 2) {
          setLoading(false);
          return setError(locale === "sw" ? "Ongeza angalau chaguzi 2" : "Add at least 2 options");
        }
        // Validate probabilities sum to 100
        const probsForValid = optionProbs.slice(0, validOptions.length);
        const probSum = probsForValid.reduce((s, p) => s + p, 0);
        if (Math.abs(probSum - 100) > 1) {
          setLoading(false);
          return setError(locale === "sw" ? `Uwezekano lazima uwe 100% (sasa: ${probSum}%)` : `Probabilities must sum to 100% (currently: ${probSum}%)`);
        }
        body.options = validOptions;
        body.optionProbs = probsForValid;

        // Upload any per-option image files, then pass the URL list (index-aligned
        // with the valid options). Files upload; otherwise a pasted URL is used.
        const keptIdx = customOptions.map((o, i) => ({ o: o.trim(), i })).filter(x => x.o).map(x => x.i);
        const finalOptionImages: string[] = [];
        for (const i of keptIdx) {
          const file = optionImageFiles[i];
          if (file) {
            const fd = new FormData();
            fd.append("file", file);
            try {
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const data = await res.json();
              finalOptionImages.push(res.ok ? data.url : "");
            } catch { finalOptionImages.push(""); }
          } else {
            // pasted URL (ignore blob: preview URLs)
            const u = optionImages[i] || "";
            finalOptionImages.push(u.startsWith("blob:") ? "" : u);
          }
        }
        if (finalOptionImages.some(Boolean)) body.optionImages = finalOptionImages;
      }

      // Add optional fxRate for custom FX markets
      if (form.category === "FX & Commodities" && fxMode === "custom" && fxRate) {
        const parsedRate = parseFloat(fxRate);
        if (!isNaN(parsedRate) && parsedRate > 0) body.fxRate = parsedRate;
      }

      // Add Pyth data for FX & Commodities markets (only in pyth mode)
      if (form.category === "FX & Commodities" && fxMode === "pyth" && pythConfig.targetPrice) {
        body.pythSymbol = pythConfig.symbol;
        body.pythTargetPrice = parseFloat(pythConfig.targetPrice);
        body.pythOperator = pythConfig.operator;
        // Auto-generate title from Pyth config if title is empty
        if (!body.title) {
          body.title = `Will ${pythConfig.symbol} be ${pythConfig.operator} $${parseFloat(pythConfig.targetPrice).toLocaleString()} USD by resolution?`;
        }
      }

      // Add optional seed — convert USDC to TZS if needed
      const parsedSeedRaw = parseFloat(seedAmount.replace(/,/g, ""));
      if (!isNaN(parsedSeedRaw) && parsedSeedRaw > 0) {
        const seedTzs = displayCurrency === 'USDC'
          ? Math.round(parsedSeedRaw * USDC_TO_TZS_RATE)
          : Math.round(parsedSeedRaw);
        const minSeedTzs = displayCurrency === 'USDC' ? Math.round(0.5 * USDC_TO_TZS_RATE) : 1000; // $0.50 min for USDC
        if (seedTzs >= minSeedTzs) {
          body.seedAmount = seedTzs;
          body.seedCurrency = displayCurrency;
          body.seedDistribution = seedDistribution;
        }
      }

      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      // Handle non-JSON responses (e.g., Vercel error pages)
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        return setError("Server error. Please try again later.");
      }
      
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to create market");
      router.push(`/markets/${data.market.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const isFxCommodities = form.category === "FX & Commodities";

  // Category config with Phosphor icons and terminal colors
  const catConfig: Record<string, { icon: React.ReactNode; color: string; border: string; activeBg: string }> = {
    Politics: { icon: <Bank size={16} weight="fill" />, color: "text-purple-400", border: "border-purple-500/40", activeBg: "bg-purple-500/80" },
    Geopolitics: { icon: <Globe size={16} weight="fill" />, color: "text-indigo-400", border: "border-indigo-500/40", activeBg: "bg-indigo-500/80" },
    Sports: { icon: <SoccerBall size={16} weight="fill" />, color: "text-[#00e5a0]", border: "border-[#00e5a0]/40", activeBg: "bg-[#00e5a0]" },
    Entertainment: { icon: <FilmSlate size={16} weight="fill" />, color: "text-pink-400", border: "border-pink-500/40", activeBg: "bg-pink-500/80" },
    "FX & Commodities": { icon: <ChartLine size={16} weight="fill" />, color: "text-orange-400", border: "border-orange-500/40", activeBg: "bg-orange-500/80" },
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
                    [FEE] {t.markets.createMarket.fee}: <span className="font-bold text-yellow-400">{CREATION_FEE_DISPLAY}</span>
                  </span>
                </div>
                <p className="text-[10px] font-mono text-[var(--muted)] mt-1 ml-6">
                  {t.markets.createMarket.feeDescription}
                </p>
                <p className="text-[10px] font-mono text-green-400/80 mt-1 ml-6">
                  💰 Earn 30% of the trading fees collected on your market when it resolves!
                </p>
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
                  <div className="grid grid-cols-3 gap-2">
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
                    <button
                      type="button"
                      onClick={() => setMarketType("event")}
                      className={cn(
                        "py-3 text-sm font-mono font-bold transition-all",
                        marketType === "event"
                          ? "border-2 border-orange-500/50 bg-[var(--background)] shadow-[0_0_15px_rgba(249,115,22,0.08)]"
                          : "border border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)]/30 bg-[var(--background)]"
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Stack size={14} weight="fill" className={marketType === "event" ? "text-orange-400" : ""} />
                        <span className={marketType === "event" ? "text-orange-400" : ""}>
                          {locale === "sw" ? "TUKIO" : "EVENT"}
                        </span>
                      </div>
                    </button>
                  </div>
                  {marketType === "event" && (
                    <p className="text-[10px] font-mono text-orange-400/80 mt-2">
                      {locale === "sw" 
                        ? "Unda tukio lenye masoko mengi (mfano: Liverpool vs Fulham → nani atashinda, goli la kwanza, n.k.)"
                        : "Create an event with multiple markets (e.g., Liverpool vs Fulham → who wins, first goal, etc.)"}
                    </p>
                  )}
                </motion.div>

                {/* ── INITIAL PROBABILITY (binary only) ── */}
                {marketType === "binary" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider">
                        <ChartLine size={10} weight="bold" />
                        {locale === "sw" ? "Uwezekano wa Awali" : "Starting Probability"}
                      </label>
                      <span className="text-[10px] font-mono text-[var(--muted)]">
                        {locale === "sw" ? "YES → gawio kubwa" : "YES → bigger payout"}
                      </span>
                    </div>

                    {/* Slider */}
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={1}
                        max={99}
                        value={initialProb}
                        onChange={(e) => setInitialProb(Number(e.target.value))}
                        className="w-full accent-[#00e5a0] h-1 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-[var(--muted)]">
                        <span>1%</span>
                        <span>50%</span>
                        <span>99%</span>
                      </div>
                    </div>

                    {/* Multiplier display */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-[var(--background)] border border-[#00e5a0]/20">
                        <p className="text-[10px] font-mono text-[var(--muted)] mb-0.5">YES</p>
                        <p className="text-sm font-mono font-bold text-[#00e5a0]">{initialProb}%</p>
                        <p className="text-[10px] font-mono text-[var(--accent)]">
                          ×{(100 / initialProb).toFixed(1)}x {locale === "sw" ? "kurudi" : "return"}
                        </p>
                      </div>
                      <div className="p-2 bg-[var(--background)] border border-red-500/20">
                        <p className="text-[10px] font-mono text-[var(--muted)] mb-0.5">NO</p>
                        <p className="text-sm font-mono font-bold text-red-400">{100 - initialProb}%</p>
                        <p className="text-[10px] font-mono text-red-400">
                          ×{(100 / (100 - initialProb)).toFixed(1)}x {locale === "sw" ? "kurudi" : "return"}
                        </p>
                      </div>
                    </div>

                    <p className="text-[9px] font-mono text-[var(--muted)]">
                      {locale === "sw"
                        ? "Uwezekano mdogo → gawio kubwa. Mfano: YES 10% = ×10x kwa washindi."
                        : "Lower probability → bigger payout. E.g., YES 10% = ×10x for winners."}
                    </p>

                    {/* Optional per-side logos (e.g. team badges) — YES / NO */}
                    <div className="pt-2 border-t border-[var(--card-border)]/40">
                      <p className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider mb-1.5">
                        {locale === "sw" ? "Nembo (hiari) — timu za YES / NO" : "Logos (optional) — YES / NO teams"}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <LogoUploadSlot url={optionImages[0]} letter="Y" title="YES logo" onFile={(f) => handleOptionImageSelect(0, f)} />
                          <span className="text-[10px] font-mono font-bold text-[#00e5a0]">YES</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <LogoUploadSlot url={optionImages[1]} letter="N" title="NO logo" onFile={(f) => handleOptionImageSelect(1, f)} />
                          <span className="text-[10px] font-mono font-bold text-red-400">NO</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Custom Options */}
                {marketType === "multi" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-purple-500/20 bg-purple-500/5 p-4 space-y-2"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-[10px] font-mono text-purple-400 uppercase tracking-wider">
                        <ListBullets size={10} weight="bold" />
                        {locale === "sw" ? "Chaguzi" : "Options"} ({customOptions.filter(o => o.trim()).length}/{customOptions.length})
                      </label>
                      <button
                        type="button"
                        onClick={distributeEvenly}
                        className="text-[9px] font-mono text-purple-400 border border-purple-500/30 px-2 py-0.5 hover:bg-purple-500/10 transition-colors"
                      >
                        {locale === "sw" ? "GAWANYA SAWA" : "DISTRIBUTE_EVENLY"}
                      </button>
                    </div>

                    {/* Logo-upload hint — tapping each option's badge sets a per-team logo */}
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                      <ImageIcon size={12} weight="bold" className="text-purple-400 shrink-0" />
                      <span className="text-[10px] font-mono text-purple-400 leading-tight">
                        {locale === "sw"
                          ? "Gonga beji ya chaguo (A, B…) kupakia nembo ya timu."
                          : "Tap each option's badge (A, B…) to upload a team logo."}
                      </span>
                    </div>

                    {/* Column headers — desktop only, mobile uses stacked layout */}
                    <div className="hidden sm:flex items-center gap-2 px-1 mb-1">
                      <span className="w-8 shrink-0 text-[9px] font-mono text-[var(--muted)] uppercase text-center">{locale === "sw" ? "Nembo" : "Logo"}</span>
                      <span className="flex-1 text-[9px] font-mono text-[var(--muted)] uppercase">
                        {locale === "sw" ? "Chaguo" : "Option"}
                      </span>
                      <span className="w-20 text-[9px] font-mono text-[var(--muted)] uppercase text-center">
                        {locale === "sw" ? "% Nafasi" : "% Chance"}
                      </span>
                      <span className="w-14 text-[9px] font-mono text-[var(--muted)] uppercase text-center">
                        {locale === "sw" ? "Gawio" : "Payout"}
                      </span>
                      <span className="w-7 shrink-0" />
                    </div>

                    {customOptions.map((opt, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2"
                      >
                        {/* Row 1 (mobile) / full row (desktop): logo uploader + option text */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Per-option logo (e.g. team badge). Click to upload. */}
                          <label
                            className={cn("w-8 h-8 shrink-0 flex items-center justify-center border cursor-pointer overflow-hidden relative group/logo", optColors[i % optColors.length])}
                            title={locale === "sw" ? "Pakia nembo" : "Upload logo"}
                          >
                            {optionImages[i] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={optionImages[i]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-mono font-black">{String.fromCharCode(65 + i)}</span>
                            )}
                            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity">
                              <ImageIcon size={12} weight="bold" className="text-white" />
                            </span>
                            {/* Persistent corner indicator so it's clearly an upload target */}
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 border border-[var(--card)] flex items-center justify-center">
                              <ImageIcon size={8} weight="fill" className="text-white" />
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleOptionImageSelect(i, e.target.files?.[0] || null)}
                            />
                          </label>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(i, e.target.value)}
                            placeholder={`${locale === "sw" ? "Chaguo" : "Option"} ${String.fromCharCode(65 + i)}...`}
                            className="flex-1 min-w-0 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-purple-500/50 transition-colors"
                            maxLength={100}
                          />
                        </div>
                        {/* Row 2 (mobile) / inline (desktop): probability + multiplier + delete */}
                        <div className="flex items-center gap-2 pl-9 sm:pl-0">
                          {/* % Chance label — mobile only */}
                          <span className="text-[9px] font-mono text-[var(--muted)] uppercase sm:hidden">
                            {locale === "sw" ? "Nafasi" : "Chance"}:
                          </span>
                          {/* Probability input */}
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={1}
                              max={98}
                              value={optionProbs[i] ?? 0}
                              onChange={(e) => updateOptionProb(i, Number(e.target.value))}
                              className="w-14 px-2 py-2 bg-[var(--background)] border border-purple-500/30 text-sm font-mono text-[var(--foreground)] focus:outline-none focus:border-purple-500/60 transition-colors text-center"
                            />
                            <span className="text-[10px] font-mono text-[var(--muted)]">%</span>
                          </div>
                          {/* Implied multiplier */}
                          <span className="w-14 text-[10px] font-mono text-center text-[var(--accent)]">
                            ×{optionProbs[i] > 0 ? (100 / optionProbs[i]).toFixed(1) : "∞"}x
                          </span>
                          {customOptions.length > 2 && (
                            <button type="button" onClick={() => removeOption(i)} className="w-7 p-1.5 text-red-400 hover:bg-red-500/10 transition-colors ml-auto sm:ml-0">
                              <Trash size={14} />
                            </button>
                          )}
                          {customOptions.length <= 2 && <span className="w-7 sm:inline hidden" />}
                        </div>
                      </motion.div>
                    ))}

                    {/* Probability total */}
                    <div className={cn(
                      "flex items-center justify-between px-2 py-1.5 border text-[10px] font-mono mt-1",
                      Math.abs(optionProbsTotal - 100) <= 1
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)]"
                        : "border-red-500/30 bg-red-500/5 text-red-400"
                    )}>
                      <span>{locale === "sw" ? "Jumla ya Uwezekano" : "Total Probability"}</span>
                      <span className="font-bold">
                        {optionProbsTotal}% {Math.abs(optionProbsTotal - 100) <= 1 ? "✓" : `(${optionProbsTotal > 100 ? "−" : "+"}${Math.abs(100 - optionProbsTotal)} needed)`}
                      </span>
                    </div>

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

                {/* Event Markets */}
                {marketType === "event" && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-orange-500/20 bg-orange-500/5 p-4 space-y-3"
                  >
                    <label className="flex items-center gap-2 text-[10px] font-mono text-orange-400 mb-2 uppercase tracking-wider">
                      <Stack size={10} weight="bold" />
                      {locale === "sw" ? "Masoko ya Tukio" : "Event Markets"} ({eventMarkets.length})
                    </label>

                    {/* Existing markets */}
                    {eventMarkets.map((market, i) => (
                      <div key={market.id} className="flex items-center gap-2 p-2 bg-[var(--background)] border border-orange-500/20">
                        <span className="w-6 h-6 flex items-center justify-center text-[10px] font-mono font-black border border-orange-500/40 text-orange-400">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono truncate">{market.title}</p>
                          <p className="text-[10px] text-[var(--muted)]">
                            {market.type === "binary"
                              ? `YES/NO · ${market.initialProb ?? 50}%`
                              : `${market.options?.length || 0} options · ${(market.optionProbs || []).join("/")}%`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEventMarkets(eventMarkets.filter(m => m.id !== market.id))}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add new market form */}
                    <div className="border border-dashed border-orange-500/30 p-3 space-y-2">
                      <input
                        type="text"
                        value={newEventMarket.title}
                        onChange={(e) => setNewEventMarket({ ...newEventMarket, title: e.target.value })}
                        placeholder={locale === "sw" ? "Swali la soko, mfano: Je Liverpool itashinda?" : "Market question, e.g., Will Liverpool win?"}
                        className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-orange-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewEventMarket({ ...newEventMarket, type: "binary" })}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-mono transition-all",
                            newEventMarket.type === "binary"
                              ? "bg-[var(--accent)]/20 border border-[var(--accent)]/50 text-[var(--accent)]"
                              : "border border-[var(--card-border)] text-[var(--muted)]"
                          )}
                        >
                          YES/NO
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEventMarket({ ...newEventMarket, type: "multi" })}
                          className={cn(
                            "flex-1 py-1.5 text-xs font-mono transition-all",
                            newEventMarket.type === "multi"
                              ? "bg-purple-500/20 border border-purple-500/50 text-purple-400"
                              : "border border-[var(--card-border)] text-[var(--muted)]"
                          )}
                        >
                          MULTI
                        </button>
                      </div>
                      {newEventMarket.type === "binary" && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--muted)] uppercase">
                            <span>{locale === "sw" ? "Nafasi ya YES" : "YES Chance"}</span>
                            <span className="text-[var(--accent)] font-bold">
                              {newEventMarket.initialProb}% · ×{(100 / newEventMarket.initialProb).toFixed(1)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={99}
                            value={newEventMarket.initialProb}
                            onChange={(e) => setNewEventMarket({ ...newEventMarket, initialProb: Number(e.target.value) })}
                            className="w-full accent-[#00e5a0]"
                          />
                          {/* Optional YES / NO logos */}
                          <div className="flex items-center gap-3 pt-1">
                            <div className="flex items-center gap-1.5">
                              <LogoUploadSlot size={26} url={newEventMarket.optionImages[0]} letter="Y" title="YES logo" onFile={(f) => setEventMarketLogo(0, f)} />
                              <span className="text-[9px] font-mono font-bold text-[#00e5a0]">YES</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <LogoUploadSlot size={26} url={newEventMarket.optionImages[1]} letter="N" title="NO logo" onFile={(f) => setEventMarketLogo(1, f)} />
                              <span className="text-[9px] font-mono font-bold text-red-400">NO</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {newEventMarket.type === "multi" && (
                        <div className="space-y-1">
                          {newEventMarket.options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <LogoUploadSlot size={28} url={newEventMarket.optionImages[i]} letter={String.fromCharCode(65 + i)} title="Option logo" onFile={(f) => setEventMarketLogo(i, f)} />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...newEventMarket.options];
                                  newOpts[i] = e.target.value;
                                  setNewEventMarket({ ...newEventMarket, options: newOpts });
                                }}
                                placeholder={`${locale === "sw" ? "Chaguo" : "Option"} ${i + 1}`}
                                className="flex-1 min-w-0 px-2 py-1.5 bg-[var(--background)] border border-[var(--card-border)] text-xs font-mono"
                              />
                              <div className="flex items-center gap-0.5 shrink-0">
                                <input
                                  type="number"
                                  min={1}
                                  max={98}
                                  value={newEventMarket.optionProbs[i] ?? 0}
                                  onChange={(e) => {
                                    const newProbs = [...newEventMarket.optionProbs];
                                    newProbs[i] = Math.max(1, Math.min(98, Number(e.target.value)));
                                    setNewEventMarket({ ...newEventMarket, optionProbs: newProbs });
                                  }}
                                  className="w-12 px-1.5 py-1.5 bg-[var(--background)] border border-purple-500/30 text-xs font-mono text-center focus:outline-none focus:border-purple-500/60"
                                />
                                <span className="text-[10px] font-mono text-[var(--muted)]">%</span>
                              </div>
                              <span className="w-12 text-[10px] font-mono text-center text-[var(--accent)] shrink-0">
                                {(newEventMarket.optionProbs[i] ?? 0) > 0 ? `×${(100 / newEventMarket.optionProbs[i]).toFixed(1)}x` : "—"}
                              </span>
                              {newEventMarket.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewEventMarket({
                                      ...newEventMarket,
                                      options: newEventMarket.options.filter((_, j) => j !== i),
                                      optionProbs: newEventMarket.optionProbs.filter((_, j) => j !== i),
                                    });
                                  }}
                                  className="p-1 text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                                >
                                  <Trash size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                          <div className={cn(
                            "flex items-center justify-between px-2 py-1 border text-[10px] font-mono",
                            Math.abs(newEventProbsTotal - 100) <= 1
                              ? "border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)]"
                              : "border-red-500/30 bg-red-500/5 text-red-400"
                          )}>
                            <span>{locale === "sw" ? "Jumla" : "Total"}</span>
                            <span className="font-bold">{newEventProbsTotal}% {Math.abs(newEventProbsTotal - 100) <= 1 ? "✓" : ""}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewEventMarket({ ...newEventMarket, options: [...newEventMarket.options, ""], optionProbs: [...newEventMarket.optionProbs, 0] })}
                            className="text-[10px] text-purple-400 hover:underline"
                          >
                            + {locale === "sw" ? "Ongeza chaguo" : "Add option"}
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!newEventMarket.title.trim()) return;
                          let validOptions: string[] | undefined;
                          let validProbs: number[] | undefined;
                          let imgs: string[] = [];
                          let imgFiles: (File | null)[] = [];
                          if (newEventMarket.type === "multi") {
                            const kept: number[] = [];
                            const keptImg: string[] = [];
                            const keptFile: (File | null)[] = [];
                            validOptions = newEventMarket.options
                              .map((o, i) => ({ o: o.trim(), i }))
                              .filter(({ o }) => o)
                              .map(({ o, i }) => {
                                kept.push(newEventMarket.optionProbs[i] ?? 0);
                                keptImg.push(newEventMarket.optionImages[i] || "");
                                keptFile.push(newEventMarket.optionImageFiles[i] || null);
                                return o;
                              });
                            if (validOptions.length < 2) return;
                            const sum = kept.reduce((s, p) => s + p, 0);
                            if (Math.abs(sum - 100) > 1) {
                              setError(locale === "sw" ? `Uwezekano lazima uwe 100% (sasa: ${sum}%)` : `Option probabilities must sum to 100% (currently: ${sum}%)`);
                              return;
                            }
                            validProbs = kept;
                            imgs = keptImg; imgFiles = keptFile;
                          } else {
                            imgs = [newEventMarket.optionImages[0] || "", newEventMarket.optionImages[1] || ""];
                            imgFiles = [newEventMarket.optionImageFiles[0] || null, newEventMarket.optionImageFiles[1] || null];
                          }
                          setError("");
                          setEventMarkets([
                            ...eventMarkets,
                            {
                              id: Date.now().toString(),
                              title: newEventMarket.title,
                              type: newEventMarket.type,
                              options: validOptions,
                              optionProbs: validProbs,
                              initialProb: newEventMarket.type === "binary" ? newEventMarket.initialProb : undefined,
                              optionImages: imgs,
                              optionImageFiles: imgFiles,
                            },
                          ]);
                          setNewEventMarket({ title: "", type: "binary", options: ["", ""], optionProbs: [50, 50], initialProb: 50, optionImages: ["", ""], optionImageFiles: [null, null] });
                        }}
                        className="w-full py-2 border border-orange-500/50 text-orange-400 text-xs font-mono font-bold hover:bg-orange-500/10 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus size={12} weight="bold" />
                        {locale === "sw" ? "ONGEZA SOKO" : "ADD MARKET"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* FX & Commodities: Pyth auto-resolve OR custom question */}
                {isFxCommodities && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-orange-500/20 bg-orange-500/5 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ChartLine size={14} weight="fill" className="text-orange-400" />
                        <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">FX & Commodities</span>
                      </div>
                      {/* Mode toggle */}
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setFxMode("pyth")}
                          className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${fxMode === "pyth" ? "bg-orange-500 text-black" : "border border-orange-500/30 text-orange-400 hover:border-orange-500/60"}`}
                        >
                          Pyth Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setFxMode("custom")}
                          className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${fxMode === "custom" ? "bg-orange-500 text-black" : "border border-orange-500/30 text-orange-400 hover:border-orange-500/60"}`}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    {fxMode === "pyth" ? (
                      <>
                        <p className="text-[10px] font-mono text-[var(--muted)]">
                          Auto-resolve based on live Pyth price feeds. Title auto-generated if blank.
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono text-[var(--muted)] mb-1 uppercase">Asset</label>
                            <select
                              value={pythConfig.symbol}
                              onChange={(e) => setPythConfig({ ...pythConfig, symbol: e.target.value })}
                              className="w-full px-2 py-2 bg-[#0a0a0a] border border-orange-500/20 text-sm font-mono text-orange-400 focus:outline-none focus:border-orange-500/50 transition-colors cursor-pointer appearance-none"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f97316' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 8px center'
                              }}
                            >
                              {ALL_PYTH_SYMBOLS.map((s) => (
                                <option key={s.symbol} value={s.symbol} className="bg-[#0a0a0a] text-orange-400 py-2">{s.emoji} {s.label}</option>
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
                              className="w-full px-2 py-2 bg-[#0a0a0a] border border-orange-500/20 text-sm font-mono text-orange-400 focus:outline-none focus:border-orange-500/50 transition-colors cursor-pointer appearance-none"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f97316' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 8px center'
                              }}
                            >
                              <option value="above" className="bg-[#0a0a0a] text-orange-400">Above / ≥</option>
                              <option value="below" className="bg-[#0a0a0a] text-orange-400">Below / ≤</option>
                            </select>
                          </div>
                        </div>
                        {pythConfig.targetPrice && (
                          <div className="text-[10px] font-mono text-[var(--muted)] border border-orange-500/20 px-2 py-1.5 bg-[var(--background)]">
                            <span className="text-orange-400">[AUTO] </span>
                            Will {pythConfig.symbol} be {pythConfig.operator === "above" ? "≥" : "≤"} ${parseFloat(pythConfig.targetPrice || "0").toLocaleString()} USD?
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-mono text-[var(--muted)]">
                          Write your own FX or commodity question. You will resolve it manually.
                        </p>
                        <div className="text-[10px] font-mono text-orange-400/70 border border-orange-500/20 px-2 py-1.5 bg-[var(--background)]">
                          <span className="text-orange-400">[MANUAL] </span>
                          E.g. &quot;Will USD/TZS exceed 2,600 by end of day?&quot;
                        </div>
                        {/* Current rate field */}
                        <div>
                          <label className="block text-[10px] font-mono text-[var(--muted)] mb-1 uppercase tracking-wider">
                            Current rate <span className="normal-case text-[var(--muted)]/60">(optional — shown in hedge calculator)</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={fxRate}
                              onChange={(e) => setFxRate(e.target.value)}
                              placeholder="e.g. 2650"
                              className="flex-1 px-2 py-2 bg-[var(--background)] border border-orange-500/20 text-sm font-mono focus:outline-none focus:border-orange-500/50 transition-colors"
                            />
                            <span className="text-[10px] font-mono text-orange-400 shrink-0">TZS / unit</span>
                          </div>
                          <p className="text-[9px] font-mono text-[var(--muted)]/70 mt-1">
                            E.g. 2650 for USD/TZS at 2,650. Helps traders size their hedge correctly.
                          </p>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {/* Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--card-border)] to-transparent" />

                {/* ── QUESTION / EVENT NAME ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">
                    <TextT size={12} weight="bold" />
                    {marketType === "event" 
                      ? (locale === "sw" ? "Jina la Tukio" : "Event Name")
                      : t.markets.createMarket.question}
                    {isFxCommodities && fxMode === "pyth" && <span className="text-[var(--muted)] normal-case">(auto-generated)</span>}
                  </label>
                  <textarea
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]/50 focus:shadow-[0_0_15px_rgba(0,229,160,0.05)] transition-all resize-none placeholder:text-[var(--muted)]/50"
                    placeholder={
                      marketType === "event"
                        ? (locale === "sw" ? "Liverpool vs Fulham - EPL" : "Liverpool vs Fulham - EPL")
                        : isFxCommodities
                          ? fxMode === "custom"
                            ? "Will USD/TZS exceed 2,600 by end of the day?"
                            : "Will EUR/USD reach 1.15 by end of 2025?"
                          : "Will CCM win the 2025 Tanzanian general election?"
                    }
                    rows={2}
                    maxLength={200}
                    required={!(isFxCommodities && fxMode === "pyth")}
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

                {/* ── RESOLUTION DATE / EVENT START ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label className="flex items-center gap-2 text-xs font-mono text-[var(--accent)] mb-2 uppercase tracking-wider">
                    <CalendarBlank size={12} weight="bold" />
                    {marketType === "event"
                      ? (locale === "sw" ? "Muda wa Kumaliza Tukio" : "Event End Time")
                      : t.markets.createMarket.resolutionDate}
                  </label>
                  
                  <TerminalDatePicker
                    selected={form.resolvesAt ? new Date(form.resolvesAt) : new Date(defaultDate)}
                    onChange={(date) => {
                      if (!date) { setForm({ ...form, resolvesAt: "" }); return; }
                      // Format as EAT time (GMT+3)
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, "0");
                      const d = String(date.getDate()).padStart(2, "0");
                      const h = String(date.getHours()).padStart(2, "0");
                      const min = String(date.getMinutes()).padStart(2, "0");
                      setForm({ ...form, resolvesAt: `${y}-${m}-${d}T${h}:${min}` });
                    }}
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
                {(form.title || (isFxCommodities && pythConfig.targetPrice)) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "border-2 bg-[var(--background)]",
                      marketType === "event" ? "border-orange-500/30" : "border-[var(--accent)]/30"
                    )}
                  >
                    {/* Preview title bar */}
                    <div className={cn(
                      "border-b px-3 py-2 flex items-center gap-2",
                      marketType === "event" 
                        ? "bg-orange-500/5 border-orange-500/20" 
                        : "bg-[var(--accent)]/5 border-[var(--accent)]/20"
                    )}>
                      <Eye size={12} weight="fill" className={marketType === "event" ? "text-orange-400" : "text-[var(--accent)]"} />
                      <span className={cn(
                        "text-[10px] font-mono uppercase tracking-wider",
                        marketType === "event" ? "text-orange-400" : "text-[var(--accent)]"
                      )}>
                        {locale === "sw" ? "Hakiki" : "Preview"}
                        {marketType === "event" && ` · ${locale === "sw" ? "Tukio" : "Event"}`}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border", catConfig[form.category]?.color || "text-[var(--muted)]", catConfig[form.category]?.border || "border-[var(--card-border)]")}>
                          [{form.category}]
                        </span>
                        {marketType === "event" && (
                          <span className="text-[10px] font-mono text-orange-400 border border-orange-500/30 px-1.5 py-0.5">
                            {eventMarkets.length} {locale === "sw" ? "masoko" : "markets"}
                          </span>
                        )}
                        {isFxCommodities && fxMode === "pyth" && (
                          <span className="text-[10px] font-mono text-orange-400 border border-orange-500/30 px-1.5 py-0.5">PYTH</span>
                        )}
                        {isFxCommodities && fxMode === "custom" && (
                          <span className="text-[10px] font-mono text-orange-400 border border-orange-500/30 px-1.5 py-0.5">FX</span>
                        )}
                      </div>
                      <p className="font-bold text-sm mb-3">
                        {form.title ||
                          (isFxCommodities && fxMode === "pyth" && pythConfig.targetPrice
                            ? `Will ${pythConfig.symbol} be ${pythConfig.operator === "above" ? "≥" : "≤"} $${parseFloat(pythConfig.targetPrice).toLocaleString()} USD by resolution?`
                            : "")}
                      </p>

                      {/* Event preview - show all markets */}
                      {marketType === "event" && eventMarkets.length > 0 ? (
                        <div className="space-y-2">
                          {eventMarkets.map((market, i) => (
                            <div key={market.id} className="p-2 bg-[var(--card)] border border-[var(--card-border)]">
                              <p className="text-xs font-mono mb-1.5">{market.title}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {market.type === "binary" ? (
                                  <>
                                    <span className="px-1.5 py-0.5 text-[9px] border border-[#00e5a0]/30 text-[#00e5a0]">YES 50%</span>
                                    <span className="px-1.5 py-0.5 text-[9px] border border-red-500/30 text-red-400">NO 50%</span>
                                    <span className="px-1.5 py-0.5 text-[9px] border border-[var(--card-border)] text-[var(--muted)]">equal odds</span>
                                  </>
                                ) : (
                                  market.options?.map((opt, j) => (
                                    <span key={j} className={cn("px-1.5 py-0.5 text-[9px] border", optColors[j % optColors.length])}>
                                      {opt.slice(0, 12)} {Math.round(100 / (market.options?.length || 1))}%
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : marketType === "event" ? (
                        <p className="text-[10px] font-mono text-[var(--muted)]">
                          {locale === "sw" ? "Ongeza masoko hapo juu..." : "Add markets above..."}
                        </p>
                      ) : (
                        /* Regular market preview */
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                          {marketType === "multi" && customOptions.filter(o => o.trim()).length >= 2 ? (
                            <>
                              {customOptions.map((opt, i) => opt.trim() ? (
                                <span key={i} className={cn("px-2 py-0.5 border", optColors[i % optColors.length])}>
                                  {opt.trim().slice(0, 15)} {optionProbs[i] ?? 0}% · ×{optionProbs[i] > 0 ? (100 / optionProbs[i]).toFixed(1) : "∞"}x
                                </span>
                              ) : null)}
                            </>
                          ) : (
                            <>
                              <span className="px-2 py-0.5 border border-[#00e5a0]/30 text-[#00e5a0]">
                                YES {initialProb}% · ×{(100 / initialProb).toFixed(1)}x
                              </span>
                              <span className="px-2 py-0.5 border border-red-500/30 text-red-400">
                                NO {100 - initialProb}% · ×{(100 / (100 - initialProb)).toFixed(1)}x
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── SEED LIQUIDITY ── */}
                {marketType !== "event" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 border border-[var(--card-border)] rounded-xl bg-[var(--background)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm font-bold text-[var(--foreground)]">
                          {locale === "sw" ? "SEED LIKWIDITI (HIARI)" : "SEED LIQUIDITY (OPTIONAL)"}
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {locale === "sw"
                            ? "Weka TZS halisi ili watumiaji wa kwanza wapate malipo makubwa zaidi"
                            : "Deposit real TZS so early traders see bigger payouts"}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] font-mono text-sm">
                        {displayCurrency === 'USDC' ? '$' : 'TSh'}
                      </span>
                      <input
                        type="number"
                        min={displayCurrency === 'USDC' ? "0.5" : "1000"}
                        step={displayCurrency === 'USDC' ? "1" : "1000"}
                        placeholder={displayCurrency === 'USDC' ? "e.g. 20" : "e.g. 50000"}
                        value={seedAmount}
                        onChange={e => setSeedAmount(e.target.value)}
                        className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-lg pl-10 pr-4 py-2.5 font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                    {/* Distribution toggle — shown when seed has a value */}
                    {seedAmount && parseFloat(seedAmount) > 0 && (
                      <div className="flex gap-1.5">
                        {(["equal", "proportional"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSeedDistribution(mode)}
                            className={`flex-1 py-1.5 text-xs font-mono border transition-colors rounded-lg ${
                              seedDistribution === mode
                                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                                : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--accent)]/50"
                            }`}
                          >
                            {mode === "equal"
                              ? (locale === "sw" ? "SAWA SAWA" : "EQUAL SPLIT")
                              : (locale === "sw" ? "KWA UWEZEKANO" : "BY PROBABILITY")}
                          </button>
                        ))}
                      </div>
                    )}

                    {seedAmount && parseFloat(seedAmount) > 0 && (() => {
                      const seedRaw = parseFloat(seedAmount);
                      const isUsdc = displayCurrency === 'USDC';
                      const seedTzs = isUsdc ? Math.round(seedRaw * USDC_TO_TZS_RATE) : Math.round(seedRaw);
                      const minTzs = isUsdc ? Math.round(0.5 * USDC_TO_TZS_RATE) : 1000;
                      if (seedTzs < minTzs) return null;
                      const validOpts = customOptions.filter(o => o.trim());
                      const isMulti = marketType === "multi" && validOpts.length >= 2;
                      const nOptions = isMulti ? validOpts.length : 2;

                      // Calculate win fraction based on distribution mode
                      let winFraction: number;
                      let splitLabel: string;
                      if (seedDistribution === "proportional") {
                        if (isMulti) {
                          const probs = optionProbs.slice(0, validOpts.length);
                          const total = probs.reduce((s, p) => s + p, 0) || 100;
                          winFraction = Math.max(...probs) / total; // best-case: highest prob option wins
                          splitLabel = validOpts.map((o, i) => `${optionProbs[i] ?? Math.round(100/nOptions)}% ${o.trim().slice(0, 8) || `Opt ${i+1}`}`).join(' · ');
                        } else {
                          const yesPct = initialProb;
                          winFraction = Math.max(yesPct, 100 - yesPct) / 100;
                          splitLabel = `${yesPct}% YES · ${100 - yesPct}% NO`;
                        }
                      } else {
                        winFraction = 1 / nOptions;
                        splitLabel = isMulti
                          ? validOpts.map((o, i) => `${Math.round(100 / nOptions)}% ${o.trim().slice(0, 8) || `Opt ${i+1}`}`).join(' · ')
                          : "50% YES · 50% NO";
                      }

                      // No entry fee on LP seed — only 5% settlement fee at resolution
                      const estReturnTzs = Math.round(seedTzs * winFraction * 0.95);
                      const depositDisplay = isUsdc ? `$${seedRaw.toFixed(2)}` : `TSh ${seedTzs.toLocaleString()}`;
                      const returnDisplay = isUsdc
                        ? `$${(estReturnTzs / USDC_TO_TZS_RATE).toFixed(2)}`
                        : `TSh ${estReturnTzs.toLocaleString()}`;
                      return (
                        <div className="text-xs text-[var(--muted)] space-y-1 font-mono border-t border-[var(--card-border)] pt-2">
                          <div className="flex justify-between">
                            <span>{locale === "sw" ? "Unaweka" : "You deposit"}</span>
                            <span className="text-[var(--foreground)]">{depositDisplay}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{locale === "sw" ? "Imegawanywa" : "Split"}</span>
                            <span className="text-right max-w-[55%] truncate">{splitLabel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{locale === "sw" ? "Ada (azimio tu)" : "Fee (settlement only)"}</span>
                            <span className="text-[#00e5a0]">5% <span className="text-[var(--muted)]">· no entry fee</span></span>
                          </div>
                          <div className="flex justify-between">
                            <span>{locale === "sw" ? "Unapata baada ya azimio (wastani)" : "Avg return at resolution"}</span>
                            <span className="text-[#00e5a0]">{returnDisplay} <span className="text-[var(--muted)]">({Math.round(winFraction * 95)}% of seed)</span></span>
                          </div>
                          <p className="text-[var(--muted)] text-[10px] pt-1">
                            {locale === "sw"
                              ? "Malipo ya mwisho yanarejeshwa otomatiki · Upande unaopoteza unagawanywa kwa washindi"
                              : "LP payout auto-sent at resolution · Losing side funds winners · No entry fee on seed"}
                          </p>
                        </div>
                      );
                    })()}
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
                      {marketType === "event" 
                        ? (locale === "sw" ? "UNDA TUKIO" : "CREATE EVENT")
                        : t.markets.createMarket.submit} · {CREATION_FEE_DISPLAY}
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
