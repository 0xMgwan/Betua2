"use client";
import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatTZS } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { FloppyDisk, ChartBar, TrendUp, Medal, Upload, X, Copy, Check, Users, Gift } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Stats {
  totalTrades: number;
  totalVolume: number;
  openPositions: number;
  marketsCreated: number;
}

interface ReferralData {
  referralCode: string;
  totalReferred: number;
  totalEarned: number;
  pendingEarnings: number;
  referrals: { username: string; joinedAt: string }[];
}

export default function ProfilePage() {
  const { user, setUser, fetchUser } = useUser();
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    displayName: "", bio: "", phone: "", avatarUrl: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<Stats>({ totalTrades: 0, totalVolume: 0, openPositions: 0, marketsCreated: 0 });
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        displayName: user.displayName || "",
        bio: user.bio || "",
        phone: user.phone || "",
        avatarUrl: user.avatarUrl || "",
      });
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => {
        setStats({
          totalTrades: (d.trades || []).length,
          totalVolume: (d.trades || []).reduce((s: number, t: { amountTzs: number }) => s + t.amountTzs, 0),
          openPositions: (d.positions || []).length,
          marketsCreated: 0,
        });
      });
    fetch("/api/referral")
      .then((r) => r.json())
      .then((d) => { if (d.referralCode) setReferral(d); })
      .catch(() => {});
  }, []);

  const referralLink = referral ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth/register?ref=${referral.referralCode}` : "";

  function copyReferralLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
  }


  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setForm((f) => ({ ...f, avatarUrl: "" }));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreview("");
    setForm((f) => ({ ...f, avatarUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadAvatarFile(): Promise<string | null> {
    if (!avatarFile) return form.avatarUrl || null;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", avatarFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data.url;
    } catch {
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let finalAvatarUrl = form.avatarUrl;
      if (avatarFile) {
        const uploaded = await uploadAvatarFile();
        if (uploaded) finalAvatarUrl = uploaded;
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, avatarUrl: finalAvatarUrl }),
      });
      if (res.ok) {
        await fetchUser();
        setAvatarFile(null);
        setAvatarPreview("");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center py-32">
          <Link href="/auth/login" className="px-6 py-2.5 bg-[var(--accent)] text-black rounded-xl font-semibold text-sm">
            {t.nav.signIn}
          </Link>
        </div>
      </div>
    );
  }

  const STAT_ITEMS = [
    { label: t.profile.totalTrades, value: stats.totalTrades, icon: ChartBar },
    { label: t.profile.volumeTraded, value: formatTZS(stats.totalVolume), icon: TrendUp },
    { label: t.portfolio.openPositions, value: stats.openPositions, icon: Medal },
    { label: t.profile.balance, value: formatTZS(user.balanceTzs || 0), icon: Medal },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{t.profile.title}</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Avatar & stats */}
          <div className="space-y-4">
            {/* Avatar */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 text-center">
              <div className="relative inline-block mb-4">
                {(avatarPreview || form.avatarUrl) ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarPreview || form.avatarUrl}
                      alt={user.username}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[var(--accent)]"
                    />
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-black text-3xl">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="font-bold text-lg">{user.displayName || user.username}</h2>
              <p className="text-[var(--muted)] text-sm">@{user.username}</p>
              {user.bio && (
                <p className="text-sm mt-2 text-[var(--muted)] leading-relaxed">{user.bio}</p>
              )}
              <div className="mt-3 text-xs text-[var(--muted)]">{user.email}</div>
            </div>

            {/* Stats */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
              {STAT_ITEMS.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{s.label}</span>
                  <span className="font-bold">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Wallet address */}
            {user.walletAddress && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
                <p className="text-xs font-medium text-[var(--muted)] mb-1">{t.profile.walletAddress}</p>
                <p className="text-xs font-mono break-all text-[var(--foreground)] opacity-70">
                  {user.walletAddress}
                </p>
              </div>
            )}

            {/* Referral */}
            {referral && (
              <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Gift size={16} className="text-[var(--accent)]" />
                  <h3 className="font-bold text-sm">{locale === "sw" ? "Referral" : "Refer & Earn"}</h3>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {locale === "sw"
                    ? "Shiriki kiungo chako. Pata 1% ya amana ya kwanza ya kila mtu unayemwalika!"
                    : "Share your link. Earn 1% of every invited user's first deposit!"}
                </p>

                {/* Referral link */}
                <div className="flex gap-1.5">
                  <div className="flex-1 px-2.5 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-[10px] font-mono text-[var(--muted)] truncate">
                    {referralLink}
                  </div>
                  <button
                    onClick={copyReferralLink}
                    className="px-2.5 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg hover:border-[var(--accent)]/40 transition-colors"
                    title="Copy"
                  >
                    {refCopied ? <Check size={14} className="text-[var(--accent)]" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Social share */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{locale === "sw" ? "Shiriki" : "Share"}</span>
                  <div className="flex gap-1.5">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent((locale === "sw" ? "Jiunge na GUAP! " : "Join GUAP! ") + referralLink)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 transition-colors"
                      title="WhatsApp"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent((locale === "sw" ? "Jiunge na GUAP! " : "Join GUAP! ") + referralLink)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--foreground)]/10 hover:bg-[var(--foreground)]/20 transition-colors"
                      title="X (Twitter)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1877F2]/15 hover:bg-[#1877F2]/25 transition-colors"
                      title="Facebook"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[var(--background)] rounded-lg p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Users size={12} className="text-[var(--accent)]" />
                      <span className="text-[10px] text-[var(--muted)]">{locale === "sw" ? "Walioalikwa" : "Invited"}</span>
                    </div>
                    <p className="font-bold text-lg">{referral.totalReferred}</p>
                  </div>
                  <div className="bg-[var(--background)] rounded-lg p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <TrendUp size={12} className="text-[var(--accent)]" />
                      <span className="text-[10px] text-[var(--muted)]">{locale === "sw" ? "Umeingiza" : "Earned"}</span>
                    </div>
                    <p className="font-bold text-lg text-[var(--accent)]">{formatTZS(referral.totalEarned)}</p>
                  </div>
                </div>

                {/* Pending */}
                {referral.pendingEarnings > 0 && (
                  <p className="text-[10px] text-yellow-400 font-mono text-center">
                    ⏳ {formatTZS(referral.pendingEarnings)} {locale === "sw" ? "inasubiri" : "pending"}
                  </p>
                )}

                {/* Referred users list */}
                {referral.referrals.length > 0 && (
                  <div className="pt-1 border-t border-[var(--card-border)]">
                    <p className="text-[10px] text-[var(--muted)] mb-1.5 font-medium uppercase tracking-wider">
                      {locale === "sw" ? "Walioalikwa" : "Your Referrals"}
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {referral.referrals.map((r) => (
                        <div key={r.username} className="flex items-center justify-between text-xs">
                          <span className="font-mono">@{r.username}</span>
                          <span className="text-[var(--muted)] text-[10px]">
                            {new Date(r.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Edit form */}
          <div className="md:col-span-2">
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6">
              <h2 className="font-bold mb-6">{t.profile.editProfile}</h2>

              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.profile.displayName}</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder={t.profile.displayNamePlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.profile.bio}</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                    placeholder={t.profile.bioPlaceholder}
                    rows={3}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.profile.phone}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="255712345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">{t.profile.profilePhoto}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2.5 border border-[var(--card-border)] rounded-xl text-sm font-medium hover:border-[var(--accent)]/40 transition-colors shrink-0 bg-[var(--background)]"
                    >
                      <Upload size={13} />
                      {t.profile.upload}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                    />
                    <input
                      type="url"
                      value={form.avatarUrl}
                      onChange={(e) => {
                        setForm({ ...form, avatarUrl: e.target.value });
                        if (e.target.value) { setAvatarFile(null); setAvatarPreview(""); }
                      }}
                      className="flex-1 px-3 py-2.5 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                      placeholder={t.profile.orPasteUrl}
                      disabled={!!avatarFile}
                    />
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">{t.profile.imageFormat}</p>
                </div>

                {/* Read-only */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[var(--muted)]">{t.profile.username}</label>
                    <input
                      value={user.username}
                      disabled
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[var(--muted)]">{t.profile.email}</label>
                    <input
                      value={user.email}
                      disabled
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-sm opacity-50 cursor-not-allowed"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || uploadingAvatar}
                  className={cn(
                    "w-full py-3 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm",
                    saved
                      ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]"
                      : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                  )}
                >
                  <FloppyDisk size={16} />
                  {uploadingAvatar ? t.profile.uploading : loading ? t.profile.saving : saved ? t.profile.saved : t.profile.saveChanges}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
