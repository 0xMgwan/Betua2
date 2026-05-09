"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeSlash, CheckCircle } from "@phosphor-icons/react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) setError("Invalid or missing reset link. Please request a new one.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--card-border)] bg-[var(--background)]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27ca40]" />
            <span className="ml-2 text-[10px] font-mono text-[var(--muted)]">reset_password.sh</span>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-black text-[var(--accent)] tracking-tight">GUAP</h1>
              <p className="text-[10px] font-mono text-[var(--muted)] tracking-widest mt-1">PREDICT · TRADE · WIN</p>
            </div>

            {done ? (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30 flex items-center justify-center">
                  <CheckCircle size={28} className="text-[var(--accent)]" weight="fill" />
                </div>
                <div>
                  <p className="font-bold text-[var(--foreground)] mb-1">Password updated!</p>
                  <p className="text-sm text-[var(--muted)]">Redirecting you to login...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="text-[10px] font-mono text-[var(--accent)] mb-3">$ ./set_new_password</p>
                  <h2 className="text-lg font-bold mb-1">Set a new password</h2>
                  <p className="text-sm text-[var(--muted)]">Choose a strong password for your account.</p>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--muted)] mb-1.5 uppercase tracking-wider">New password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Min. 8 characters"
                      className="w-full pl-9 pr-10 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]">
                      {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--muted)] mb-1.5 uppercase tracking-wider">Confirm password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      placeholder="Repeat password"
                      className="w-full pl-9 pr-4 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 bg-[var(--accent)] text-black font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition-all font-mono tracking-wide"
                >
                  {loading ? "UPDATING..." : "UPDATE PASSWORD"}
                </button>

                <div className="text-center">
                  <Link href="/auth/forgot-password" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-mono">
                    Request a new link
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
