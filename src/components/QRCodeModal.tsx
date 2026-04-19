"use client";
import { useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { X, DownloadSimple, Link as LinkIcon, Check } from "@phosphor-icons/react";
import { useState } from "react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export function QRCodeModal({ isOpen, onClose, url, title }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    // Create a new canvas with padding + branding
    const padding = 32;
    const labelHeight = 52;
    const out = document.createElement("canvas");
    out.width = canvas.width + padding * 2;
    out.height = canvas.height + padding * 2 + labelHeight;

    const ctx = out.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, out.width, out.height);

    // White card behind QR
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(padding - 8, padding - 8, canvas.width + 16, canvas.height + 16, 8);
    } else {
      ctx.rect(padding - 8, padding - 8, canvas.width + 16, canvas.height + 16);
    }
    ctx.fill();

    // QR code
    ctx.drawImage(canvas, padding, padding);

    // Brand label
    ctx.fillStyle = "#00e5a0";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GUAP", out.width / 2, canvas.height + padding * 2 + 20);

    ctx.fillStyle = "#888888";
    ctx.font = "11px monospace";
    ctx.fillText(title.slice(0, 48) + (title.length > 48 ? "…" : ""), out.width / 2, canvas.height + padding * 2 + 40);

    const link = document.createElement("a");
    link.download = `guap-qr-${Date.now()}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }, [title]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 w-full max-w-xs shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono font-bold text-sm uppercase tracking-wider text-[var(--accent)]">
            Scan to Trade
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--foreground)]/10 text-[var(--muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* QR Code */}
        <div ref={canvasRef} className="flex justify-center mb-4">
          <div className="p-3 bg-white rounded-xl shadow-inner">
            <QRCodeCanvas
              value={url}
              size={200}
              bgColor="#ffffff"
              fgColor="#0d0d0d"
              level="H"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Title */}
        <p className="text-xs text-[var(--muted)] text-center mb-4 line-clamp-2 leading-snug">
          {title}
        </p>

        {/* URL pill */}
        <div className="flex items-center gap-1.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg px-3 py-2 mb-4">
          <span className="text-[10px] font-mono text-[var(--muted)] truncate flex-1">{url}</span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono border border-[var(--card-border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all rounded-lg"
          >
            {copied ? <Check size={13} weight="bold" className="text-[var(--accent)]" /> : <LinkIcon size={13} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all rounded-lg"
          >
            <DownloadSimple size={13} weight="bold" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
