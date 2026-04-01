"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, TrendUp, Trophy, ArrowRight } from "@phosphor-icons/react";

export function OnboardingPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4 bg-[var(--card)] border-2 border-[var(--accent)] rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#00e5a0]/20 via-[#00c896]/10 to-[#00b4d8]/15 p-6 border-b border-[var(--card-border)]">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 hover:bg-[var(--background)]/50 rounded-lg transition-colors"
              >
                <X size={20} weight="bold" />
              </button>
              <h2 className="text-2xl font-black mb-2">Welcome to Guap! 🎯</h2>
              <p className="text-sm text-[var(--muted)]">
                Trade on real-world events and win big
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  <Wallet size={20} weight="duotone" className="text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">1. Fund Your Wallet</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Deposit TZS via M-Pesa to start trading. Quick and secure.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  <TrendUp size={20} weight="duotone" className="text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">2. Pick a Market</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Browse markets on sports, crypto, politics, and more. Choose YES or NO.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  <Trophy size={20} weight="duotone" className="text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">3. Win & Withdraw</h3>
                  <p className="text-sm text-[var(--muted)]">
                    If you're right, claim your winnings. Withdraw anytime to M-Pesa.
                  </p>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleClose}
                className="w-full mt-6 px-6 py-3 bg-[var(--accent)] text-black font-bold rounded-xl hover:bg-[var(--accent)]/90 transition-all flex items-center justify-center gap-2 group"
              >
                Start Trading
                <ArrowRight size={18} weight="bold" className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
