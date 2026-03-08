"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { MarketCard } from "@/components/MarketCard";
import { useEffect, useState } from "react";
import {
  ChartLineUp, ShieldCheck, Lightning, Globe, ArrowRight,
  CaretRight, CheckCircle, Star, UsersThree, CurrencyDollar,
  Handshake, TrendUp, MagnifyingGlass, Trophy,
  Sparkle, Phone, ArrowDownLeft,
} from "@phosphor-icons/react";
import HeroAscii from "@/components/ui/hero-ascii";
import { GlitchText } from "@/components/ui/glitch-text";

/* ─────────────────────────────────────────────────────────
   Live market mockup — animated YES/NO bar
   ───────────────────────────────────────────────────────── */
function LiveMarketCard() {
  const [pct, setPct] = useState(67);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => Math.min(84, Math.max(46, p + (Math.random() - 0.48) * 1.6)));
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[var(--card)] border-2 border-[var(--card-border)] p-5 shadow-xl w-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 border border-[var(--foreground)]/30 flex items-center justify-center text-lg shrink-0">
          🗳️
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-snug font-mono">CCM wins Tanzania 2025 general election?</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 border border-[var(--foreground)]/30 text-[var(--foreground)] font-mono tracking-wider uppercase">POLITICS</span>
            <span className="flex items-center gap-1 text-xs text-[var(--muted)] font-mono">
              <span className="w-1.5 h-1.5 bg-[var(--foreground)] animate-pulse" />
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Probability */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-bold text-[var(--foreground)] font-mono">YES {Math.round(pct)}%</span>
          <span className="text-sm font-bold text-[var(--muted)] font-mono">NO {Math.round(100 - pct)}%</span>
        </div>
        <div className="h-3 bg-[var(--muted)]/15 border border-[var(--muted)]/10 overflow-hidden">
          <motion.div
            className="h-full bg-[var(--foreground)]"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button className="py-2.5 border border-[var(--foreground)] text-[var(--foreground)] font-mono font-bold text-xs tracking-wider hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all uppercase">
          BUY YES
        </button>
        <button className="py-2.5 border border-[var(--muted)] text-[var(--muted)] font-mono font-bold text-xs tracking-wider hover:bg-[var(--muted)] hover:text-[var(--background)] transition-all uppercase">
          BUY NO
        </button>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--card-border)] text-xs text-[var(--muted)] font-mono">
        <span className="flex items-center gap-1"><UsersThree size={11} /> 3.2K</span>
        <span className="flex items-center gap-1"><CurrencyDollar size={11} /> 12.5M</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={tick}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-[var(--foreground)] font-bold"
          >
            <ChartLineUp size={12} weight="fill" />
            {(Math.random() > 0.5 ? "+" : "-")}{Math.floor(Math.random() * 500 + 50)} TZS
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Mini leaderboard mockup
   ───────────────────────────────────────────────────────── */
const MOCK_USERS = [
  { name: "Amani K.", profit: "+145,000 TZS", rank: 1 },
  { name: "Juma W.", profit: "+98,500 TZS", rank: 2 },
  { name: "Saida M.", profit: "+72,200 TZS", rank: 3 },
];

function LeaderboardMockup() {
  return (
    <div className="bg-[var(--card)] border-2 border-[var(--card-border)] p-4 shadow-xl w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--card-border)]">
        <Trophy size={16} weight="fill" className="text-[var(--foreground)]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] font-mono">TOP TRADERS</span>
      </div>
      <div className="space-y-2">
        {MOCK_USERS.map((u, i) => (
          <div key={u.name} className="flex items-center gap-3 font-mono">
            <span className={`text-xs font-black w-4 ${i === 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
              #{u.rank}
            </span>
            <div className="w-7 h-7 border border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] font-black text-xs">
              {u.name[0]}
            </div>
            <span className="flex-1 text-xs font-semibold truncate text-[var(--foreground)]">{u.name}</span>
            <span className="text-xs font-bold text-[var(--foreground)]">{u.profit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Features
   ───────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Globe,
    emoji: "🌍",
    title: "Built for Africa",
    desc: "All markets priced in local currencies, starting with Tanzanian Shillings. Built for African events — politics, football, business, entertainment and beyond.",
    color: "#00e5a0",
    weight: "fill" as const,
  },
  {
    icon: Phone,
    emoji: "📱",
    title: "Mobile Money Native",
    desc: "Deposit and withdraw instantly with M-Pesa, MTN Mobile Money, Airtel Money, and other African mobile networks. No bank account needed.",
    color: "#00b4d8",
    weight: "fill" as const,
  },
  {
    icon: ShieldCheck,
    emoji: "🔐",
    title: "Non-Custodial Wallets",
    desc: "Your TZS lives in your nTZS smart wallet on Base. Betua never holds your funds — you're always in control.",
    color: "#a78bfa",
    weight: "fill" as const,
  },
  {
    icon: Lightning,
    emoji: "⚡",
    title: "Instant Payouts",
    desc: "Markets resolve on-chain the moment outcomes are confirmed. Winnings are sent to your wallet automatically.",
    color: "#fbbf24",
    weight: "fill" as const,
  },
  {
    icon: ChartLineUp,
    emoji: "📊",
    title: "AMM Price Discovery",
    desc: "Our Automated Market Maker ensures you can always buy or sell. Market prices reflect the true probability a crowd believes.",
    color: "#f472b6",
    weight: "fill" as const,
  },
  {
    icon: MagnifyingGlass,
    emoji: "🎯",
    title: "Sharp Predictions",
    desc: "Research your markets, study volume trends, and make informed trades. Information is your edge — use it.",
    color: "#34d399",
    weight: "fill" as const,
  },
];

/* ─────────────────────────────────────────────────────────
   How it works
   ───────────────────────────────────────────────────────── */
const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "📲",
    title: "Create a free account",
    desc: "Sign up with just your email and pick a username. Your nTZS smart wallet is created automatically in seconds.",
  },
  {
    step: "02",
    icon: "💰",
    title: "Deposit via M-Pesa",
    desc: "Enter any amount above 1,000 TZS and your M-Pesa number. You'll get an STK push to complete the payment.",
  },
  {
    step: "03",
    icon: "🎯",
    title: "Pick your markets",
    desc: "Browse open markets, research the odds, then buy YES or NO shares. Sell anytime. Get paid when you're right.",
  },
];

/* ─────────────────────────────────────────────────────────
   Testimonials
   ───────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    quote: "Made 50,000 TZS on the Simba vs Yanga derby. Betua is genuinely the best thing to happen to sports fans across East Africa.",
    name: "Amani Kiondo",
    location: "Dar es Salaam, Tanzania",
    avatar: "https://ui-avatars.com/api/?name=Amani+Kiondo&background=00e5a0&color=0a0a0a&bold=true&size=80",
    stars: 5,
  },
  {
    quote: "Depositing with M-Pesa took literally 30 seconds. Never thought I'd be trading predictions with my phone this easily in Africa.",
    name: "Saida Mwamba",
    location: "Mwanza, Tanzania",
    avatar: "https://ui-avatars.com/api/?name=Saida+Mwamba&background=00b4d8&color=0a0a0a&bold=true&size=80",
    stars: 5,
  },
  {
    quote: "Finally a platform built for Africa. No USD headaches, no crypto complexity. Just predict, earn, and withdraw via mobile money.",
    name: "Kwame Asante",
    location: "Accra, Ghana",
    avatar: "https://ui-avatars.com/api/?name=Kwame+Asante&background=a78bfa&color=0a0a0a&bold=true&size=80",
    stars: 5,
  },
];

/* ─────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────── */
export default function HomePage() {
  const [markets, setMarkets] = useState<unknown[]>([]);


  useEffect(() => {
    fetch("/api/markets?sort=volume")
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets?.slice(0, 6) || []));
  }, []);

  const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="min-h-screen bg-[var(--background)] overflow-x-hidden" suppressHydrationWarning>
      <Navbar />

      {/* ══════════════════════════════════════════════
          HERO — Terminal-style GUAP Hero Section
          ══════════════════════════════════════════════ */}
      <section className="relative min-h-screen overflow-hidden bg-[var(--background)]">
        {/* Animated ASCII background - only in dark mode */}
        <div className="dark:block hidden">
          <HeroAscii />
        </div>
        
        {/* Mobile stars background */}
        <div className="absolute inset-0 w-full h-full lg:hidden stars-bg"></div>

        {/* Corner Frame Accents */}
        <div className="absolute top-0 left-0 w-8 h-8 lg:w-12 lg:h-12 border-t-2 border-l-2 border-[var(--foreground)]/30 z-20"></div>
        <div className="absolute top-0 right-0 w-8 h-8 lg:w-12 lg:h-12 border-t-2 border-r-2 border-[var(--foreground)]/30 z-20"></div>
        <div className="absolute left-0 w-8 h-8 lg:w-12 lg:h-12 border-b-2 border-l-2 border-[var(--foreground)]/30 z-20" style={{ bottom: '5vh' }}></div>
        <div className="absolute right-0 w-8 h-8 lg:w-12 lg:h-12 border-b-2 border-r-2 border-[var(--foreground)]/30 z-20" style={{ bottom: '5vh' }}></div>

        <div className="relative z-10 flex min-h-screen items-center pt-12 lg:pt-16">
          <div className="container mx-auto px-6 lg:px-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Content */}
              <div className="max-w-2xl relative">
                {/* Top decorative line */}
                <div className="flex items-center gap-2 mb-3 opacity-60">
                  <div className="w-8 h-px bg-[var(--foreground)]"></div>
                  <span className="text-[var(--foreground)] text-[10px] font-mono tracking-wider">001</span>
                  <div className="flex-1 h-px bg-[var(--foreground)]"></div>
                </div>

                {/* Glitch Text Title */}
                <div className="relative mb-4">
                  <div className="hidden lg:block absolute -left-3 top-0 bottom-0 w-1 dither-pattern opacity-40"></div>
                  <GlitchText 
                    text="PREDICT THE FUTURE"
                    textClassName="text-3xl lg:text-5xl font-black font-mono tracking-wider"
                    className="min-h-[100px] lg:min-h-[140px] p-0 justify-start items-start"
                    containerClassName="text-left"
                  />
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl lg:text-4xl font-bold text-[var(--foreground)] mb-3 leading-tight font-mono tracking-wider"
                >
                  EARN <span className="text-[var(--foreground)]/90">GUAP</span>
                </motion.h2>

                {/* Decorative dots pattern - desktop only */}
                <div className="hidden lg:flex gap-1 mb-2 opacity-40">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="w-0.5 h-0.5 bg-[var(--foreground)] rounded-full"></div>
                  ))}
                </div>

                {/* Description */}
                <motion.div 
                  className="relative"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-xs lg:text-base text-[var(--muted)] mb-4 lg:mb-5 leading-relaxed font-mono">
                    Trade YES or NO on African events. Politics, sports, business. Powered by mobile money.
                  </p>
                  
                  {/* Technical corner accent - desktop only */}
                  <div className="hidden lg:block absolute -right-4 top-1/2 w-3 h-3 border border-[var(--foreground)] opacity-30" style={{ transform: 'translateY(-50%)' }}>
                    <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-[var(--foreground)]" style={{ transform: 'translate(-50%, -50%)' }}></div>
                  </div>
                </motion.div>

                {/* Buttons */}
                <motion.div 
                  className="flex flex-col lg:flex-row gap-3 lg:gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Link
                    href="/auth/register"
                    className="relative px-5 lg:px-6 py-2 lg:py-2.5 bg-transparent text-[var(--foreground)] font-mono text-xs lg:text-sm border border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-200 group"
                  >
                    <span className="hidden lg:block absolute -top-1 -left-1 w-2 h-2 border-t border-l border-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    <span className="hidden lg:block absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    CREATE MARKET
                  </Link>
                  
                  <Link
                    href="/markets"
                    className="relative px-5 lg:px-6 py-2 lg:py-2.5 bg-transparent border border-[var(--foreground)] text-[var(--foreground)] font-mono text-xs lg:text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-200"
                  >
                    EXPLORE MARKETS
                  </Link>
                </motion.div>

                {/* Bottom technical notation - desktop only */}
                <div className="hidden lg:flex items-center gap-2 mt-4 opacity-40">
                  <span className="text-[var(--foreground)] text-[9px] font-mono">∞</span>
                  <div className="flex-1 h-px bg-[var(--foreground)]"></div>
                  <span className="text-[var(--foreground)] text-[9px] font-mono">GUAP</span>
                </div>
              </div>

              {/* Right: Live Market Example */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="relative"
              >
                <div className="space-y-3 lg:space-y-4">
                  <LiveMarketCard />
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.6 }}
                    className="hidden lg:block"
                  >
                    <LeaderboardMockup />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="absolute left-0 right-0 z-20 border-t border-[var(--foreground)]/20 bg-[var(--background)]/40 backdrop-blur-sm" style={{ bottom: '5vh' }}>
          <div className="container mx-auto px-4 lg:px-8 py-2 lg:py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-6 text-[8px] lg:text-[9px] font-mono text-[var(--foreground)]/50">
              <span className="hidden lg:inline">SYSTEM.ACTIVE</span>
              <span className="lg:hidden">SYS.ACT</span>
              <div className="hidden lg:flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-1 h-3 bg-[var(--foreground)]/30" style={{ height: `${Math.random() * 12 + 4}px` }}></div>
                ))}
              </div>
              <span>V1.0.0</span>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-4 text-[8px] lg:text-[9px] font-mono text-[var(--foreground)]/50">
              <span className="hidden lg:inline">◐ RENDERING</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-[var(--foreground)]/60 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-[var(--foreground)]/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-[var(--foreground)]/20 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span className="hidden lg:inline">FRAME: ∞</span>
            </div>
          </div>
        </div>

        <style jsx>{`
          .dither-pattern {
            background-image: 
              repeating-linear-gradient(0deg, transparent 0px, transparent 1px, var(--foreground) 1px, var(--foreground) 2px),
              repeating-linear-gradient(90deg, transparent 0px, transparent 1px, var(--foreground) 1px, var(--foreground) 2px);
            background-size: 3px 3px;
          }
          
          .stars-bg {
            background-image: 
              radial-gradient(1px 1px at 20% 30%, var(--foreground), transparent),
              radial-gradient(1px 1px at 60% 70%, var(--foreground), transparent),
              radial-gradient(1px 1px at 50% 50%, var(--foreground), transparent),
              radial-gradient(1px 1px at 80% 10%, var(--foreground), transparent),
              radial-gradient(1px 1px at 90% 60%, var(--foreground), transparent),
              radial-gradient(1px 1px at 33% 80%, var(--foreground), transparent),
              radial-gradient(1px 1px at 15% 60%, var(--foreground), transparent),
              radial-gradient(1px 1px at 70% 40%, var(--foreground), transparent);
            background-size: 200% 200%, 180% 180%, 250% 250%, 220% 220%, 190% 190%, 240% 240%, 210% 210%, 230% 230%;
            background-position: 0% 0%, 40% 40%, 60% 60%, 20% 20%, 80% 80%, 30% 30%, 70% 70%, 50% 50%;
            opacity: 0.3;
          }
        `}</style>
      </section>

      {/* ══════════════════════════════════════════════
          STATS BAR
          ══════════════════════════════════════════════ */}
      <section className="border-y border-[var(--card-border)] bg-[var(--card)]/50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 text-center">
            {[
              { label: "Total Volume", value: "2.4B+ TZS", sub: "across all markets" },
              { label: "Open Markets", value: "340+", sub: "new markets weekly" },
              { label: "Active Traders", value: "12,000+", sub: "& growing daily" },
              { label: "Average Payout", value: "94%", sub: "return on winning trades" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
              >
                <div className="text-xl sm:text-3xl font-black gradient-text mb-0.5 tabular-nums leading-tight">{s.value}</div>
                <div className="text-xs text-[var(--muted)] font-medium leading-tight">{s.label}</div>
                <div className="text-[10px] text-[var(--muted)]/60 hidden sm:block mt-0.5">{s.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS — with real mobile payment photo
          ══════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 mb-3 uppercase tracking-widest">
            Simple process
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Up and trading in minutes</h2>
          <p className="text-[var(--muted)] max-w-md mx-auto">No bank account, no ID upload, no waiting. Just M-Pesa.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Steps */}
          <div className="space-y-6">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="flex gap-5 items-start group"
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--card)] border-2 border-[var(--card-border)] group-hover:border-[var(--accent)]/40 transition-all flex items-center justify-center text-2xl shadow-md">
                    {step.icon}
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] text-black font-black text-[10px] flex items-center justify-center">
                    {i + 1}
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-px h-6 bg-gradient-to-b from-[var(--card-border)] to-transparent" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest mb-1">Step {step.step}</p>
                  <h3 className="font-black text-lg mb-1">{step.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-[var(--accent)] text-black font-black rounded-xl text-sm hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20 mt-2"
              >
                Create Free Account
                <ArrowRight size={16} weight="bold" />
              </Link>
            </motion.div>
          </div>

          {/* Right: Real photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden aspect-[4/3] lg:aspect-auto lg:h-[420px]"
          >
            <Image
              src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=800&q=85&auto=format&fit=crop"
              alt="Mobile payment on phone"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#00e5a0]/10 to-[#00b4d8]/10" />

            {/* Overlay stat card */}
            <div className="absolute bottom-5 left-5 right-5">
              <div className="bg-[var(--card)]/90 backdrop-blur-md border border-[var(--card-border)] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--muted)] font-medium">Your last withdrawal</p>
                  <p className="text-lg font-black text-[var(--accent)]">TSh 25,000</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-3 py-1.5 rounded-xl">
                  <CheckCircle size={13} weight="fill" />
                  Sent to M-Pesa
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TRENDING MARKETS
          ══════════════════════════════════════════════ */}
      {markets.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-8"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] block mb-1">Live now</span>
              <h2 className="text-2xl sm:text-3xl font-black">🔥 Trending Markets</h2>
            </div>
            <Link href="/markets" className="flex items-center gap-1 text-sm text-[var(--accent)] font-bold hover:underline">
              All markets <CaretRight size={14} weight="bold" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((m: unknown, i) => (
              <MarketCard
                key={(m as { id: string }).id}
                market={m as Parameters<typeof MarketCard>[0]["market"]}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          FEATURES GRID
          ══════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-[#00b4d8]/10 text-[#00b4d8] border border-[#00b4d8]/20 mb-3 uppercase tracking-widest">
            Why Betua
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Built for serious predictors</h2>
          <p className="text-[var(--muted)] max-w-md mx-auto">Every feature designed to give you an edge in African prediction markets.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, emoji, title, desc, color }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              whileHover={{ y: -5, transition: { duration: 0.18 } }}
              className="group relative bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 overflow-hidden cursor-default"
            >
              {/* hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at 0% 100%, ${color}0a 0%, transparent 70%)` }}
              />
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-xl transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}
              >
                {emoji}
              </div>
              <h3 className="font-black mb-2">{title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TESTIMONIALS — real photos via ui-avatars
          ══════════════════════════════════════════════ */}
      <section className="bg-[var(--card)]/40 border-y border-[var(--card-border)] py-20">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-black mb-2">Africa loves Betua</h2>
            <p className="text-[var(--muted)]">Real traders, real earnings, real stories.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="flex gap-0.5">
                  {[...Array(t.stars)].map((_, si) => (
                    <Star key={`${t.name}-star-${si}`} size={14} weight="fill" className="text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-[var(--foreground)] leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--card-border)]">
                  <Image
                    src={t.avatar}
                    alt={t.name}
                    width={36}
                    height={36}
                    className="rounded-full"
                    unoptimized
                  />
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-[var(--muted)]">{t.location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          AFRICA SECTION — real photo + mission text
          ══════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden aspect-[4/3]"
          >
            <Image
              src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=900&q=85&auto=format&fit=crop"
              alt="Africa landscape"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--background)]/60 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5">
              <span className="inline-flex items-center gap-1.5 bg-[var(--card)]/80 backdrop-blur-sm border border-[var(--card-border)] text-xs font-semibold px-3 py-1.5 rounded-lg">
                🌍 Made in Africa
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 mb-4 uppercase tracking-widest">
              Our mission
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-5 leading-tight">
              Built for Africa.<br />Starting in Tanzania.
            </h2>
            <p className="text-[var(--muted)] text-base leading-relaxed mb-6">
              Betua is Africa&apos;s prediction market — built to work with local currencies, mobile money,
              and the events Africans actually care about. We&apos;re launching in Tanzania with TZS and M-Pesa,
              then expanding across the continent. No USD conversion. No foreign complexity. Just local
              knowledge turned into earnings.
            </p>

            <div className="space-y-3">
              {[
                "Launching in Tanzania — expanding across all of Africa",
                "Deposit and withdraw with M-Pesa, MTN, Airtel Money & more",
                "Trade on African politics, football, business & entertainment",
                "Non-custodial wallets secured by Base blockchain",
              ].map((point, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-2.5"
                >
                  <CheckCircle size={17} weight="fill" className="text-[var(--accent)] mt-0.5 shrink-0" />
                  <span className="text-sm text-[var(--muted)]">{point}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-3xl border border-[var(--card-border)]"
        >
          {/* Background photo with overlay */}
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&q=80&auto=format&fit=crop"
              alt="CTA background"
              fill
              className="object-cover opacity-[0.07] dark:opacity-[0.05]"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#00e5a0]/15 via-[var(--card)] to-[#00b4d8]/10" />
          </div>

          {/* Animated orbs */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 7, repeat: Infinity }}
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[var(--accent)]/10 blur-3xl pointer-events-none"
          />

          <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="inline-block mb-4"
            >
              <Sparkle size={28} weight="fill" className="text-[var(--accent)]" />
            </motion.div>
            <h2 className="text-3xl sm:text-5xl font-black mb-4 leading-tight">
              Ready to make<br />your first prediction?
            </h2>
            <p className="text-[var(--muted)] mb-8 max-w-lg mx-auto text-lg leading-relaxed">
              Join 12,000+ traders across Africa already trading on Betua.
              Create your account in under 60 seconds — completely free.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="group flex items-center gap-2 px-10 py-4 bg-[var(--accent)] text-black font-black rounded-2xl text-lg hover:opacity-90 active:scale-95 transition-all shadow-2xl shadow-[var(--accent)]/25 w-full sm:w-auto justify-center"
              >
                Create Free Account
                <ArrowRight size={20} weight="bold" className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[var(--accent)]" /> No KYC required</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[var(--accent)]" /> M-Pesa supported</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[var(--accent)]" /> Free to join</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════ */}
      <footer className="border-t border-[var(--card-border)] py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 font-black text-xl mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-black text-sm">
                  B
                </div>
                <span className="gradient-text">Betua</span>
              </Link>
              <p className="text-sm text-[var(--muted)] leading-relaxed max-w-xs">
                Africa&apos;s first prediction market. Trade on local events starting in Tanzania.
              </p>
            </div>

            {/* Links */}
            {[
              { title: "Platform", links: [{ href: "/markets", label: "Browse Markets" }, { href: "/markets/create", label: "Create Market" }, { href: "/leaderboard", label: "Leaderboard" }] },
              { title: "Account", links: [{ href: "/auth/register", label: "Sign Up" }, { href: "/auth/login", label: "Sign In" }, { href: "/wallet", label: "Wallet" }] },
              { title: "About", links: [{ href: "#about", label: "About Betua" }, { href: "#ntzs", label: "nTZS Network" }, { href: "#contact", label: "Contact" }] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-black text-xs uppercase tracking-widest text-[var(--muted)] mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--card-border)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
            <p>© 2025 Betua. Powered by <strong className="text-[var(--foreground)]">nTZS</strong> on Base.</p>
            <p className="flex items-center gap-1.5">
              Made with <Handshake size={13} weight="fill" className="text-[var(--accent)]" /> for Africa 🌍
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
