"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, CaretUp, DeviceMobile, CheckCircle, Trophy, Lightning, Question, CaretLeft } from "@phosphor-icons/react";
import { useUser } from "@/store/useUser";
import { useCart } from "@/store/useCart";
import { useLanguage } from "@/contexts/LanguageContext";

const DISMISS_KEY = "guap_hiw_dismissed";

// Deterministic confetti (no Math.random → no hydration drift)
const CONFETTI = [
  { x: "6%",  y: "12%", r: 24,  c: "#00e5a0" }, { x: "16%", y: "70%", r: -18, c: "#a78bfa" },
  { x: "24%", y: "28%", r: 40,  c: "#fbbf24" }, { x: "34%", y: "85%", r: -30, c: "#f87171" },
  { x: "44%", y: "8%",  r: 12,  c: "#60a5fa" }, { x: "56%", y: "90%", r: 28,  c: "#00e5a0" },
  { x: "66%", y: "14%", r: -22, c: "#f87171" }, { x: "74%", y: "76%", r: 16,  c: "#fbbf24" },
  { x: "84%", y: "30%", r: -36, c: "#a78bfa" }, { x: "92%", y: "64%", r: 20,  c: "#00e5a0" },
  { x: "10%", y: "45%", r: 8,   c: "#60a5fa" }, { x: "88%", y: "9%",  r: -14, c: "#fbbf24" },
];

function Confetti() {
  return (
    <>
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          className="absolute w-1.5 h-3 rounded-[1px] opacity-70"
          style={{ left: p.x, top: p.y, backgroundColor: p.c, transform: `rotate(${p.r}deg)` }}
        />
      ))}
    </>
  );
}

// "How it works" explainer pinned above the mobile bottom nav (Polymarket-style).
// Logged-out users only; X dismisses permanently. One step per card — Next
// advances through 3 illustrated steps, ending on a Get Started CTA.
export function HowItWorks() {
  const { user } = useUser();
  const { items } = useCart();
  const { locale } = useLanguage();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setExpanded(false);
  };

  const open = () => { setStep(0); setExpanded(true); };

  // Hidden on auth pages too, so sign-up/login screens stay completely clean.
  if (!mounted || user || dismissed || items.length > 0 || pathname?.startsWith("/auth")) return null;

  const sw = locale === "sw";
  const steps = [
    {
      title: sw ? "Weka Pesa" : "Fund Your Account",
      desc: sw
        ? "Weka TZS kupitia M-Pesa au Mix by Yas — salio lako liko tayari kwa sekunde."
        : "Deposit TZS via M-Pesa or Mix by Yas — your balance is ready in seconds.",
      visual: (
        <div className="relative h-44 flex items-center justify-center overflow-hidden rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
          <div className="absolute w-44 h-44 rounded-full bg-[#00e5a0]/10 blur-2xl" />
          <div className="absolute top-3 left-4 w-1.5 h-3 rounded-[1px] bg-[#00e5a0]/50 rotate-12" />
          <div className="absolute bottom-4 right-5 w-1.5 h-3 rounded-[1px] bg-[#a78bfa]/50 -rotate-12" />
          {/* Phone deposit receipt */}
          <div className="relative w-56 bg-[var(--card)] border-2 border-[var(--card-border)] rounded-2xl shadow-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#00e5a0]/15 border border-[#00e5a0]/30 flex items-center justify-center">
                <DeviceMobile size={16} weight="fill" className="text-[#00e5a0]" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-mono font-bold uppercase">M-PESA</p>
                <p className="text-[9px] font-mono text-[var(--muted)]">STK Push · {sw ? "sasa hivi" : "just now"}</p>
              </div>
            </div>
            <p className="text-2xl font-mono font-black text-[#00e5a0] tabular-nums">+ TSh 5,000</p>
            <p className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#00e5a0] uppercase">
              <CheckCircle size={12} weight="fill" /> {sw ? "Imekamilika" : "Completed"}
              <span className="text-[var(--muted)] normal-case font-normal">· GUAP {sw ? "salio" : "balance"}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      title: sw ? "Chagua Upande" : "Pick a Side",
      desc: sw
        ? "Tabiri YES au NO kwenye michezo, siasa, biashara na zaidi — uwezekano mdogo, malipo makubwa."
        : "Predict YES or NO on sports, politics, business and more — lower odds, bigger payouts.",
      visual: (
        <div className="relative h-44 flex items-center justify-center overflow-hidden rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
          <div className="absolute w-44 h-44 rounded-full bg-purple-500/10 blur-2xl" />
          <div className="absolute top-4 right-6 w-1.5 h-3 rounded-[1px] bg-[#fbbf24]/50 rotate-45" />
          <div className="absolute bottom-3 left-5 w-1.5 h-3 rounded-[1px] bg-[#00e5a0]/50 -rotate-6" />
          {/* Mini market card with sparkline */}
          <div className="relative w-64 bg-[var(--card)] border-2 border-[var(--card-border)] rounded-2xl shadow-2xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-[#00e5a0]/10 border border-[#00e5a0]/20 flex items-center justify-center text-sm">⚽</span>
              <p className="text-[11px] font-mono font-bold leading-tight">
                {sw ? "Je, Simba itashinda derby?" : "Will Simba win the derby?"}
              </p>
            </div>
            <svg viewBox="0 0 220 24" className="w-full h-5 mb-1.5">
              <polyline
                points="0,18 30,16 55,19 80,12 110,14 140,8 170,10 200,4 220,6"
                fill="none" stroke="#00e5a0" strokeWidth="2" strokeLinecap="round"
              />
            </svg>
            <div className="flex gap-1.5">
              <span className="flex-1 py-1.5 text-center text-[10px] font-mono font-black bg-[#00e5a0]/20 text-[#00e5a0] border border-[#00e5a0]/40 rounded-lg">
                YES 45% · 2.2×
              </span>
              <span className="flex-1 py-1.5 text-center text-[10px] font-mono font-black bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg">
                NO 55% · 1.8×
              </span>
            </div>
            <p className="text-[9px] font-mono text-[var(--muted)] mt-1.5">
              TSh 1.2M {sw ? "mzunguko" : "vol"} · ⚡ 214 {sw ? "biashara" : "trades"}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: sw ? "Shinda na Utoe" : "Win & Withdraw",
      desc: sw
        ? "Ukishinda unalipwa mara moja — toa moja kwa moja hadi kwenye simu yako."
        : "Winning picks pay out instantly — withdraw straight to your phone.",
      visual: (
        <div className="relative h-44 flex items-center justify-center overflow-hidden rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
          <Confetti />
          <div className="absolute w-44 h-44 rounded-full bg-[#00e5a0]/15 blur-2xl" />
          {/* Winning ticket */}
          <div className="relative w-60 bg-[var(--card)] border-2 border-[#00e5a0]/40 rounded-2xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider">{sw ? "Ukishinda" : "To Win"}</p>
              <span className="text-[9px] font-mono font-bold text-[#00e5a0] uppercase">✓ {sw ? "Umeshinda" : "You Won"}</span>
            </div>
            <p className="text-3xl font-mono font-black text-[#00e5a0] tabular-nums leading-none">TSh 11,000</p>
            <p className="text-[9px] font-mono text-[var(--muted)] mt-1 border-b border-dashed border-[var(--card-border)] pb-2">
              Simba YES · TSh 5,000 @ 2.2×
            </p>
            <div className="mt-2.5 w-full py-2 flex items-center justify-center gap-1.5 bg-[#00e5a0] text-black rounded-lg text-[11px] font-mono font-black uppercase tracking-wider">
              <Trophy size={13} weight="fill" /> {sw ? "Lipwa Sasa" : "Cash Out"}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <>
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
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
                <p className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Lightning size={13} weight="fill" className="text-[#00e5a0]" />
                  {sw ? "GUAP Inavyofanya Kazi" : "How GUAP Works"}
                </p>
                <button onClick={dismiss} aria-label="Close" className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* One step at a time */}
              <div className="px-4 pt-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ x: 48, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -48, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {s.visual}
                    <p className="text-base font-mono font-black mt-3">
                      {step + 1}. {s.title}
                    </p>
                    <p className="text-[12px] text-[var(--muted)] leading-snug mt-1">{s.desc}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dots + nav */}
              <div className="px-4 pb-4 pt-3">
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      aria-label={`Step ${i + 1}`}
                      className={
                        i === step
                          ? "w-5 h-1.5 rounded-full bg-[#00e5a0] transition-all"
                          : "w-1.5 h-1.5 rounded-full bg-[var(--card-border)] transition-all"
                      }
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="px-3.5 py-3 border-2 border-[var(--card-border)] text-[var(--muted)] rounded-xl active:opacity-80"
                      aria-label={sw ? "Rudi" : "Back"}
                    >
                      <CaretLeft size={14} weight="bold" />
                    </button>
                  )}
                  {isLast ? (
                    <Link
                      href="/auth/register"
                      onClick={() => setExpanded(false)}
                      className="flex-1 py-3 text-center bg-[#00e5a0] text-black font-mono font-black text-xs uppercase tracking-wider rounded-xl active:opacity-90"
                    >
                      {sw ? "Jisajili Bure →" : "Get Started — It's Free →"}
                    </Link>
                  ) : (
                    <button
                      onClick={() => setStep(step + 1)}
                      className="flex-1 py-3 text-center bg-[var(--foreground)] text-[var(--background)] font-mono font-black text-xs uppercase tracking-wider rounded-xl active:opacity-90"
                    >
                      {sw ? "Endelea →" : "Next →"}
                    </button>
                  )}
                </div>
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
              <button onClick={open} className="flex-1 flex items-center justify-between px-4 py-2.5">
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
