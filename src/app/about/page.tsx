"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Globe, Lightning, ShieldCheck, UsersThree, Target, TrendUp,
  Wallet, ChartLineUp, Terminal, ArrowRight, Phone,
} from "@phosphor-icons/react";
import { GlitchText } from "@/components/ui/glitch-text";

const translations = {
  en: {
    hero: { title: "About", subtitle: "East Africa's first prediction market, powered by nTZS - Tanzania's digital currency." },
    what: {
      title: "What is GUAP?",
      p1: "GUAP is a prediction market platform where you can bet on future events - from sports, politics, to economics.",
      p2: "Each market has two shares: YES and NO. The share price reflects the probability of an event happening.",
      p3: "When the market ends, winning shares become TZS 1.00 each, losing shares become TZS 0.00.",
    },
    sharesVsOdds: {
      title: "Shares vs Traditional Betting",
      items: [
        { title: "Trade Anytime", desc: "Buy and sell shares before the event ends. Lock in profits or cut losses early." },
        { title: "Fair Pricing", desc: "Prices reflect real probabilities, not bookmaker margins. The market sets the price." },
        { title: "No House Edge", desc: "Trade peer-to-peer. No bookmaker taking a cut from every bet." },
        { title: "Transparent Odds", desc: "See exactly what everyone thinks. Price = probability. TZS 0.70 = 70% chance." },
      ],
    },
    features: {
      title: "Why GUAP?",
      items: [
        { title: "Safe & Transparent", desc: "All transactions on nTZS blockchain." },
        { title: "Lightning Fast", desc: "Deposit and withdraw via M-Pesa in seconds." },
        { title: "Built for Africans", desc: "Swahili, TZS, and M-Pesa." },
        { title: "Big Community", desc: "Join thousands of predictors." },
        { title: "Many Markets", desc: "Sports, politics, entertainment, economy." },
        { title: "Big Profits", desc: "Buy low, sell high." },
      ],
    },
    howItWorks: {
      title: "How It Works",
      steps: [
        { title: "Sign Up", desc: "Create a free account in one minute." },
        { title: "Deposit", desc: "Use M-Pesa to add TZS to your wallet." },
        { title: "Choose Market", desc: "Browse available markets." },
        { title: "Buy Shares", desc: "Decide: Yes or No?" },
        { title: "Wait for Answer", desc: "If you win, shares become TZS 1.00 each." },
        { title: "Withdraw", desc: "Withdraw profits to M-Pesa." },
      ],
    },
    ntzs: { title: "Powered by nTZS", cta: "Learn More about nTZS" },
    cta: { title: "Ready to Start?", desc: "Join GUAP today.", register: "Sign Up Now", browse: "Browse Markets" },
  },
  sw: {
    hero: { title: "Kuhusu", subtitle: "Soko la kwanza la utabiri Afrika Mashariki, linalowezeshwa na nTZS." },
    what: {
      title: "GUAP ni Nini?",
      p1: "GUAP ni jukwaa la utabiri ambapo unaweza kuweka dau kuhusu matukio ya baadaye.",
      p2: "Kila soko lina hisa mbili: YES na NO. Bei ya hisa inaonyesha uwezekano wa tukio kutokea.",
      p3: "Soko linapoisha, hisa zinazoshinda zinakuwa TZS 1.00, zinazoshindwa zinakuwa TZS 0.00.",
    },
    sharesVsOdds: {
      title: "Hisa vs Kamari ya Kawaida",
      items: [
        { title: "Biashara Wakati Wowote", desc: "Nunua na uza hisa kabla tukio halijamalizika. Funga faida au punguza hasara mapema." },
        { title: "Bei ya Haki", desc: "Bei zinaonyesha uwezekano halisi, si faida ya kampuni. Soko linaweka bei." },
        { title: "Hakuna Faida ya Nyumba", desc: "Biashara moja kwa moja na wengine. Hakuna kampuni inayochukua sehemu ya kila dau." },
        { title: "Uwezekano Wazi", desc: "Ona kile kila mtu anafikiri. Bei = uwezekano. TZS 0.70 = nafasi 70%." },
      ],
    },
    features: {
      title: "Kwa Nini GUAP?",
      items: [
        { title: "Salama na Wazi", desc: "Miamala yote kwenye blockchain ya nTZS." },
        { title: "Haraka Sana", desc: "Weka na toa pesa kupitia M-Pesa." },
        { title: "Kwa Waafrika", desc: "Kiswahili, TZS, na M-Pesa." },
        { title: "Jamii Kubwa", desc: "Jiunge na maelfu ya watabiri." },
        { title: "Masoko Mengi", desc: "Michezo, siasa, burudani, uchumi." },
        { title: "Faida Kubwa", desc: "Nunua chini, uza juu." },
      ],
    },
    howItWorks: {
      title: "Jinsi Inavyofanya Kazi",
      steps: [
        { title: "Jiandikishe", desc: "Fungua akaunti bure kwa dakika moja." },
        { title: "Weka Pesa", desc: "Tumia M-Pesa kuweka TZS." },
        { title: "Chagua Soko", desc: "Tazama masoko yanayopatikana." },
        { title: "Nunua Hisa", desc: "Amua: Ndio au Hapana?" },
        { title: "Subiri Jibu", desc: "Ukishinda, hisa zinakuwa TZS 1.00." },
        { title: "Toa Pesa", desc: "Toa faida kwenye M-Pesa." },
      ],
    },
    ntzs: { title: "Inawezeshwa na nTZS", cta: "Jifunze Zaidi kuhusu nTZS" },
    cta: { title: "Tayari Kuanza?", desc: "Jiunge na GUAP leo.", register: "Jiandikishe Sasa", browse: "Tazama Masoko" },
  },
};

const FEATURE_ICONS = [ShieldCheck, Lightning, Globe, UsersThree, Target, TrendUp];

export default function AboutPage() {
  const { locale } = useLanguage();
  const t = translations[locale as keyof typeof translations] || translations.en;

  const fadeUp = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

  return (
    <div className="min-h-screen bg-[var(--background)] overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(0deg, var(--foreground) 0px, var(--foreground) 1px, transparent 1px, transparent 40px)" }} />
        </div>
        <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 mb-4">
            <Terminal size={20} className="text-[var(--gold)]" />
            <span className="font-mono text-xs text-[var(--muted)] tracking-wider">~/about</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-black mb-6 font-mono">
            {t.hero.title} <GlitchText text="GUAP" className="text-[var(--gold)]" />
          </motion.h1>
          <motion.p variants={fadeUp} className="text-xl text-[var(--muted)] max-w-2xl mx-auto font-mono">
            {t.hero.subtitle}
          </motion.p>
        </motion.div>
      </section>

      {/* What is GUAP */}
      <section className="py-20 px-4 border-t border-[var(--card-border)]">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto">
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-8">
            <div className="w-2 h-2 bg-[var(--gold)]" />
            <h2 className="text-3xl font-black font-mono">{t.what.title}</h2>
          </motion.div>
          <div className="space-y-6 border-l-2 border-[var(--card-border)] pl-6">
            <motion.p variants={fadeUp} className="text-lg text-[var(--muted)] font-mono leading-relaxed">{t.what.p1}</motion.p>
            <motion.p variants={fadeUp} className="text-lg text-[var(--muted)] font-mono leading-relaxed">
              {t.what.p2} <span className="text-green-400 font-bold">YES</span> / <span className="text-red-400 font-bold">NO</span>
            </motion.p>
            <motion.p variants={fadeUp} className="text-lg text-[var(--muted)] font-mono leading-relaxed">{t.what.p3}</motion.p>
          </div>
        </motion.div>
      </section>

      {/* Shares vs Odds */}
      <section className="py-20 px-4 bg-[var(--card)]/30 border-t border-[var(--card-border)]">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto">
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-12 justify-center">
            <div className="w-8 h-px bg-[var(--foreground)]" />
            <h2 className="text-3xl font-black font-mono">{t.sharesVsOdds.title}</h2>
            <div className="w-8 h-px bg-[var(--foreground)]" />
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            {t.sharesVsOdds.items.map((item, i) => (
              <motion.div key={item.title} variants={fadeUp} className="bg-[var(--card)] border-2 border-[var(--card-border)] p-6 hover:border-[var(--gold)] transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 border-2 border-[var(--gold)] flex items-center justify-center font-mono font-black text-sm text-[var(--gold)] flex-shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-mono mb-2">{item.title}</h3>
                    <p className="text-sm text-[var(--muted)] font-mono">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-[var(--card)]/30 border-t border-[var(--card-border)]">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto">
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-12 justify-center">
            <div className="w-8 h-px bg-[var(--foreground)]" />
            <h2 className="text-3xl font-black font-mono">{t.features.title}</h2>
            <div className="w-8 h-px bg-[var(--foreground)]" />
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {t.features.items.map((feature, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <motion.div key={feature.title} variants={fadeUp} whileHover={{ y: -4, borderColor: "var(--gold)" }}
                  className="bg-[var(--card)] border-2 border-[var(--card-border)] p-6 transition-all duration-300">
                  <Icon size={32} weight="duotone" className="text-[var(--gold)] mb-4" />
                  <h3 className="text-lg font-black font-mono mb-2">{feature.title}</h3>
                  <p className="text-sm text-[var(--muted)] font-mono">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 border-t border-[var(--card-border)]">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto">
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-12 justify-center">
            <div className="w-8 h-px bg-[var(--foreground)]" />
            <h2 className="text-3xl font-black font-mono">{t.howItWorks.title}</h2>
            <div className="w-8 h-px bg-[var(--foreground)]" />
          </motion.div>
          <div className="space-y-6">
            {t.howItWorks.steps.map((step, i) => (
              <motion.div key={step.title} variants={fadeUp} className="flex gap-6 items-start group">
                <div className="w-12 h-12 border-2 border-[var(--foreground)] flex items-center justify-center font-mono font-black text-lg group-hover:bg-[var(--gold)] group-hover:border-[var(--gold)] group-hover:text-black transition-all">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-lg font-black font-mono mb-1">{step.title}</h3>
                  <p className="text-[var(--muted)] font-mono text-sm">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA + nTZS */}
      <section className="py-24 px-4 border-t border-[var(--card-border)]">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto text-center">
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black font-mono mb-6">{t.cta.title}</motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-[var(--muted)] font-mono mb-10">{t.cta.desc}</motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/auth/register" className="bg-[var(--gold)] text-black font-mono font-bold px-8 py-4 hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              {t.cta.register} <ArrowRight size={16} />
            </Link>
            <Link href="/markets" className="border-2 border-[var(--foreground)] font-mono font-bold px-8 py-4 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all">
              {t.cta.browse}
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} className="pt-8 border-t border-[var(--card-border)]">
            <p className="text-sm text-[var(--muted)] font-mono mb-4">{t.ntzs.title}</p>
            <a href="https://www.ntzs.co.tz/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[var(--gold)] font-mono font-bold hover:opacity-80 transition-opacity">
              {t.ntzs.cta} <ArrowRight size={14} />
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)] py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-sm text-[var(--muted)] font-mono">
          <p>© 2026 GUAP. Powered by <strong className="text-[var(--foreground)]">nTZS</strong></p>
        </div>
      </footer>
    </div>
  );
}
