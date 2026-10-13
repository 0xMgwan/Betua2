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
  UserPlus, Wallet, Crosshair, WhatsappLogo, Terminal,
} from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CountUp, Tilt } from "@/components/bongo/Motion";
import { LiveMarketDeck } from "@/components/bongo/LiveMarketDeck";
import { GlitchHeadline } from "@/components/bongo/GlitchHeadline";
import { OddsCanvas } from "@/components/bongo/OddsCanvas";
import { useUser } from "@/store/useUser";
import { ActivityTicker } from "@/components/ActivityTicker";
import { QuickBuyModal } from "@/components/QuickBuyModal";
import { DEPOSITS_ENABLED } from "@/lib/featureFlags";
import { SandboxNotice } from "@/components/SandboxNotice";

/* ─────────────────────────────────────────────────────────
   Live market mockup — animated YES/NO bar
   ───────────────────────────────────────────────────────── */
function LiveMarketCard() {
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [markets, setMarkets] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBuy, setShowBuy] = useState(false);
  const [side, setSide] = useState<"YES" | "NO">("YES");

  // Pull real open markets (binary preferred for the YES/NO showcase).
  useEffect(() => {
    fetch("/api/markets?status=OPEN&sort=volume")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all: any[] = d?.markets || [];
        const binary = all.filter((m) => !m.options || m.options.length < 2);
        setMarkets((binary.length ? binary : all).slice(0, 8));
      })
      .catch(() => {});
  }, []);

  // Auto-rotate every ~4.5s, like the markets-page hero (paused while buying).
  useEffect(() => {
    if (markets.length < 2 || showBuy) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % markets.length), 4500);
    return () => clearInterval(id);
  }, [markets.length, showBuy]);

  const m = markets[idx];
  const isMulti = m?.options && m.options.length >= 2;
  const openBuy = (s: "YES" | "NO") => { if (!m) return; setSide(s); setShowBuy(true); };
  const yesPct = m ? Math.round(((isMulti ? (m.optionPrices?.[0] ?? 0.5) : (m.price?.yes ?? 0.5)) * 100)) : 51;
  const noPct = 100 - yesPct;
  const volume = m?.totalVolume ?? 0;
  const volLabel = volume >= 1_000_000 ? `${(volume / 1_000_000).toFixed(1)}M` : volume >= 1000 ? `${(volume / 1000).toFixed(1)}K` : `${volume}`;
  const href = m ? `/markets/${m.id}` : "/markets";

  return (
    <div className="bg-[var(--card)] border-2 border-[var(--card-border)] p-5 shadow-xl w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={m?.id ?? "loading"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 border border-[var(--foreground)]/30 flex items-center justify-center text-lg shrink-0 overflow-hidden">
              {m?.imageUrl ? <img src={m.imageUrl} alt="" className="w-full h-full object-cover" /> : "📈"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm leading-snug font-mono line-clamp-2 min-h-[2.5em]">{m?.title || "Predict the outcome. Earn GUAP."}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 border border-[var(--foreground)]/30 text-[var(--foreground)] font-mono tracking-wider uppercase">{m?.category || t.landing.liveMarket.business}</span>
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
              <span className="text-sm font-bold text-[var(--foreground)] font-mono truncate max-w-[55%]">{isMulti ? (m.options?.[0] ?? "YES") : "YES"} {yesPct}%</span>
              <span className="text-sm font-bold text-[var(--muted)] font-mono">{isMulti ? "OTHER" : "NO"} {noPct}%</span>
            </div>
            <div className="h-3 bg-[var(--muted)]/15 border border-[var(--muted)]/10 overflow-hidden">
              <motion.div
                className="h-full bg-[var(--foreground)]"
                animate={{ width: `${yesPct}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Buttons → quick-buy modal (binary), or open the market for multi */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {isMulti ? (
              <Link href={href} className="col-span-2 text-center py-2.5 bg-[var(--foreground)] text-[var(--background)] font-mono font-bold text-xs tracking-wider hover:opacity-90 transition-opacity uppercase">
                Trade →
              </Link>
            ) : (
              <>
                <button
                  onClick={() => openBuy("YES")}
                  className="py-2.5 bg-[var(--foreground)] text-[var(--background)] border border-[var(--foreground)] font-mono font-bold text-xs tracking-wider hover:opacity-90 transition-opacity uppercase"
                >
                  {t.landing.liveMarket.buyYes}
                </button>
                <button
                  onClick={() => openBuy("NO")}
                  className="py-2.5 bg-transparent border border-[var(--foreground)]/40 text-[var(--foreground)] font-mono font-bold text-xs tracking-wider hover:bg-[var(--foreground)]/5 transition-colors uppercase"
                >
                  {t.landing.liveMarket.buyNo}
                </button>
              </>
            )}
          </div>

          {/* Footer stats — real */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--card-border)] text-xs text-[var(--muted)] font-mono">
            <span className="flex items-center gap-1"><UsersThree size={11} /> {m?._count?.trades ?? 0}</span>
            <span className="flex items-center gap-1">TSh {volLabel}</span>
            <span className="flex items-center gap-1 text-[var(--foreground)] font-bold"><ChartLineUp size={12} weight="fill" /> {yesPct}%</span>
          </div>
        </motion.div>
      </AnimatePresence>

      {showBuy && m && (
        <QuickBuyModal
          isOpen={showBuy}
          onClose={() => setShowBuy(false)}
          market={{
            id: m.id,
            title: m.title,
            category: m.category,
            fxRate: m.fxRate,
            price: m.price,
            optionPrices: m.optionPrices || undefined,
            yesPool: m.yesPool,
            noPool: m.noPool,
            resolvesAt: m.resolvesAt,
            status: m.status,
            totalVolume: m.totalVolume,
          }}
          side={side}
        />
      )}
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
  { icon: Globe, emoji: "🌍", titleKey: "builtForAfrica" as const, descKey: "builtForAfricaDesc" as const, color: "#12805c" },
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
  { icon: UserPlus, color: "#12805c" },
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
    <div className="min-h-screen bg-[var(--background)] overflow-x-clip" suppressHydrationWarning>
      <Navbar />

      {/* Activity Ticker */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <ActivityTicker />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-3">
        <SandboxNotice />
      </div>

      {/* ══════════════════════════════════════════════
          HERO — Bongo Life treatment. Live odds canvas behind a poster
          headline, click-to-open market callouts, counted-up stats and
          the gold marquee rail.
          ══════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden text-white" style={{ minHeight: "100svh" }}>
        <div className="absolute inset-0 -z-30" style={{ background: "radial-gradient(120% 90% at 15% 10%, #1d2b1f 0%, #15171a 45%, #0d0e10 100%)" }} />
        <OddsCanvas className="absolute inset-0 -z-20 w-full h-full" />
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg, rgba(10,10,10,.5) 0%, rgba(10,10,10,.1) 38%, rgba(10,10,10,.5) 70%, rgba(10,10,10,.92) 100%)" }} />

        {/* Live markets drifting down the right — real open markets, rotating */}
        <LiveMarketDeck />

        <div className="relative flex flex-col justify-end px-4 sm:px-8 lg:px-16 pt-32 pb-10" style={{ minHeight: "100svh" }}>
          <div className="max-w-[1160px] mx-auto w-full">
            <div className="max-w-[820px]">
              <span className="bl-tag">
                <i className="bl-dot" /> {t.landing.hero.tag}
              </span>

              <GlitchHeadline
                className="bl-display mt-5 mb-4"
                style={{ fontSize: "clamp(52px, 9vw, 132px)" }}
                pre={t.landing.hero.pre}
                pop={t.landing.hero.pop}
                post={t.landing.hero.post}
              />

              <p className="text-[16px] sm:text-[19px] leading-relaxed max-w-[620px]" style={{ color: "rgba(255,255,255,.88)" }}>
{t.landing.hero.blurb}
              </p>

              <div className="flex flex-wrap gap-3 mt-7">
                <Link href="/markets" className="bl-btn bl-btn-gold">{t.landing.hero.ctaPrimary}</Link>
                <Link href="/auth/register" className="bl-btn" style={{ background: "rgba(255,255,255,.14)", color: "#fff", borderColor: "#fff", backdropFilter: "blur(6px)" }}>
                  {t.landing.hero.ctaSecondary}
                </Link>
              </div>
            </div>

            {/* Stat tiles — tilt to the pointer, numbers count up when they land */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-10">
              {[
                { to: stats.totalVolume, fmt: formatVolume, l: t.landing.hero.statVolume },
                { to: stats.openMarkets, fmt: (n: number) => String(n), l: t.landing.hero.statMarkets },
                { to: stats.totalTraders, fmt: formatVolume, l: t.landing.hero.statTraders },
                { to: stats.totalTrades, fmt: formatVolume, l: t.landing.hero.statTrades },
              ].map((s) => (
                <Tilt key={s.l}>
                  <div className="bl-card px-4 py-4" style={{ background: "#fffdf8", borderColor: "#141414" }}>
                    <CountUp
                      to={s.to}
                      format={s.fmt}
                      className="block font-mono text-[26px] sm:text-[32px] font-black leading-none tabular-nums"
                      style={{ color: "#141414" }}
                    />
                    <div className="text-[12px] mt-1.5 font-semibold" style={{ color: "#7a746a" }}>{s.l}</div>
                  </div>
                </Tilt>
              ))}
            </div>
          </div>

          <a href="#trending" aria-label="Scroll to markets" className="bl-cue absolute right-6 bottom-24 hidden md:grid">↓</a>
        </div>

        {/* Gold rail — big condensed type, parks when you hover it */}
        <div className="bl-marquee relative">
          <div className="bl-marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0" aria-hidden={dup === 1}>
                {(t.landing.hero.ticker as string[]).map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          HOW IT WORKS — with real mobile payment photo
          ══════════════════════════════════════════════ */}
      <section id="trending" className="bl-reveal max-w-7xl mx-auto px-4 py-20">
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
                      <motion.div animate={{ width: ['60%', '90%', '60%'] }} transition={{ duration: 3, repeat: Infinity }} className="h-full bg-[#12805c]" />
                    </div>
                  </div>
                </div>

                {/* App header */}
                <div className="flex items-center gap-2 px-2 mb-3">
                  <div className="w-6 h-6 border border-[var(--foreground)] flex items-center justify-center text-[8px] font-mono font-black">G</div>
                  <span className="text-xs font-mono font-bold text-[var(--foreground)]">GUAP</span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#12805c] animate-pulse" />
                    <span className="text-[8px] font-mono text-[#12805c]">LIVE</span>
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
                    <TrendUp size={10} weight="bold" className="text-[#12805c]" />
                    <span className="text-[9px] font-mono text-[#12805c]">+12,500 today</span>
                  </div>
                </motion.div>

                {/* Transaction list */}
                <div className="space-y-1.5">
                  {[
                    { label: DEPOSITS_ENABLED ? "Deposit via M-Pesa" : "Opening balance", amount: "+50,000", color: "#12805c", delay: 0.5 },
                    { label: "Buy YES · CCM Election", amount: "-5,000", color: "var(--muted)", delay: 0.65 },
                    { label: "Market Won!", amount: "+9,200", color: "#12805c", delay: 0.8 },
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
                  className="mt-2 bg-[#12805c]/10 border border-[#12805c]/30 p-2.5 flex items-center gap-2"
                >
                  <CheckCircle size={14} weight="fill" className="text-[#12805c] shrink-0" />
                  <div>
                    <p className="text-[9px] font-mono text-[var(--foreground)] font-bold">{t.landing.howItWorks.sentToMpesa}</p>
                    <p className="text-[10px] font-mono font-black text-[#12805c]">TSh 25,000</p>
                  </div>
                </motion.div>
              </div>

              {/* Decorative glow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-[#12805c]/5 via-transparent to-[#00b4d8]/5 -z-10 blur-xl" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TRENDING MARKETS
          ══════════════════════════════════════════════ */}
      {markets.length > 0 && (
        <section className="bl-reveal max-w-7xl mx-auto px-4 py-12">
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
      <section className="bl-reveal max-w-7xl mx-auto px-4 py-20">
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
      <section className="bl-reveal bg-[var(--card)]/40 border-y border-[var(--card-border)] py-20">
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
                    <Star key={`${tm.name}-star-${si}`} size={14} weight="fill" className="text-yellow-600 dark:text-yellow-400" />
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
      <section className="bl-reveal max-w-7xl mx-auto px-4 py-20">
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
          API INTEGRATION SECTION
          ══════════════════════════════════════════════ */}
      <section className="bl-reveal max-w-7xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-[var(--card)] border border-[var(--card-border)] p-8 md:p-12"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-mono font-bold mb-4 uppercase">
                <Terminal size={14} />
                For Developers
              </div>
              <h2 className="text-3xl font-black mb-4 font-mono">
                Integrate Prediction Markets<br />
                <span className="text-[var(--accent)]">Into Your App</span>
              </h2>
              <p className="text-[var(--muted)] mb-6 leading-relaxed">
                Banks, mobile money apps, and fintech platforms can integrate GUAP's prediction markets via our REST API. Enable your users to trade on real-world events.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  { icon: <ShieldCheck size={16} />, text: "API Key Authentication" },
                  { icon: <Lightning size={16} />, text: "Rate Limited Tiers" },
                  { icon: <CurrencyDollar size={16} />, text: "Keep 100% Trading Fees" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--accent)]">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/developers"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[var(--accent)] text-[var(--accent)] font-mono font-bold hover:bg-[var(--accent)] hover:text-[var(--background)] transition-colors"
              >
                View API Docs
                <ArrowRight size={16} weight="bold" />
              </Link>
            </div>

            <div className="relative">
              <div className="bg-[#0a0a0a] border border-[var(--accent)]/20 p-4 font-mono text-xs">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--card-border)]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <span className="text-[var(--muted)]">api-integration.sh</span>
                </div>
                <pre className="text-[var(--muted)] leading-relaxed overflow-x-auto">
                  <code>
{`# Create user
curl -X POST /api/v1/users \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -d '{"externalId": "255712345678"}'

# Place trade
curl -X POST /api/v1/trades \\
  -H "Authorization: Bearer gp_live_xxx" \\
  -d '{
    "externalId": "255712345678",
    "marketId": "clxyz123",
    "side": "YES",
    "amountTzs": 5000
  }'`}
                  </code>
                </pre>
              </div>
              <div className="absolute -bottom-2 -right-2 w-full h-full border border-[var(--accent)]/10 -z-10" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════════ */}
      <section className="bl-reveal max-w-7xl mx-auto px-4 pb-24">
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
            <div className="absolute inset-0 bg-gradient-to-br from-[#12805c]/15 via-[var(--card)] to-[#00b4d8]/10" />
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
                <img src="/guap.svg" alt="GUAP" className="w-8 h-8" />
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
              { title: t.landing.footer.about, links: [{ href: "/about", label: t.landing.footer.aboutGuap }, { href: "https://www.ntzs.co.tz/", label: t.landing.footer.ntzsNetwork }, { href: "https://chat.whatsapp.com/CfFU1jLmjDO8QLrH31Sv0C", label: t.landing.footer.contact }] },
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
                  href="https://www.instagram.com/shindaguap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                  aria-label="Follow us on Instagram"
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
