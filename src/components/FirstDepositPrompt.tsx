"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowDownLeft, X, Sparkle } from "@phosphor-icons/react";

// Prompts a logged-in user with no balance to make their first deposit.
// Dismissible per-session. Terminal aesthetic with accent border.
export function FirstDepositPrompt() {
  const { user } = useUser();
  const { locale } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && sessionStorage.getItem("deposit-prompt-dismissed")) {
      setDismissed(true);
    }
  }, []);

  if (!mounted || !user || dismissed) return null;
  // Only show when balance is empty (hasn't deposited / spent everything)
  const balance = user.balanceTzs || 0;
  if (balance > 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("deposit-prompt-dismissed", "1"); } catch { /* ignore */ }
  };

  return (
    <div className="mb-6 relative overflow-hidden border-2 border-[var(--accent)]/40 bg-gradient-to-r from-[var(--accent)]/10 via-[var(--accent)]/5 to-transparent">
      {/* Scanline accent */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,229,160,0.02)_3px,rgba(0,229,160,0.02)_5px)] pointer-events-none" />
      <div className="relative flex items-center gap-3 p-4">
        <div className="shrink-0 w-11 h-11 flex items-center justify-center bg-[var(--accent)]/15 border-2 border-[var(--accent)]/40">
          <Sparkle size={22} weight="fill" className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono font-black text-sm text-[var(--foreground)] uppercase tracking-wide">
            {locale === "sw" ? "Karibu! Weka Pesa Kuanza" : "Welcome! Fund Your Wallet"}
          </p>
          <p className="text-[11px] text-[var(--muted)] font-mono mt-0.5">
            {locale === "sw"
              ? "Weka pesa kwa Mobile Money kuanza kutabiri na kushinda."
              : "Deposit via Mobile Money to start predicting and winning."}
          </p>
        </div>
        <Link
          href="/wallet"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-[var(--accent)] text-black font-mono font-black text-xs uppercase tracking-wider hover:opacity-90 transition-opacity active:scale-95"
        >
          <ArrowDownLeft size={15} weight="bold" />
          {locale === "sw" ? "Weka" : "Deposit"}
        </Link>
        <button onClick={dismiss} className="shrink-0 p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors" aria-label="Dismiss">
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
