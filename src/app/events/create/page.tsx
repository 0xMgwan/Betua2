"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useUser } from "@/store/useUser";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Calendar, Plus, X, ArrowRight, SoccerBall, Trophy, ChartLineUp, Globe, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "Sports", label: "Sports", icon: SoccerBall },
  { id: "Politics", label: "Politics", icon: Trophy },
  { id: "Crypto", label: "Crypto", icon: ChartLineUp },
  { id: "Entertainment", label: "Entertainment", icon: Sparkle },
  { id: "Other", label: "Other", icon: Globe },
];

interface MarketDraft {
  id: string;
  title: string;
  type: "binary" | "multi";
  options?: string[];
}

export default function CreateEventPage() {
  const router = useRouter();
  const { user } = useUser();
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [markets, setMarkets] = useState<MarketDraft[]>([]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold mb-4">Please sign in</h1>
        </div>
      </div>
    );
  }

  const addMarket = (marketTitle: string, type: "binary" | "multi", options?: string[]) => {
    setMarkets([...markets, { id: Date.now().toString(), title: marketTitle, type, options }]);
  };

  const removeMarket = (id: string) => {
    setMarkets(markets.filter((m) => m.id !== id));
  };

  const handleSubmit = async () => {
    if (!title || !category || !startsAt) {
      setError("Please fill in all required fields");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, subCategory, imageUrl, startsAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const eventId = data.event.id;

      for (const market of markets) {
        await fetch(`/api/events/${eventId}/markets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: market.title,
            options: market.type === "multi" ? market.options : undefined,
          }),
        });
      }

      router.push(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Create Event</h1>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Event Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Liverpool vs Fulham"
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                    category === cat.id
                      ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                      : "bg-[var(--card)] border-[var(--card-border)]"
                  )}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sub-category</label>
            <input
              type="text"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              placeholder="e.g., EPL, NBA, etc."
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Event Resolution Time *</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--card-border)] rounded-xl"
            />
          </div>

          <div className="border-t border-[var(--card-border)] pt-6">
            <h2 className="text-lg font-bold mb-4">Markets ({markets.length})</h2>
            
            {markets.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-[var(--card)] rounded-lg mb-2">
                <div>
                  <span className="font-medium">{m.title}</span>
                  <span className="text-xs text-[var(--muted)] ml-2">
                    {m.type === "binary" ? "YES/NO" : `${m.options?.length} options`}
                  </span>
                </div>
                <button onClick={() => removeMarket(m.id)} className="text-red-400">
                  <X size={16} />
                </button>
              </div>
            ))}

            <AddMarketForm onAdd={addMarket} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !title || !category || !startsAt}
            className="w-full py-3 bg-[var(--accent)] text-black font-bold rounded-xl disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Event"}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function AddMarketForm({ onAdd }: { onAdd: (title: string, type: "binary" | "multi", options?: string[]) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"binary" | "multi">("binary");
  const [options, setOptions] = useState(["", ""]);

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title, type, type === "multi" ? options.filter((o) => o.trim()) : undefined);
    setTitle("");
    setOptions(["", ""]);
  };

  return (
    <div className="p-4 bg-[var(--background)] border border-dashed border-[var(--card-border)] rounded-xl">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Market question, e.g., Will Liverpool win?"
        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--card-border)] rounded-lg mb-3"
      />
      
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setType("binary")}
          className={cn("px-3 py-1 rounded text-sm", type === "binary" ? "bg-[var(--accent)] text-black" : "bg-[var(--card)]")}
        >
          YES/NO
        </button>
        <button
          onClick={() => setType("multi")}
          className={cn("px-3 py-1 rounded text-sm", type === "multi" ? "bg-[var(--accent)] text-black" : "bg-[var(--card)]")}
        >
          Multiple Options
        </button>
      </div>

      {type === "multi" && (
        <div className="space-y-2 mb-3">
          {options.map((opt, i) => (
            <input
              key={i}
              type="text"
              value={opt}
              onChange={(e) => {
                const newOpts = [...options];
                newOpts[i] = e.target.value;
                setOptions(newOpts);
              }}
              placeholder={`Option ${i + 1}`}
              className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm"
            />
          ))}
          <button
            onClick={() => setOptions([...options, ""])}
            className="text-xs text-[var(--accent)]"
          >
            + Add Option
          </button>
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={!title.trim()}
        className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-medium disabled:opacity-50"
      >
        <Plus size={14} /> Add Market
      </button>
    </div>
  );
}
