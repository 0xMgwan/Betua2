"use client";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { Gift, ArrowRight } from "@phosphor-icons/react";

// Slick referral promo (Limitless "ROAD TO..." style). Image-forward dark card
// with a bold headline and a bright CTA. Links to the profile referral section.
export function ReferralBanner() {
  const { locale } = useLanguage();
  const { user } = useUser();
  const href = user ? "/profile" : "/auth/register";

  return (
    <Link href={href} className="block group">
      <div className="relative overflow-hidden rounded-xl border-2 border-[var(--accent)]/30 bg-[var(--card)]">
        {/* Background gradient + scanlines */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#00251a] via-[#003d2b] to-[#001a12]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,229,160,0.04)_3px,rgba(0,229,160,0.04)_5px)]" />
        {/* Glow blob */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[var(--accent)]/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3 p-4">
          <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-[var(--accent)]/15 border-2 border-[var(--accent)]/40 rounded-lg">
            <Gift size={26} weight="fill" className="text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]/80 mb-0.5">
              {locale === "sw" ? "Mpango wa Marafiki" : "Referral Program"}
            </p>
            <p className="font-mono font-black text-white text-sm sm:text-base leading-tight">
              {locale === "sw" ? (
                <>Alika marafiki, pata hadi <span className="text-[var(--accent)]">30%</span> ya ada</>
              ) : (
                <>Refer & earn up to <span className="text-[var(--accent)]">30%</span> in fees</>
              )}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-[var(--accent)] text-black font-mono font-black text-xs uppercase tracking-wider group-hover:opacity-90 transition-opacity">
            {locale === "sw" ? "Anza" : "Invite"}
            <ArrowRight size={14} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}
