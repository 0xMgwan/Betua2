"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS } from "@/lib/utils";
import {
  Sun, Moon, TrendUp, ChartBar, Trophy, Wallet,
  User,  Plus, SignOut, List, X, Globe, Bell,
  ShoppingCart, Storefront, Target, PaperPlaneTilt,
  ArrowDownLeft, CurrencyDollar, Gift, CheckCircle, ArrowUpRight,
} from "@phosphor-icons/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const NOTIF_ICONS: Record<string, typeof Bell> = {
  TRADE: ShoppingCart,
  MARKET_CREATED: Storefront,
  MARKET_RESOLVED: Target,
  FUNDS_RECEIVED: ArrowDownLeft,
  FUNDS_SENT: PaperPlaneTilt,
  DEPOSIT: CurrencyDollar,
  WITHDRAW: CurrencyDollar,
  WINNINGS: Gift,
  REDEEM: CheckCircle,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useUser();
  const { locale, setLocale, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Poll notifications every 30s when logged in
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const clearAll = async () => {
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* silent */ }
  };

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

          {/* Notification Bell with Dropdown */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                  if (!notifOpen) fetchNotifications();
                }}
                className="relative p-2 border border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all"
                title="Notifications"
              >
                <Bell size={17} weight={unreadCount > 0 ? "fill" : "duotone"} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[var(--accent)] text-[var(--background)] text-[9px] font-mono font-black flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-80 bg-[var(--background)] border border-[var(--card-border)] shadow-xl z-50 max-h-[70vh] flex flex-col"
                  >
                    {/* Header */}
                    <div className="px-3 py-2.5 border-b border-[var(--card-border)] bg-[var(--card)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-[var(--foreground)] uppercase tracking-wider flex items-center gap-1.5">
                          <Bell size={12} weight="fill" />
                          Notifications
                          {unreadCount > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-[var(--accent)] text-[var(--background)] font-black">{unreadCount}</span>
                          )}
                        </span>
                      </div>
                      {notifications.length > 0 && (
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllRead}
                              className="text-[10px] font-mono font-bold text-[var(--accent)] hover:underline uppercase tracking-wider"
                            >
                              Mark all read
                            </button>
                          )}
                          <button
                            onClick={clearAll}
                            className="text-[10px] font-mono font-bold text-red-400 hover:underline uppercase tracking-wider"
                          >
                            Clear all
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Notification list */}
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: "400px" }}>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell size={24} className="mx-auto mb-2 text-[var(--muted)]" />
                          <p className="text-xs font-mono text-[var(--muted)]">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const IconComp = NOTIF_ICONS[notif.type] || Bell;
                          return (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (notif.link) {
                                  window.location.href = notif.link;
                                  setNotifOpen(false);
                                }
                              }}
                              className={cn(
                                "flex gap-3 px-3 py-2.5 border-b border-[var(--card-border)] transition-colors cursor-pointer",
                                !notif.read
                                  ? "bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10"
                                  : "hover:bg-[var(--card)]"
                              )}
                            >
                              <div className={cn(
                                "shrink-0 w-8 h-8 flex items-center justify-center border",
                                !notif.read ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--card-border)] text-[var(--muted)]"
                              )}>
                                <IconComp size={14} weight="fill" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={cn(
                                    "text-[11px] font-mono font-bold truncate",
                                    !notif.read ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                                  )}>
                                    {notif.title}
                                  </p>
                                  <span className="text-[9px] font-mono text-[var(--muted)] shrink-0">{timeAgo(notif.createdAt)}</span>
                                </div>
                                <p className="text-[10px] font-mono text-[var(--muted)] leading-relaxed line-clamp-2 mt-0.5">
                                  {notif.message}
                                </p>
                              </div>
                              {!notif.read && (
                                <div className="shrink-0 w-1.5 h-1.5 bg-[var(--accent)] mt-2.5" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
              {/* Deposit — desktop only (hidden on mobile to reduce clutter) */}
              <Link
                href="/wallet#deposit"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border-2 border-[var(--foreground)] text-[var(--foreground)] text-xs font-mono font-bold tracking-wider hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all uppercase"
              >
                <ArrowUpRight size={15} />
                {locale === "sw" ? "Weka" : "Deposit"}
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
                            "flex items-center justify-between px-4 py-2.5 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] transition-colors",
                            pathname.startsWith(href)
                              ? "text-[var(--foreground)] bg-[var(--card)]"
                              : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={13} />
                            {label}
                          </div>
                          {href === "/wallet" && (
                            <span className="text-[10px] text-[var(--accent)] font-bold tabular-nums">
                              {formatTZS(user.balanceTzs || 0)}
                            </span>
                          )}
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
                        "flex items-center justify-between px-4 py-3 text-xs font-mono font-bold tracking-wider uppercase border-b border-[var(--card-border)] transition-colors",
                        pathname.startsWith(href)
                          ? "text-[var(--foreground)] bg-[var(--card)]"
                          : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={14} />
                        {label}
                      </div>
                      {href === "/wallet" && user && (
                        <span className="text-[10px] text-[var(--accent)] font-bold tabular-nums">
                          {formatTZS(user.balanceTzs || 0)}
                        </span>
                      )}
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
