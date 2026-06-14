"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ChartBar, TrendUp, Trophy, Wallet, User } from "@phosphor-icons/react";

// betPawa-style bottom navigation — mobile only. Terminal aesthetic:
// sharp corners, monospace labels, accent-green active state.
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { t } = useLanguage();

  const ITEMS = [
    { href: "/markets", label: t.nav?.markets || "Markets", icon: ChartBar },
    { href: "/portfolio", label: "Trades", icon: TrendUp },
    { href: "/leaderboard", label: t.nav?.leaderboard || "Ranks", icon: Trophy },
    { href: "/wallet", label: t.nav?.wallet || "Wallet", icon: Wallet },
    { href: user ? "/profile" : "/auth/login", label: user ? "Account" : "Login", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/95 backdrop-blur-xl border-t-2 border-[var(--card-border)]">
      <div className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative",
                active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              )}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[var(--accent)]" />}
              <Icon size={22} weight={active ? "fill" : "regular"} />
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
