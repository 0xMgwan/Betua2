"use client";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { ChartLineUp, ArrowRight } from "@phosphor-icons/react";

// Creator rewards promo (mirrors ReferralBanner). Dark image-forward card with a
// bold headline and bright CTA. Links to the market creation page.
export function CreatorRewardsBanner() {
  const { locale } = useLanguage();
  const { user } = useUser();
  const href = user ? "/markets/create" : "/auth/register";

  return (
    <Link href={href} className="block group">
      <div className="relative overflow-hidden rounded-xl border-2 border-[#00b4d8]/30 bg-[#001a24]">
        {/* Background gradient + scanlines (always dark, theme-independent) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#00212e] via-[#003a4d] to-[#001a24]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,180,216,0.04)_3px,rgba(0,180,216,0.04)_5px)]" />
        {/* Glow blob */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#00b4d8]/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3 p-4">
          <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-[#00b4d8]/15 border-2 border-[#00b4d8]/40 rounded-lg">
            <ChartLineUp size={26} weight="fill" className="text-[#00b4d8]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#00b4d8]/80 mb-0.5">
              {locale === "sw" ? "Zawadi za Muundaji" : "Creator Rewards"}
            </p>
            <p className="font-mono font-black text-white text-sm sm:text-base leading-tight">
              {locale === "sw" ? (
                <>Unda soko, pata <span className="text-[#00b4d8]">30%</span> ya ada za biashara</>
              ) : (
                <>Create a market, earn <span className="text-[#00b4d8]">30%</span> of trading fees</>
              )}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-[#00b4d8] text-black font-mono font-black text-xs uppercase tracking-wider group-hover:opacity-90 transition-opacity rounded-md">
            {locale === "sw" ? "Unda" : "Create"}
            <ArrowRight size={14} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}
