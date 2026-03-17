"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeSlash, ArrowRight, Terminal } from "@phosphor-icons/react";

export default function PartnersAuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyDescription: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = isLogin ? "/api/partners/login" : "/api/partners/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (isLogin) {
        router.push("/partners/dashboard");
      } else {
        setSuccess("Registration successful! Your account is pending approval. You can login to view your dashboard.");
        setIsLogin(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold mb-2">
            <Terminal size={32} className="text-[var(--accent)]" />
            <span>GUAP</span>
          </Link>
          <h1 className="text-xl font-mono text-[var(--muted)]">Partner Portal</h1>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] p-6">
          <div className="flex mb-6 border-b border-[var(--card-border)]">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 pb-3 font-mono text-sm ${isLogin ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--muted)]"}`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 pb-3 font-mono text-sm ${!isLogin ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--muted)]"}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-mono text-[var(--muted)] mb-1">Company Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:border-[var(--accent)] outline-none"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-[var(--muted)] mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:border-[var(--accent)] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--muted)] mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:border-[var(--accent)] outline-none"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-mono text-[var(--muted)] mb-1">Company Description (optional)</label>
                <textarea
                  value={form.companyDescription}
                  onChange={(e) => setForm({ ...form, companyDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] text-sm font-mono focus:border-[var(--accent)] outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            {error && <p className="text-red-500 text-xs font-mono">{error}</p>}
            {success && <p className="text-green-500 text-xs font-mono">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[var(--accent)] text-black font-mono font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Loading..." : isLogin ? "Login" : "Register"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[var(--card-border)] text-center">
            <Link href="/developers" className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">
              ← Back to API Documentation
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
