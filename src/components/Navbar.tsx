"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS } from "@/lib/utils";
import {
  Sun, Moon, TrendUp, ChartBar, Trophy, Wallet,
  User, Plus, SignOut, List, X, Globe, Bell,
} from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useUser();
  const { locale, setLocale, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  
  useEffect(() => {
    setMounted(true);
    // Check notification permission status
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const NAV_LINKS = [
    { href: "/markets", label: t.nav.markets, icon: ChartBar },
    { href: "/portfolio", label: "Portfolio", icon: TrendUp },
    { href: "/leaderboard", label: t.nav.leaderboard, icon: Trophy },
    { href: "/wallet", label: t.nav.wallet, icon: Wallet },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl font-mono">
          <div className="w-8 h-8 border-2 border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] font-black text-sm">
            G
          </div>
          <span className="text-[var(--foreground)] tracking-wider">GUAP</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold tracking-wider transition-all uppercase",
                pathname.startsWith(href)
                  ? "text-[var(--foreground)] border-b-2 border-[var(--foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === "en" ? "sw" : "en")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all font-mono text-[10px] font-bold tracking-wider"
            title={locale === "en" ? "Switch to Kiswahili" : "Switch to English"}
          >
            <Globe size={14} weight="duotone" />
            {locale === "en" ? "SW" : "EN"}
          </button>

          {/* Notification Bell - only show when logged in */}
          {user && (
            <button
              onClick={async () => {
                try {
                  const { notifications } = await import("@/lib/notifications");
                  await notifications.initialize();
                  const permission = await notifications.requestPermission();
                  setNotificationPermission(permission);
                  
                  if (permission === "granted") {
                    await notifications.showNotification({
                      title: "🔔 Notifications Enabled!",
                      body: "You'll now receive updates for trades, resolutions, and more.",
                    });
                  } else if (permission === "denied") {
                    alert(locale === "sw" 
                      ? "Arifa zimezuiwa. Tafadhali ruhusu arifa katika mipangilio ya kivinjari chako."
                      : "Notifications blocked. Please enable notifications in your browser settings.");
                  }
                } catch (error) {
                  console.error("Notification error:", error);
                }
              }}
              className="relative p-2 border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all"
              title={notificationPermission === "granted" ? "Notifications enabled" : "Enable notifications"}
            >
              <Bell size={17} weight={notificationPermission === "granted" ? "fill" : "duotone"} />
              {/* Badge - only show if notifications not granted */}
              {notificationPermission !== "granted" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></span>
              )}
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all"
          >
            {mounted && (theme === "dark" ? <Sun size={17} /> : <Moon size={17} />)}
          </button>

          {user ? (
            <>
              {/* Create market — desktop only (hidden on mobile to reduce clutter) */}
              <Link
                href="/markets/create"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border-2 border-[var(--foreground)] text-[var(--foreground)] text-xs font-mono font-bold tracking-wider hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all uppercase"
              >
                <Plus size={15} />
                {locale === "sw" ? "Unda" : "Create"}
              </Link>

              {/* Balance — desktop only */}
              <div className="hidden md:block px-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] text-sm font-medium font-mono">
                {formatTZS(user.balanceTzs || 0)}
              </div>

              {/* Profile dropdown — visible on all screen sizes */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1 hover:bg-[var(--card)] transition-all"
                >
                  <div className="w-8 h-8 border-2 border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] font-bold text-sm">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-[var(--background)] border border-[var(--card-border)] shadow-xl z-50"
                      onMouseLeave={() => setProfileOpen(false)}
                    >
                      <div className="px-4 py-3 border-b border-[var(--card-border)]">
                        <p className="font-bold text-sm font-mono">{user.displayName || user.username}</p>
                        <p className="text-xs text-[var(--muted)] font-mono">@{user.username}</p>
                      </div>
                      {/* Nav links — shown on all sizes */}
                      {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setProfileOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] transition-colors",
                            pathname.startsWith(href)
                              ? "text-[var(--foreground)] bg-[var(--card)]"
                              : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]"
                          )}
                        >
                          <Icon size={13} />
                          {label}
                        </Link>
                      ))}
                      <Link
                        href="/markets/create"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                      >
                        <Plus size={13} />
                        {locale === "sw" ? "Unda Soko" : "Create Market"}
                      </Link>
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                      >
                        <User size={13} />
                        {t.nav.profile}
                      </Link>
                      <button
                        onClick={() => { logout(); setProfileOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold tracking-wider uppercase text-red-500 hover:bg-[var(--card)] transition-colors"
                      >
                        <SignOut size={13} />
                        {t.nav.signOut}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/auth/login"
                className="px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                {t.nav.signIn}
              </Link>
              <Link
                href="/auth/register"
                className="px-3 py-1.5 border-2 border-[var(--foreground)] text-[var(--foreground)] text-xs font-mono font-bold tracking-wider hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all uppercase"
              >
                Get started
              </Link>
            </div>
          )}

          {/* Mobile menu — only shown when logged out */}
          <div className={cn("md:hidden relative", user && "hidden")}>
            <button
              className="p-2 border border-[var(--card-border)] hover:border-[var(--foreground)] text-[var(--foreground)] transition-all"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <List size={18} />}
            </button>

            <AnimatePresence>
              {mobileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-[var(--background)] border border-[var(--card-border)] shadow-xl z-50"
                  onMouseLeave={() => setMobileOpen(false)}
                >
                  {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] transition-colors",
                        pathname.startsWith(href)
                          ? "text-[var(--foreground)] bg-[var(--card)]"
                          : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]"
                      )}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  ))}
                  {user ? (
                    <>
                      <Link
                        href="/markets/create"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                      >
                        <Plus size={14} />
                        Create Market
                      </Link>
                      <button
                        onClick={() => { logout(); setMobileOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold tracking-wider uppercase text-red-500 hover:bg-[var(--card)] transition-colors"
                      >
                        <SignOut size={14} />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/login"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/auth/register"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-xs font-mono font-bold tracking-wider uppercase text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
                      >
                        Get started
                      </Link>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  );
}
