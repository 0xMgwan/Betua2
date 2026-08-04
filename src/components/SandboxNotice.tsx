"use client";
import { Info } from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// A slim, always-visible notice that the platform is under regulatory sandbox
// review. Deliberately not dismissible — it's a compliance disclosure, not a
// promo — but kept low-contrast so it reads as a footnote, not an alert.
export function SandboxNotice({ className }: { className?: string }) {
  const { locale } = useLanguage();
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2 px-3 py-2 border border-amber-500/25 bg-amber-500/[0.06] text-[11px] leading-relaxed text-[var(--muted)]",
        className
      )}
    >
      <Info size={13} weight="fill" className="shrink-0 mt-[2px] text-amber-500/80" />
      <p>
        {locale === "sw" ? (
          <>
            <span className="font-semibold text-amber-500/90">Taarifa:</span>{" "}
            GUAP iko chini ya mapitio ya udhibiti katika mazingira ya majaribio
            (regulatory sandbox). Baadhi ya huduma zimewekewa mipaka kwa muda.
          </>
        ) : (
          <>
            <span className="font-semibold text-amber-500/90">Notice:</span>{" "}
            GUAP is operating under regulatory sandbox review. Some services are
            limited during this period.
          </>
        )}
      </p>
    </div>
  );
}
