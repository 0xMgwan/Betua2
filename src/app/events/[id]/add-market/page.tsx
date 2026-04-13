"use client";
import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { useCurrency } from "@/store/useCurrency";
import { TerminalDatePicker } from "@/components/TerminalDatePicker";
import {
  CalendarBlank, Image as ImageIcon, CaretRight, Info,
  Upload, X, Plus, Trash, Terminal, Lightning,
  CheckSquare, ListBullets, ArrowLeft,
} from "@phosphor-icons/react";

const CREATION_FEE_TZS = 2000;

interface EventData {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  imageUrl?: string;
  startsAt: string;
}

export default function AddMarketToEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const { currency: displayCurrency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<EventData | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [form, setForm] = useState({
    title: "",
    description: "",
    resolvesAt: "",
  });

  const [marketType, setMarketType] = useState<"binary" | "multi">("binary");
  const [customOptions, setCustomOptions] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch event data
  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          setEvent(data);
          // Set default resolution date to event start time
          if (data.startsAt) {
            setForm(f => ({ ...f, resolvesAt: data.startsAt.slice(0, 16) }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch event:", err);
      } finally {
        setLoadingEvent(false);
      }
    }
    fetchEvent();
  }, [eventId]);

  function addOption() {
    if (customOptions.length >= 10) return;
    setCustomOptions([...customOptions, ""]);
  }

  function removeOption(index: number) {
    if (customOptions.length <= 2) return;
    setCustomOptions(customOptions.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...customOptions];
    updated[index] = value;
    setCustomOptions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError(locale === "sw" ? "Tafadhali ingia kwanza" : "Please sign in first");
      return;
    }
    if (!event) {
      setError("Event not found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create market under the event
      const marketBody: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        category: event.category,
        subCategory: event.subCategory,
        resolvesAt: new Date(form.resolvesAt).toISOString(),
        imageUrl: event.imageUrl, // Use event image
      };

      if (marketType === "multi") {
        const validOptions = customOptions.filter(o => o.trim());
        if (validOptions.length < 2) {
          setError(locale === "sw" ? "Ongeza angalau chaguo 2" : "Add at least 2 options");
          setLoading(false);
          return;
        }
        marketBody.options = validOptions;
      }

      const res = await fetch(`/api/events/${eventId}/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marketBody),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create market");
      }

      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (loadingEvent) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--card)] rounded w-1/2" />
            <div className="h-64 bg-[var(--card)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Event not found</h1>
          <button onClick={() => router.back()} className="text-[var(--accent)]">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Event
        </button>

        {/* Event Info */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            {event.imageUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={event.imageUrl} alt={event.title} width={48} height={48} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <p className="text-xs text-[var(--muted)] mb-1">Adding market to:</p>
              <h2 className="font-bold">{event.title}</h2>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 bg-[#00e5a0]/10 text-[#00e5a0] border border-[#00e5a0]/30">
                  {event.category}
                </span>
                {event.subCategory && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {event.subCategory}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4"
          >
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Terminal size={16} className="text-[var(--accent)]" />
              New Market
            </h3>

            {/* Market Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Market Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMarketType("binary")}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    marketType === "binary"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--card-border)] hover:border-[var(--accent)]/50"
                  )}
                >
                  <CheckSquare size={20} className={marketType === "binary" ? "text-[var(--accent)]" : "text-[var(--muted)]"} />
                  <p className="font-medium mt-1">Yes / No</p>
                  <p className="text-xs text-[var(--muted)]">Binary outcome</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMarketType("multi")}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    marketType === "multi"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-[var(--card-border)] hover:border-purple-500/50"
                  )}
                >
                  <ListBullets size={20} className={marketType === "multi" ? "text-purple-400" : "text-[var(--muted)]"} />
                  <p className="font-medium mt-1">Multiple Choice</p>
                  <p className="text-xs text-[var(--muted)]">Custom options</p>
                </button>
              </div>
            </div>

            {/* Market Question */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Market Question <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={marketType === "multi" ? "e.g., Who will score first?" : "e.g., Will Team A win?"}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>

            {/* Custom Options for Multi */}
            {marketType === "multi" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Options <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {customOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                      />
                      {customOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {customOptions.length < 10 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Resolution criteria..."
                rows={2}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-[var(--accent)] resize-none text-sm"
              />
            </div>

            {/* Resolution Date */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Resolution Date <span className="text-red-400">*</span>
              </label>
              <TerminalDatePicker
                selected={form.resolvesAt ? new Date(form.resolvesAt) : null}
                onChange={(date) => setForm({ ...form, resolvesAt: date ? date.toISOString() : "" })}
                minDate={new Date()}
              />
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !form.title || !form.resolvesAt}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
              loading || !form.title || !form.resolvesAt
                ? "bg-[var(--card-border)] text-[var(--muted)] cursor-not-allowed"
                : "bg-[var(--accent)] text-[#0a0a0a] hover:opacity-90"
            )}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Lightning size={20} weight="fill" />
                Add Market to Event
              </>
            )}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}
