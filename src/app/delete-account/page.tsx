"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/store/useUser";

export default function DeleteAccountPage() {
  const { user, logout } = useUser();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (res.ok) { setDone(true); logout(); }
      else { alert("Failed to delete account. Please try again."); setDeleting(false); }
    } catch { alert("Network error. Please try again."); setDeleting(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl font-mono mb-8">
          <img src="/guap.svg" alt="GUAP" className="w-8 h-8" />
          <span className="tracking-wider">GUAP</span>
        </Link>

        <h1 className="text-2xl font-mono font-black mb-2">Delete your account</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          Request permanent deletion of your GUAP account and personal data.
        </p>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 space-y-4 text-sm">
          <div>
            <p className="font-bold mb-1">What is deleted</p>
            <p className="text-[var(--muted)]">Your personal data — name, email, phone number, profile photo, bio, and login credentials. After deletion you can no longer sign in, and the account cannot be recovered.</p>
          </div>
          <div>
            <p className="font-bold mb-1">What is retained</p>
            <p className="text-[var(--muted)]">Anonymized financial records (deposits, trades, settlements) are kept where required for legal, accounting, and anti-fraud obligations. They are no longer linked to your identity.</p>
          </div>
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-[13px]">
            <span className="font-bold text-yellow-600">Withdraw your balance first.</span> Any remaining balance is forfeited on deletion and cannot be recovered.
          </div>

          {done ? (
            <div className="p-3 bg-[#00e5a0]/10 border border-[#00e5a0]/30 rounded text-[13px] text-center">
              Your account has been deleted. <Link href="/" className="underline font-bold">Return home</Link>.
            </div>
          ) : user ? (
            !confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="w-full py-3 border-2 border-red-500/50 text-red-500 font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-red-500/10 transition-all"
              >
                Delete my account
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-red-500">This cannot be undone. Continue?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirm(false)} disabled={deleting} className="py-3 border-2 border-[var(--card-border)] text-[var(--muted)] font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[var(--card)] transition-all disabled:opacity-50">Cancel</button>
                  <button onClick={deleteAccount} disabled={deleting} className="py-3 bg-red-500 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-red-600 transition-all disabled:opacity-50">{deleting ? "Deleting…" : "Yes, delete"}</button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-[var(--muted)] text-[13px]">To delete your account, sign in first, then return to this page (or use <span className="font-mono">Profile → Delete Account</span> in the app).</p>
              <Link href="/auth/login?redirect=/delete-account" className="block w-full text-center py-3 bg-[var(--foreground)] text-[var(--background)] font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity">
                Sign in to continue
              </Link>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[var(--muted)] mt-4">
          Need help? Email <a href="mailto:support@guap.gold" className="underline">support@guap.gold</a>.
        </p>
      </div>
    </div>
  );
}
