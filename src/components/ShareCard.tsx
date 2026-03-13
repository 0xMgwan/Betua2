"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, XCircle, ShareNetwork, WhatsappLogo, XLogo,
  TelegramLogo, DownloadSimple, X, Lightning, TrendUp,
  CheckCircle, InstagramLogo,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatTZS } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ShareCardProps {
  marketTitle: string;
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  outcome: string; // "YES", "NO", or option label
  won: boolean;
  payout: number; // amount won/lost
  invested: number; // total invested
  username: string;
  shares: number;
  marketUrl: string;
}

export function ShareCardButton({
  marketTitle,
  category,
  subCategory,
  imageUrl,
  outcome,
  won,
  payout,
  invested,
  username,
  shares,
  marketUrl,
}: ShareCardProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLanguage();
  const isSw = locale === "sw";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase transition-all border-2",
          won
            ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)] shadow-[0_0_15px_rgba(0,229,160,0.1)]"
            : "border-[var(--card-border)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
        )}
      >
        <ShareNetwork size={13} weight="bold" />
        Share
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <ShareCardModal
            marketTitle={marketTitle}
            category={category}
            subCategory={subCategory}
            imageUrl={imageUrl}
            outcome={outcome}
            won={won}
            payout={payout}
            invested={invested}
            username={username}
            shares={shares}
            marketUrl={marketUrl}
            onClose={() => setOpen(false)}
          />
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function ShareCardModal({
  marketTitle,
  category,
  subCategory,
  imageUrl,
  outcome,
  won,
  payout,
  invested,
  username,
  shares,
  marketUrl,
  onClose,
}: ShareCardProps & { onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [base64Img, setBase64Img] = useState<string | null>(null);
  const { locale } = useLanguage();
  const isSw = locale === "sw";

  // Convert market image to base64 on mount so html-to-image works on mobile
  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setBase64Img(canvas.toDataURL("image/png"));
        }
      } catch { /* CORS blocked — fall back to original URL */ }
    };
    img.onerror = () => setBase64Img(null);
    img.src = imageUrl;
  }, [imageUrl]);

  const profitLoss = won ? payout - invested : -invested;
  const profitPct = invested > 0 ? ((profitLoss / invested) * 100).toFixed(0) : "0";

  const shareText = won
    ? (isSw
        ? `🏆 Nilitabiri "${outcome}" kwenye "${marketTitle}" na NIKASHINDA ${formatTZS(payout)}! (+${profitPct}%) 🔥\n\nTabiri sasa kwenye GUAP 👉`
        : `🏆 I predicted "${outcome}" on "${marketTitle}" and WON ${formatTZS(payout)}! (+${profitPct}%) 🔥\n\nMake your predictions on GUAP 👉`)
    : (isSw
        ? `📊 Nilitabiri "${outcome}" kwenye "${marketTitle}" — bahati njema wakati ujao!\n\nTabiri sasa kwenye GUAP 👉`
        : `📊 I predicted "${outcome}" on "${marketTitle}" — better luck next time!\n\nMake your predictions on GUAP 👉`);

  const fullShareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${marketUrl}`
    : marketUrl;

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#0a0a0a",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `guap-prediction-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        setDownloading(false);
      }, 100);
    } catch (err) {
      console.error("Download failed:", err);
      setDownloading(false);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The share card */}
        <div
          ref={cardRef}
          data-share-card
          className="relative overflow-hidden"
          style={{
            background: won
              ? "linear-gradient(135deg, #0a0f0d 0%, #0d1a14 40%, #0a1510 100%)"
              : "linear-gradient(135deg, #0f0a0a 0%, #1a0d0d 40%, #150a0a 100%)",
          }}
        >
          {/* Glow effect */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-30"
            style={{ background: won ? "#00e5a0" : "#ef4444" }}
          />
          <div
            className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-[60px] opacity-20"
            style={{ background: won ? "#00b4d8" : "#f97316" }}
          />

          {/* Content */}
          <div className="relative p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 border-2 border-white/30 flex items-center justify-center text-white font-black text-[10px]">
                  G
                </div>
                <span className="text-white/60 text-[10px] font-mono tracking-[0.3em] uppercase">
                  GUAP
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[9px] font-mono uppercase tracking-wider">
                  {category}
                </span>
                {subCategory && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-white/40 text-[9px] font-mono uppercase tracking-wider">
                      {subCategory}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Result badge */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={cn(
                  "w-12 h-12 flex items-center justify-center border-2",
                  won ? "border-[#00e5a0]/50 bg-[#00e5a0]/10" : "border-red-500/50 bg-red-500/10"
                )}
              >
                {won ? (
                  <Trophy size={24} weight="fill" className="text-[#00e5a0]" />
                ) : (
                  <XCircle size={24} weight="fill" className="text-red-400" />
                )}
              </div>
              <div>
                <div
                  className={cn(
                    "text-xs font-mono font-black tracking-[0.2em] uppercase",
                    won ? "text-[#00e5a0]" : "text-red-400"
                  )}
                >
                  {won ? (isSw ? "UTABIRI UMESHINDA" : "PREDICTION WON") : (isSw ? "UTABIRI UMESHINDWA" : "PREDICTION LOST")}
                </div>
                <div className="text-white/40 text-[10px] font-mono mt-0.5">
                  @{username}
                </div>
              </div>
            </div>

            {/* Market image + title */}
            {imageUrl && (
              <div className="mb-3 rounded overflow-hidden border border-white/10">
                <img
                  src={base64Img || imageUrl}
                  alt={marketTitle}
                  className="w-full h-32 object-cover"
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div className="mb-5">
              <p className="text-white text-sm font-bold leading-snug line-clamp-2">
                {marketTitle}
              </p>
            </div>

            {/* Prediction & stats */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-white/5 border border-white/10 p-3">
                <div className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-1">
                  {isSw ? "Chaguo Langu" : "My Pick"}
                </div>
                <div className={cn(
                  "text-sm font-mono font-black",
                  won ? "text-[#00e5a0]" : "text-red-400"
                )}>
                  {outcome}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 p-3">
                <div className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-1">
                  {isSw ? "Hisa" : "Shares"}
                </div>
                <div className="text-white text-sm font-mono font-black">
                  {Math.round(shares).toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 p-3">
                <div className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-1">
                  {won ? (isSw ? "Malipo" : "Payout") : (isSw ? "Uwekezaji" : "Invested")}
                </div>
                <div className={cn(
                  "text-sm font-mono font-black",
                  won ? "text-[#00e5a0]" : "text-white"
                )}>
                  {won ? formatTZS(payout) : formatTZS(invested)}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 p-3">
                <div className="text-white/40 text-[9px] font-mono uppercase tracking-wider mb-1">
                  P&L
                </div>
                <div className={cn(
                  "text-sm font-mono font-black",
                  won ? "text-[#00e5a0]" : "text-red-400"
                )}>
                  {won ? "+" : ""}{profitPct}%
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Lightning size={10} weight="fill" className={won ? "text-[#00e5a0]" : "text-red-400"} />
                  <span className="text-white/30 text-[9px] font-mono tracking-wider">
                    {isSw ? "TABIRI · BIASHARA · SHINDA" : "PREDICT · TRADE · WIN"}
                  </span>
                </div>
                <span className="text-white/50 text-[9px] font-mono font-bold">
                  guap.gold
                </span>
              </div>
              <div className="flex items-center gap-3 text-white/50 text-[8px] font-mono font-bold">
                <span className="flex items-center gap-1">
                  <XLogo size={10} weight="bold" />
                  @shindaguap
                </span>
                <span className="text-white/30">·</span>
                <span className="flex items-center gap-1">
                  <InstagramLogo size={10} weight="bold" />
                  @shindaguap
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Share buttons below card */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText + " " + fullShareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#25D366] text-white text-xs font-mono font-bold rounded-none hover:opacity-90 transition-all"
          >
            <WhatsappLogo size={16} weight="fill" />
            WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullShareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 text-white text-xs font-mono font-bold rounded-none border border-gray-600 hover:bg-gray-700 transition-all"
          >
            <XLogo size={16} weight="fill" />
            Post
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(fullShareUrl)}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0088cc] text-white text-xs font-mono font-bold rounded-none hover:opacity-90 transition-all"
          >
            <TelegramLogo size={16} weight="fill" />
            Telegram
          </a>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 text-white text-xs font-mono font-bold rounded-none border border-white/20 hover:bg-white/20 transition-all disabled:opacity-50"
          >
            <DownloadSimple size={16} weight="bold" />
            {downloading ? (isSw ? "Inahifadhi..." : "Saving...") : (isSw ? "Hifadhi Picha" : "Save Image")}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 text-white/60 text-xs font-mono font-bold rounded-none border border-white/10 hover:bg-white/10 transition-all"
          >
            <X size={16} weight="bold" />
            {isSw ? "Funga" : "Close"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
