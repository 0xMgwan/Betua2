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
  Sparkle, Phone, ArrowDownLeft, XLogo, InstagramLogo,
  UserPlus, Wallet, Crosshair, WhatsappLogo,
} from "@phosphor-icons/react";
import HeroAscii from "@/components/ui/hero-ascii";
import { GlitchText } from "@/components/ui/glitch-text";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";

/* ─────────────────────────────────────────────────────────
   Live market mockup — animated YES/NO bar
   ───────────────────────────────────────────────────────── */
function LiveMarketCard() {
  const { t } = useLanguage();
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
            <span className="text-xs px-2 py-0.5 border border-[var(--foreground)]/30 text-[var(--foreground)] font-mono tracking-wider uppercase">{t.landing.liveMarket.politics}</span>
            <span className="flex items-center gap-1 text-xs text-[var(--muted)] font-mono">
              <span className="w-1.5 h-1.5 bg-[var(--foreground)] animate-pulse" />
              {t.landing.liveMarket.live}
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
          {t.landing.liveMarket.buyYes}
        </button>
        <button className="py-2.5 border border-[var(--muted)] text-[var(--muted)] font-mono font-bold text-xs tracking-wider hover:bg-[var(--muted)] hover:text-[var(--background)] transition-all uppercase">
          {t.landing.liveMarket.buyNo}
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
  const { t } = useLanguage();
  return (
    <div className="bg-[var(--card)] border-2 border-[var(--card-border)] p-4 shadow-xl w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--card-border)]">
        <Trophy size={16} weight="fill" className="text-[var(--foreground)]" />
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] font-mono">{t.landing.liveMarket.topTraders}</span>
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
const FEATURES_META = [
  { icon: Globe, emoji: "🌍", titleKey: "builtForAfrica" as const, descKey: "builtForAfricaDesc" as const, color: "#00e5a0" },
  { icon: Phone, emoji: "📱", titleKey: "mobileMoney" as const, descKey: "mobileMoneyDesc" as const, color: "#00b4d8" },
  { icon: ShieldCheck, emoji: "🔐", titleKey: "nonCustodial" as const, descKey: "nonCustodialDesc" as const, color: "#a78bfa" },
  { icon: Lightning, emoji: "⚡", titleKey: "instantPayouts" as const, descKey: "instantPayoutsDesc" as const, color: "#fbbf24" },
  { icon: ChartLineUp, emoji: "📊", titleKey: "ammPriceDiscovery" as const, descKey: "ammPriceDiscoveryDesc" as const, color: "#f472b6" },
  { icon: MagnifyingGlass, emoji: "🎯", titleKey: "sharpPredictions" as const, descKey: "sharpPredictionsDesc" as const, color: "#34d399" },
];

/* ─────────────────────────────────────────────────────────
   How it works
   ───────────────────────────────────────────────────────── */
/* HOW_IT_WORKS icons/steps - text comes from translations */
const HOW_IT_WORKS_ICONS = [
  { icon: UserPlus, color: "#00e5a0" },
  { icon: Wallet, color: "#00b4d8" },
  { icon: Crosshair, color: "#fbbf24" },
];
const HOW_IT_WORKS_STEPS = ["01", "02", "03"];

/* ─────────────────────────────────────────────────────────
   Testimonials
   ───────────────────────────────────────────────────────── */
const TESTIMONIALS_META = [
  {
    quoteKey: "quote1" as const,
    name: "Amani Kiondo",
    location: "Dar es Salaam, Tanzania",
    avatar: "https://ui-avatars.com/api/?name=Amani+Kiondo&background=00e5a0&color=0a0a0a&bold=true&size=80",
    stars: 5,
  },
  {
    quoteKey: "quote2" as const,
    name: "Saida Mwamba",
    location: "Mwanza, Tanzania",
    avatar: "https://ui-avatars.com/api/?name=Saida+Mwamba&background=00b4d8&color=0a0a0a&bold=true&size=80",
    stars: 5,
  },
  {
    quoteKey: "quote3" as const,
    name: "Kwame Asante",
    location: "Accra, Ghana",
    avatar: "https://ui-avatars.com/api/?name=Kwame+Asante&background=a78bfa&color=0a0a0a&bold=true&size=80",
    stars: 5,
  },
];

/* ─────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────── */
function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export default function HomePage() {
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const [markets, setMarkets] = useState<unknown[]>([]);
  const [stats, setStats] = useState({ totalVolume: 0, openMarkets: 0, totalTraders: 0, totalTrades: 0, resolvedMarkets: 0 });

  useEffect(() => {
    fetch("/api/markets?sort=volume")
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets?.slice(0, 6) || []));
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d));
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
        {/* Animated ASCII background - visible in all modes */}
        <div className="block">
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
                    text={t.landing.hero.title}
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
                  {t.landing.hero.subtitle}
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
                    {t.landing.hero.description}
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
                    href="/markets/create"
                    className="relative px-5 lg:px-6 py-2 lg:py-2.5 bg-transparent text-[var(--foreground)] font-mono text-xs lg:text-sm border border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-200 group"
                  >
                    <span className="hidden lg:block absolute -top-1 -left-1 w-2 h-2 border-t border-l border-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    <span className="hidden lg:block absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {t.landing.hero.createMarket}
                  </Link>
                  
                  <Link
                    href="/markets"
                    className="relative px-5 lg:px-6 py-2 lg:py-2.5 bg-transparent border border-[var(--foreground)] text-[var(--foreground)] font-mono text-xs lg:text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-200"
                  >
                    {t.landing.hero.exploreMarkets}
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
              { label: t.landing.stats.totalVolume, value: `${formatVolume(stats.totalVolume)} TZS`, sub: t.landing.stats.totalVolumeSub },
              { label: t.landing.stats.openMarkets, value: String(stats.openMarkets), sub: t.landing.stats.openMarketsSub },
              { label: t.landing.stats.activeTraders, value: formatVolume(stats.totalTraders), sub: t.landing.stats.activeTradersSub },
              { label: t.landing.stats.totalTrades, value: formatVolume(stats.totalTrades), sub: t.landing.stats.totalTradesSub },
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
          <span className="inline-block px-3 py-1 text-xs font-bold border border-[var(--foreground)]/30 text-[var(--foreground)] mb-3 uppercase tracking-wider font-mono">
            {t.landing.howItWorks.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mb-3 font-mono text-[var(--foreground)]">{t.landing.howItWorks.title}</h2>
          <p className="text-[var(--muted)] max-w-md mx-auto font-mono">{t.landing.howItWorks.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Steps */}
          <div className="space-y-6">
            {HOW_IT_WORKS_STEPS.map((stepNum, i) => {
              const stepData = [t.landing.howItWorks.step1, t.landing.howItWorks.step2, t.landing.howItWorks.step3][i];
              return (
              <motion.div
                key={stepNum}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="flex gap-5 items-start group"
              >
                <div className="relative shrink-0">
                  <motion.div
                    whileInView={{ scale: [0.8, 1.1, 1], rotate: [0, -5, 5, 0] }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2, duration: 0.6, ease: "easeOut" }}
                    whileHover={{ scale: 1.15, rotate: -3 }}
                    className="w-14 h-14 border-2 border-[var(--card-border)] group-hover:border-[var(--foreground)] transition-colors flex items-center justify-center shadow-md relative overflow-hidden cursor-pointer"
                    style={{ background: `${HOW_IT_WORKS_ICONS[i].color}10` }}
                  >
                    <motion.div
                      animate={{ y: [0, -2, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    >
                      {(() => { const IconComp = HOW_IT_WORKS_ICONS[i].icon; return <IconComp size={24} weight="fill" style={{ color: HOW_IT_WORKS_ICONS[i].color }} />; })()}
                    </motion.div>
                    {/* Glow ring */}
                    <motion.div
                      className="absolute inset-0 border-2 opacity-0"
                      style={{ borderColor: HOW_IT_WORKS_ICONS[i].color }}
                      whileInView={{ opacity: [0, 0.6, 0], scale: [0.8, 1.2] }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.2 + 0.3, duration: 0.8 }}
                    />
                  </motion.div>
                  <motion.div
                    whileInView={{ scale: [0, 1.2, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 + 0.15, duration: 0.4, ease: "backOut" }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[var(--foreground)] text-[var(--background)] font-black text-[10px] flex items-center justify-center font-mono"
                  >
                    {i + 1}
                  </motion.div>
                  {i < HOW_IT_WORKS_STEPS.length - 1 && (
                    <motion.div
                      initial={{ height: 0 }}
                      whileInView={{ height: 24 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.2 + 0.5, duration: 0.4 }}
                      className="absolute top-14 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-[var(--card-border)] to-transparent"
                    />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-1 font-mono">{t.landing.howItWorks.step} {stepNum}</p>
                  <h3 className="font-black text-lg mb-1 font-mono text-[var(--foreground)]">{stepData.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed font-mono">{stepData.desc}</p>
                </div>
              </motion.div>
              );
            })}

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-[var(--foreground)] text-[var(--foreground)] font-black text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all mt-2 font-mono tracking-wider uppercase"
              >
                {t.landing.howItWorks.createFreeAccount}
                <ArrowRight size={16} weight="bold" />
              </Link>
            </motion.div>
          </div>

          {/* Right: Terminal-themed phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative flex items-center justify-center"
          >
            {/* Phone frame */}
            <div className="relative w-[280px] mx-auto">
              {/* Phone outer shell */}
              <div className="bg-[var(--card)] border-2 border-[var(--card-border)] p-3 shadow-2xl" style={{ boxShadow: '0 0 40px rgba(0,0,0,0.3)' }}>
                {/* Status bar */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--card-border)] mb-2">
                  <span className="text-[8px] font-mono text-[var(--muted)]">09:41</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-1.5 border border-[var(--muted)] relative">
                      <motion.div animate={{ width: ['60%', '90%', '60%'] }} transition={{ duration: 3, repeat: Infinity }} className="h-full bg-[#00e5a0]" />
                    </div>
                  </div>
                </div>

                {/* App header */}
                <div className="flex items-center gap-2 px-2 mb-3">
                  <div className="w-6 h-6 border border-[var(--foreground)] flex items-center justify-center text-[8px] font-mono font-black">G</div>
                  <span className="text-xs font-mono font-bold text-[var(--foreground)]">GUAP</span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#00e5a0] animate-pulse" />
                    <span className="text-[8px] font-mono text-[#00e5a0]">LIVE</span>
                  </div>
                </div>

                {/* Balance card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="bg-[var(--background)] border border-[var(--card-border)] p-3 mb-2"
                >
                  <p className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider mb-1">BALANCE</p>
                  <motion.p
                    className="text-xl font-black font-mono text-[var(--foreground)]"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    TSh 125,400
                  </motion.p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendUp size={10} weight="bold" className="text-[#00e5a0]" />
                    <span className="text-[9px] font-mono text-[#00e5a0]">+12,500 today</span>
                  </div>
                </motion.div>

                {/* Transaction list */}
                <div className="space-y-1.5">
                  {[
                    { label: "Deposit via M-Pesa", amount: "+50,000", color: "#00e5a0", delay: 0.5 },
                    { label: "Buy YES · CCM Election", amount: "-5,000", color: "var(--muted)", delay: 0.65 },
                    { label: "Market Won!", amount: "+9,200", color: "#00e5a0", delay: 0.8 },
                  ].map((tx, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: tx.delay }}
                      className="flex items-center justify-between bg-[var(--background)] border border-[var(--card-border)] px-2.5 py-2"
                    >
                      <span className="text-[9px] font-mono text-[var(--muted)]">{tx.label}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: tx.color }}>{tx.amount}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Withdrawal success notification */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1 }}
                  className="mt-2 bg-[#00e5a0]/10 border border-[#00e5a0]/30 p-2.5 flex items-center gap-2"
                >
                  <CheckCircle size={14} weight="fill" className="text-[#00e5a0] shrink-0" />
                  <div>
                    <p className="text-[9px] font-mono text-[var(--foreground)] font-bold">{t.landing.howItWorks.sentToMpesa}</p>
                    <p className="text-[10px] font-mono font-black text-[#00e5a0]">TSh 25,000</p>
                  </div>
                </motion.div>
              </div>

              {/* Decorative glow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-[#00e5a0]/5 via-transparent to-[#00b4d8]/5 -z-10 blur-xl" />
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
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] block mb-1">{t.landing.trending.liveNow}</span>
              <h2 className="text-2xl sm:text-3xl font-black">🔥 {t.landing.trending.title}</h2>
            </div>
            <Link href="/markets" className="flex items-center gap-1 text-sm text-[var(--accent)] font-bold hover:underline">
              {t.landing.trending.allMarkets} <CaretRight size={14} weight="bold" />
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
            {t.landing.features.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mb-3">{t.landing.features.title}</h2>
          <p className="text-[var(--muted)] max-w-md mx-auto">{t.landing.features.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES_META.map(({ icon: Icon, emoji, titleKey, descKey, color }, i) => (
            <motion.div
              key={titleKey}
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
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}
              >
                <Icon size={22} weight="fill" style={{ color }} />
              </div>
              <h3 className="font-black mb-2">{t.landing.features[titleKey]}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{t.landing.features[descKey]}</p>
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
            <h2 className="text-3xl sm:text-4xl font-black mb-2 font-mono text-[var(--foreground)]">{t.landing.testimonials.title}</h2>
            <p className="text-[var(--muted)] font-mono">{t.landing.testimonials.subtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS_META.map((tm, i) => (
              <motion.div
                key={tm.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="flex gap-0.5">
                  {[...Array(tm.stars)].map((_, si) => (
                    <Star key={`${tm.name}-star-${si}`} size={14} weight="fill" className="text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-[var(--foreground)] leading-relaxed flex-1">
                  &ldquo;{t.landing.testimonials[tm.quoteKey]}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--card-border)]">
                  <Image
                    src={tm.avatar}
                    alt={tm.name}
                    width={36}
                    height={36}
                    className="rounded-full"
                    unoptimized
                  />
                  <div>
                    <p className="text-sm font-bold">{tm.name}</p>
                    <p className="text-xs text-[var(--muted)]">{tm.location}</p>
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
                🌍 {t.landing.mission.madeInAfrica}
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
              {t.landing.mission.badge}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-5 leading-tight">
              {t.landing.mission.title1}<br />{t.landing.mission.title2}
            </h2>
            <p className="text-[var(--muted)] text-base leading-relaxed mb-6">
              {t.landing.mission.description}
            </p>

            <div className="space-y-3">
              {[
                t.landing.mission.point1,
                t.landing.mission.point2,
                t.landing.mission.point3,
                t.landing.mission.point4,
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
            <h2 className="text-3xl sm:text-5xl font-black mb-4 leading-tight font-mono text-[var(--foreground)]">
              {t.landing.cta.title1}<br />{t.landing.cta.title2}
            </h2>
            <p className="text-[var(--muted)] mb-8 max-w-lg mx-auto text-lg leading-relaxed font-mono">
              {t.landing.cta.subtitle}
            </p>

            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <Link
                  href={user ? "/wallet" : "/auth/register"}
                  className="group flex items-center gap-2 px-10 py-4 border-2 border-[var(--foreground)] text-[var(--foreground)] font-black text-lg hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all w-full sm:w-auto justify-center font-mono tracking-wider uppercase"
                >
                  {user ? (locale === "sw" ? "ANZA KUTRADE" : "START TRADING") : t.landing.cta.button}
                  <ArrowRight size={20} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="https://chat.whatsapp.com/CfFU1jLmjDO8QLrH31Sv0C"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-10 py-4 border-2 border-[#25D366] text-[#25D366] font-black text-lg hover:bg-[#25D366] hover:text-white transition-all w-full sm:w-auto justify-center font-mono tracking-wider uppercase"
                >
                  {locale === "sw" ? "JIUNGE NA JAMII" : "JOIN COMMUNITY"}
                  <UsersThree size={20} weight="bold" className="group-hover:scale-110 transition-transform" />
                </a>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[var(--accent)]" /> {t.landing.cta.noKyc}</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[var(--accent)]" /> {t.landing.cta.mpesaSupported}</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[var(--accent)]" /> {t.landing.cta.freeToJoin}</span>
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
                <div className="w-8 h-8 border-2 border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] font-black text-sm font-mono">
                  G
                </div>
                <span className="text-[var(--foreground)] font-mono">GUAP</span>
              </Link>
              <p className="text-sm text-[var(--muted)] leading-relaxed max-w-xs font-mono">
                {t.landing.footer.description}
              </p>
            </div>

            {/* Links */}
            {[
              { title: t.landing.footer.platform, links: [{ href: "/markets", label: t.landing.footer.browseMarkets }, { href: "/markets/create", label: t.landing.footer.createMarket }, { href: "/leaderboard", label: t.landing.footer.leaderboard }] },
              { title: t.landing.footer.account, links: [{ href: "/auth/register", label: t.landing.footer.signUp }, { href: "/auth/login", label: t.landing.footer.signIn }, { href: "/wallet", label: t.landing.footer.wallet }] },
              { title: t.landing.footer.about, links: [{ href: "#about", label: t.landing.footer.aboutGuap }, { href: "#ntzs", label: t.landing.footer.ntzsNetwork }, { href: "https://chat.whatsapp.com/CfFU1jLmjDO8QLrH31Sv0C", label: t.landing.footer.contact }] },
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
            <p className="font-mono">{t.landing.footer.copyright} <strong className="text-[var(--foreground)]">nTZS</strong></p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <a
                  href="https://x.com/youneedguap?s=21&t=hj2iETJ0AG45JhGdjSLNcg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                  aria-label="Follow us on X"
                >
                  <XLogo size={16} weight="fill" />
                </a>
                <a
                  href="#"
                  className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors cursor-not-allowed opacity-50"
                  aria-label="Follow us on Instagram (coming soon)"
                >
                  <InstagramLogo size={16} weight="fill" />
                </a>
                <a
                  href="https://chat.whatsapp.com/CfFU1jLmjDO8QLrH31Sv0C"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--muted)] hover:text-[#25D366] transition-colors"
                  aria-label="Join our WhatsApp community"
                >
                  <WhatsappLogo size={16} weight="fill" />
                </a>
              </div>
              <p className="flex items-center gap-1.5">
                {t.landing.footer.madeWith} <Handshake size={13} weight="fill" className="text-[var(--accent)]" /> {t.landing.footer.forAfrica} 🌍
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
