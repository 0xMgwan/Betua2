"use client";
import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { CATEGORIES, SPORTS_SUBCATEGORIES, cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/store/useUser";
import { useCurrency } from "@/store/useCurrency";
import { TerminalDatePicker } from "@/components/TerminalDatePicker";
import {
  CalendarBlank, Image as ImageIcon, Upload, X, Plus, Trash,
  Terminal, Lightning, ArrowLeft, PencilSimple, CheckSquare, ListBullets,
} from "@phosphor-icons/react";

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  subCategory?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  status: string;
  markets: Array<{
    id: string;
    title: string;
    status: string;
    options?: string[] | null;
  }>;
  creator: { username: string };
}

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<EventData | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Sports",
    subCategory: "",
    startsAt: "",
    imageUrl: "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch event data
  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          const eventData = data.event || data; // Handle both formats
          setEvent(eventData);
          setForm({
            title: eventData.title || "",
            description: eventData.description || "",
            category: eventData.category || "Sports",
            subCategory: eventData.subCategory || "",
            startsAt: eventData.startsAt ? new Date(eventData.startsAt).toISOString() : "",
            imageUrl: eventData.imageUrl || "",
          });
          if (eventData.imageUrl) {
            setImagePreview(eventData.imageUrl);
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

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return form.imageUrl || null;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      return url;
    } catch (err) {
      setError("Failed to upload image");
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !event) return;
    if (event.creator?.username && event.creator.username !== user.username) {
      setError("You can only edit your own events");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const uploaded = await uploadImage();
        if (uploaded) imageUrl = uploaded;
      }

      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          subCategory: form.subCategory,
          startsAt: new Date(form.startsAt).toISOString(),
          imageUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update event");
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
          <button onClick={() => router.back()} className="text-[var(--accent)]">Go back</button>
        </div>
      </div>
    );
  }

  if (!user || (event.creator?.username && user.username !== event.creator.username)) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
          <p className="text-[var(--muted)] mb-4">You can only edit your own events</p>
          <Link href={`/events/${eventId}`} className="text-[var(--accent)]">Back to Event</Link>
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

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <PencilSimple size={24} className="text-[var(--accent)]" />
          Edit Event
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Details */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4"
          >
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Terminal size={16} className="text-[var(--accent)]" />
              Event Details
            </h3>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Event Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.slice(0, 6).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat, subCategory: "" })}
                    className={cn(
                      "p-2 rounded-lg border text-sm transition-all",
                      form.category === cat
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--card-border)] hover:border-[var(--accent)]/50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategory for Sports */}
            {form.category === "Sports" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">League</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPORTS_SUBCATEGORIES.map((sub) => (
                    <button
                      key={sub.value}
                      type="button"
                      onClick={() => setForm({ ...form, subCategory: sub.value })}
                      className={cn(
                        "p-2 rounded-lg border text-sm transition-all flex items-center gap-2",
                        form.subCategory === sub.value
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                          : "border-[var(--card-border)] hover:border-cyan-500/50"
                      )}
                    >
                      {sub.icon.startsWith('/') ? (
                        <Image src={sub.icon} alt={sub.label} width={16} height={16} className="object-contain" />
                      ) : (
                        <span>{sub.icon}</span>
                      )}
                      {sub.value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Event Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(""); setForm({ ...form, imageUrl: "" }); }}
                    className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 border-2 border-dashed border-[var(--card-border)] rounded-lg flex flex-col items-center justify-center gap-2 hover:border-[var(--accent)] transition-colors"
                >
                  <Upload size={24} className="text-[var(--muted)]" />
                  <span className="text-xs text-[var(--muted)]">Upload</span>
                </button>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Start Time</label>
              <TerminalDatePicker
                selected={form.startsAt ? new Date(form.startsAt) : null}
                onChange={(date) => setForm({ ...form, startsAt: date ? date.toISOString() : "" })}
                minDate={new Date()}
              />
            </div>
          </motion.div>

          {/* Markets Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <ListBullets size={16} className="text-purple-400" />
                Markets ({event.markets.length})
              </h3>
              <Link
                href={`/events/${eventId}/add-market`}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold bg-[var(--accent)] text-[#0a0a0a] hover:opacity-90 transition-colors"
              >
                <Plus size={14} />
                Add Market
              </Link>
            </div>
            
            <div className="space-y-2">
              {event.markets.map((market) => (
                <div key={market.id} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{market.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {market.options && market.options.length >= 2 
                        ? `${market.options.length} options` 
                        : "Yes/No"}
                    </p>
                  </div>
                  <Link
                    href={`/markets/${market.id}`}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    View →
                  </Link>
                </div>
              ))}
              {event.markets.length === 0 && (
                <p className="text-center text-[var(--muted)] py-4">No markets yet</p>
              )}
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
            disabled={loading || uploadingImage || !form.title || !form.startsAt}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
              loading || uploadingImage || !form.title || !form.startsAt
                ? "bg-[var(--card-border)] text-[var(--muted)] cursor-not-allowed"
                : "bg-[var(--accent)] text-[#0a0a0a] hover:opacity-90"
            )}
          >
            {loading || uploadingImage ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {uploadingImage ? "Uploading..." : "Saving..."}
              </>
            ) : (
              <>
                <Lightning size={20} weight="fill" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}
