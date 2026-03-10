"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { Eye, EyeSlash, ArrowLeft } from "@phosphor-icons/react";

export default function LoginPage() {
  const router = useRouter();
  const fetchUser = useUser((s) => s.fetchUser);
  const { t } = useLanguage();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Login failed");
      await fetchUser();
      router.push("/markets");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--card)] border border-[var(--card-border)] rounded-3xl p-8 shadow-xl"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <ArrowLeft size={16} className="text-[var(--muted)]" />
              <span className="text-sm text-[var(--muted)]">{t.common.back}</span>
            </Link>
            <div className="w-14 h-14 border-2 border-[var(--foreground)] flex items-center justify-center text-[var(--foreground)] font-black text-2xl mx-auto mb-4 font-mono">
              G
            </div>
            <h1 className="text-2xl font-bold font-mono">{t.auth.welcomeBack}</h1>
            <p className="text-[var(--muted)] text-sm mt-1 font-mono">{t.auth.welcomeBackSub}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t.auth.email}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t.auth.password}</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                >
                  {showPw ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 border-2 border-[var(--foreground)] text-[var(--foreground)] font-bold font-mono tracking-wider hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all disabled:opacity-50 mt-2 uppercase"
            >
              {loading ? `${t.auth.signInButton}...` : t.auth.signInButton}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--muted)] mt-6 font-mono">
            {t.auth.noAccount}{" "}
            <Link href="/auth/register" className="text-[var(--foreground)] font-bold hover:underline">
              {t.auth.signUpLink}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
