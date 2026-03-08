"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useUser } from "@/store/useUser";
import { formatTZS } from "@/lib/utils";
import {
  Sun, Moon, TrendUp, ChartBar, Trophy, Wallet,
  User, Plus, SignOut, List, X,
} from "@phosphor-icons/react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/markets", label: "Markets", icon: ChartBar },
  { href: "/portfolio", label: "Portfolio", icon: TrendUp },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-black text-sm">
            B
          </div>
          <span className="gradient-text">Betua</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                pathname.startsWith(href)
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition-all"
          >
            {mounted && (theme === "dark" ? <Sun size={17} /> : <Moon size={17} />)}
          </button>

          {user ? (
            <>
              {/* Create market */}
              <Link
                href="/markets/create"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
              >
                <Plus size={15} />
                Create
              </Link>

              {/* Balance */}
              <div className="hidden md:block px-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm font-medium">
                {formatTZS(user.balanceTzs || 0)}
              </div>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--card)] transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-bold text-sm">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-xl overflow-hidden z-50"
                      onMouseLeave={() => setProfileOpen(false)}
                    >
                      <div className="px-4 py-3 border-b border-[var(--card-border)]">
                        <p className="font-semibold text-sm">{user.displayName || user.username}</p>
                        <p className="text-xs text-[var(--muted)]">@{user.username}</p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--background)] transition-colors"
                      >
                        <User size={14} />
                        Profile
                      </Link>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-[var(--background)] transition-colors"
                      >
                        <SignOut size={14} />
                        Sign out
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
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
              >
                Get started
              </Link>
            </div>
          )}

          {/* Mobile menu */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-[var(--card)]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--card-border)] bg-[var(--background)]"
          >
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium",
                    pathname.startsWith(href)
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "text-[var(--muted)]"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    href="/markets/create"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--accent)]"
                  >
                    <Plus size={16} />
                    Create Market
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-500"
                  >
                    <SignOut size={16} />
                    Sign out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 py-2 text-center text-sm font-medium border border-[var(--card-border)] rounded-lg"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 py-2 text-center text-sm font-semibold bg-[var(--accent)] text-black rounded-lg"
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
