"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, CaretUp, DeviceMobile, CheckCircle, Trophy, Lightning, Question } from "@phosphor-icons/react";
import { useUser } from "@/store/useUser";
import { useCart } from "@/store/useCart";
import { useLanguage } from "@/contexts/LanguageContext";

const DISMISS_KEY = "guap_hiw_dismissed";

// "How it works" explainer pinned above the mobile bottom nav (Polymarket-style).
// Shown only to logged-out users; the X dismisses it permanently (localStorage).
// Each step has a small illustrated mock drawn with CSS so it matches the theme.
export function HowItWorks() {
  const { user } = useUser();
  const { items } = useCart();
  const { locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setExpanded(false);
  };

  // Hide entirely: before hydration, for logged-in users, if dismissed, or when
  // the cart bar occupies the same spot above the bottom nav.
  if (!mounted || user || dismissed || items.length > 0) return null;

  const sw = locale === "sw";
  const steps = [
    {
      n: "1",
      title: sw ? "Weka Pesa" : "Fund Your Account",
      desc: sw ? "Weka TZS kupitia M-Pesa au Mix by Yas kwa sekunde." : "Deposit TZS via M-Pesa or Mix by Yas in seconds.",
      visual: (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[#00e5a0]/15 border border-[#00e5a0]/30 flex items-center justify-center shrink-0">
            <DeviceMobile size={16} weight="fill" className="text-[#00e5a0]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono text-[var(--muted)] uppercase">M-PESA {sw ? "MALIPO" : "DEPOSIT"}</p>
            <p className="text-sm font-mono font-black text-[#00e5a0]">+ TSh 5,000</p>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#00e5a0] uppercase shrink-0">
            <CheckCircle size={12} weight="fill" /> {sw ? "Imekamilika" : "Completed"}
          </span>
        </div>
      ),
    },
    {
      n: "2",
      title: sw ? "Chagua Upande" : "Pick a Side",
      desc: sw ? "Tabiri YES au NO kwenye michezo, siasa na zaidi." : "Predict YES or NO on sports, politics and more.",
      visual: (
        <div className="px-3 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-lg">
          <p className="text-[11px] font-mono font-bold mb-1.5 truncate">
            {sw ? "Je, Simba itashinda derby?" : "Will Simba win the derby?"}
          </p>
          <div className="flex gap-1.5">
            <span className="flex-1 py-1 text-center text-[10px] font-mono font-bold bg-[#00e5a0]/20 text-[#00e5a0] border border-[#00e5a0]/30 rounded">
              YES 45% · 2.2×
            </span>
            <span className="flex-1 py-1 text-center text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 rounded">
              NO 55% · 1.8×
            </span>
          </div>
        </div>
      ),
    },
    {
      n: "3",
      title: sw ? "Shinda na Utoe" : "Win & Withdraw",
      desc: sw ? "Ukishinda unalipwa mara moja — toa hadi simu yako." : "Winning picks pay out instantly — withdraw to your phone.",
      visual: (
        <div className="px-3 py-2.5 bg-[var(--background)] border border-dashed border-[#00e5a0]/40 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-[var(--muted)] uppercase">{sw ? "Ukishinda" : "To Win"}</p>
              <p className="text-lg font-mono font-black text-[#00e5a0]">TSh 11,000</p>
            </div>
            <span className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold bg-[#00e5a0] text-black rounded uppercase">
              <Trophy size={12} weight="fill" /> {sw ? "Lipwa" : "Cash Out"}
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop when expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <div
        className="md:hidden fixed left-0 right-0 z-40"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="sheet"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="mx-3 mb-2 bg-[var(--card)] border-2 border-[var(--card-border)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
                <p className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Lightning size={13} weight="fill" className="text-[#00e5a0]" />
                  {sw ? "GUAP Inavyofanya Kazi" : "How GUAP Works"}
                </p>
                <button onClick={dismiss} aria-label="Close" className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  <X size={16} weight="bold" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-3 max-h-[55vh] overflow-y-auto">
                {steps.map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#00e5a0] text-black text-[11px] font-mono font-black flex items-center justify-center shrink-0 mt-0.5">
                      {s.n}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div>
                        <p className="text-[13px] font-mono font-bold leading-tight">{s.title}</p>
                        <p className="text-[11px] text-[var(--muted)] leading-snug">{s.desc}</p>
                      </div>
                      {s.visual}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4 pt-1">
                <Link
                  href="/auth/register"
                  className="block w-full py-3 text-center bg-[#00e5a0] text-black font-mono font-black text-xs uppercase tracking-wider rounded-xl active:opacity-90"
                >
                  {sw ? "Jisajili Bure →" : "Get Started — It's Free →"}
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="bar"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="flex items-center bg-[var(--card)]/95 backdrop-blur-xl border-t-2 border-[var(--card-border)]"
            >
              <button
                onClick={() => setExpanded(true)}
                className="flex-1 flex items-center justify-between px-4 py-2.5"
              >
                <span className="flex items-center gap-2 text-[11px] font-mono font-black uppercase tracking-wider">
                  <Question size={14} weight="fill" className="text-[#00e5a0]" />
                  {sw ? "GUAP inavyofanya kazi" : "How GUAP works"}
                </span>
                <CaretUp size={13} weight="bold" className="text-[var(--muted)]" />
              </button>
              <button onClick={dismiss} aria-label="Dismiss" className="px-3 py-2.5 text-[var(--muted)]">
                <X size={14} weight="bold" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
