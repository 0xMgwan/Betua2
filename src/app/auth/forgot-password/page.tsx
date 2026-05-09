"use client";
import { useState } from "react";
import Link from "next/link";
import { EnvelopeSimple, ArrowLeft } from "@phosphor-icons/react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        {/* Terminal header */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)] bg-[var(--background)]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27ca40]" />
            <span className="ml-2 text-[10px] font-mono text-[var(--muted)]">forgot_password.sh</span>
          </div>

          <div className="p-6">
            {/* Logo */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-black text-[var(--accent)] tracking-tight">GUAP</h1>
              <p className="text-[10px] font-mono text-[var(--muted)] tracking-widest mt-1">PREDICT · TRADE · WIN</p>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 flex items-center justify-center">
                  <EnvelopeSimple size={28} className="text-[var(--accent)]" />
                </div>
                <div>
                  <p className="font-bold text-[var(--foreground)] mb-1">Check your inbox</p>
                  <p className="text-sm text-[var(--muted)]">
                    If <span className="text-[var(--foreground)]">{email}</span> has an account, you&apos;ll receive a reset link shortly. It expires in 1 hour.
                  </p>
                </div>
                <p className="text-xs text-[var(--muted)]">Didn&apos;t get it? Check your spam folder.</p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline font-mono"
                >
                  <ArrowLeft size={14} /> Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="text-[10px] font-mono text-[var(--accent)] mb-3">$ ./reset --email</p>
                  <h2 className="text-lg font-bold mb-1">Forgot your password?</h2>
                  <p className="text-sm text-[var(--muted)]">Enter your email and we&apos;ll send you a reset link.</p>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--muted)] mb-1.5 uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <EnvelopeSimple size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[var(--accent)] text-black font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition-all font-mono tracking-wide"
                >
                  {loading ? "SENDING..." : "SEND RESET LINK"}
                </button>

                <div className="text-center">
                  <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-mono">
                    <ArrowLeft size={14} /> Back to login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
