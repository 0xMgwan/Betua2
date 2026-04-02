"use client";
import { useState } from "react";
import { EnvelopeSimple, Check } from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";

export function EmailSubscribe() {
  const { locale } = useLanguage();
  const isSw = locale === "sw";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-sm font-mono">
        <Check size={16} weight="bold" />
        {isSw ? "Umejiandikisha!" : "Subscribed!"}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <EnvelopeSimple size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isSw ? "Barua pepe yako..." : "Your email..."}
          className="w-full pl-9 pr-3 py-2.5 bg-[var(--card)] border border-[var(--card-border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-4 py-2.5 bg-[var(--accent)] text-black font-mono font-bold text-sm hover:bg-[var(--accent)]/90 disabled:opacity-50"
      >
        {status === "loading" ? "..." : isSw ? "JIANDIKISHE" : "SUBSCRIBE"}
      </button>
    </form>
  );
}
