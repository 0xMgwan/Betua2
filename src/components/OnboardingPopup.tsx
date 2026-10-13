"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, TrendUp, Trophy, ArrowRight, DeviceMobile } from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEPOSITS_ENABLED } from "@/lib/featureFlags";

export function OnboardingPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const { locale } = useLanguage();
  const isSw = locale === "sw";

  useEffect(() => {
    const seen = localStorage.getItem("hasSeenOnboarding");
    if (!seen) setIsVisible(true);
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setIsVisible(false);
  };

  const t = {
    title: isSw ? "Karibu Guap!" : "Welcome to Guap!",
    subtitle: isSw ? "Biashara kwenye matukio ya kweli na ushinde" : "Trade on real-world events and win big",
    // While deposits are paused for the sandbox review, step 1 explains the
    // pause instead of inviting a deposit the user can't actually make.
    step1: DEPOSITS_ENABLED
      ? (isSw ? "Weka Pesa" : "Fund Wallet")
      : (isSw ? "Mapitio ya Udhibiti" : "Sandbox Review"),
    step1Desc: DEPOSITS_ENABLED
      ? (isSw ? "Weka TZS kupitia M-Pesa kuanza kubiashara." : "Deposit TZS via M-Pesa to start trading.")
      : (isSw
        ? "GUAP iko chini ya mapitio ya udhibiti. Kuweka pesa kumesimamishwa kwa sasa."
        : "GUAP is under regulatory sandbox review. New deposits are paused for now."),
    step2: isSw ? "Chagua Soko" : "Pick Market",
    step2Desc: isSw ? "Tazama masoko ya michezo, crypto, siasa. Chagua NDIYO au HAPANA." : "Browse sports, crypto, politics. Choose YES or NO.",
    step3: isSw ? "Shinda & Toa" : "Win & Withdraw",
    step3Desc: isSw ? "Ukishinda, dai pesa yako. Toa wakati wowote kwa M-Pesa." : "If you win, claim it. Withdraw anytime to M-Pesa.",
    step4: isSw ? "Ongeza Kwenye Skrini" : "Add to Home Screen",
    step4Desc: isSw ? "Bonyeza ⋮ au Share → 'Add to Home Screen' kwa ufikiaji wa haraka." : "Tap ⋮ or Share → 'Add to Home Screen' for quick access.",
    cta: DEPOSITS_ENABLED
      ? (isSw ? "Anza Kubiashara" : "Start Trading")
      : (isSw ? "Tazama Masoko" : "Explore Markets"),
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bl-card fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md z-50 text-sm overflow-hidden"
          >
            {/* Terminal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-[2.5px] border-[var(--line)]" style={{ background: "var(--gold)" }}>
              <span className="text-[12px] font-extrabold uppercase tracking-[.08em]" style={{ color: "#141414" }}>Karibu GUAP</span>
              <button onClick={handleClose} aria-label="Close" style={{ color: "#141414" }} className="hover:opacity-70">
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                            <div className="text-[22px] font-black leading-tight" style={{ fontFamily: "var(--font-display)", fontStretch: "80%" }}>{t.title} 🎯</div>
              <div className="text-[var(--muted)] text-[13px]">{t.subtitle}</div>

              <div className="border-t border-[var(--card-border)] pt-3 space-y-2">
                <div className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-6 h-6 rounded-full border-2 border-[var(--line)] grid place-items-center text-[11px] font-black" style={{ background: "var(--gold)", color: "#141414" }}>1</span>
                  <div><span className="font-extrabold">{t.step1}</span> <span className="text-[var(--muted)]">- {t.step1Desc}</span></div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-6 h-6 rounded-full border-2 border-[var(--line)] grid place-items-center text-[11px] font-black" style={{ background: "var(--gold)", color: "#141414" }}>2</span>
                  <div><span className="font-extrabold">{t.step2}</span> <span className="text-[var(--muted)]">- {t.step2Desc}</span></div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-6 h-6 rounded-full border-2 border-[var(--line)] grid place-items-center text-[11px] font-black" style={{ background: "var(--gold)", color: "#141414" }}>3</span>
                  <div><span className="font-extrabold">{t.step3}</span> <span className="text-[var(--muted)]">- {t.step3Desc}</span></div>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-6 h-6 rounded-full border-2 border-[var(--line)] grid place-items-center text-[11px] font-black" style={{ background: "var(--gold)", color: "#141414" }}>4</span>
                  <div><span className="font-extrabold">{t.step4}</span> <span className="text-[var(--muted)]">- {t.step4Desc}</span></div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="bl-btn bl-btn-gold bl-btn-sm w-full mt-4"
              >
                {t.cta} <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
