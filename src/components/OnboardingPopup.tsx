"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, TrendUp, Trophy, ArrowRight, DeviceMobile } from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";

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
    step1: isSw ? "Weka Pesa" : "Fund Wallet",
    step1Desc: isSw ? "Weka TZS kupitia M-Pesa kuanza kubiashara." : "Deposit TZS via M-Pesa to start trading.",
    step2: isSw ? "Chagua Soko" : "Pick Market",
    step2Desc: isSw ? "Tazama masoko ya michezo, crypto, siasa. Chagua NDIYO au HAPANA." : "Browse sports, crypto, politics. Choose YES or NO.",
    step3: isSw ? "Shinda & Toa" : "Win & Withdraw",
    step3Desc: isSw ? "Ukishinda, dai pesa yako. Toa wakati wowote kwa M-Pesa." : "If you win, claim it. Withdraw anytime to M-Pesa.",
    step4: isSw ? "Ongeza Kwenye Skrini" : "Add to Home Screen",
    step4Desc: isSw ? "Bonyeza ⋮ au Share → 'Add to Home Screen' kwa ufikiaji wa haraka." : "Tap ⋮ or Share → 'Add to Home Screen' for quick access.",
    cta: isSw ? "Anza Kubiashara" : "Start Trading",
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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-md bg-black border border-[var(--accent)] z-50 font-mono text-sm"
          >
            {/* Terminal header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--accent)]/50 bg-[var(--accent)]/10">
              <span className="text-[var(--accent)] text-xs">guap@terminal:~$</span>
              <button onClick={handleClose} className="text-[var(--muted)] hover:text-white">
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="text-[var(--accent)]">
                <span className="text-white">$</span> cat welcome.txt
              </div>
              <div className="text-white font-bold text-lg">{t.title} 🎯</div>
              <div className="text-[var(--muted)] text-xs">{t.subtitle}</div>

              <div className="border-t border-[var(--card-border)] pt-3 space-y-2">
                <div className="flex gap-2">
                  <span className="text-[var(--accent)]">[1]</span>
                  <div><span className="text-white">{t.step1}</span> <span className="text-[var(--muted)]">- {t.step1Desc}</span></div>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--accent)]">[2]</span>
                  <div><span className="text-white">{t.step2}</span> <span className="text-[var(--muted)]">- {t.step2Desc}</span></div>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--accent)]">[3]</span>
                  <div><span className="text-white">{t.step3}</span> <span className="text-[var(--muted)]">- {t.step3Desc}</span></div>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--accent)]">[4]</span>
                  <div><span className="text-white">{t.step4}</span> <span className="text-[var(--muted)]">- {t.step4Desc}</span></div>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full mt-4 px-4 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs"
              >
                <span>$</span> {t.cta} <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
