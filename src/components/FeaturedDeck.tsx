"use client";
import { useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

interface DeckItem {
  id: string;
  render: () => ReactNode;
}

// Stacked, swipeable card deck (Limitless style): the top card is draggable;
// swipe left/right past a threshold sends it to the back and brings the next
// card forward. Cards behind peek as a stacked deck.
export function FeaturedDeck({ items, label }: { items: DeckItem[]; label?: string }) {
  const idsKey = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<DeckItem[]>(items);

  // Re-sync when the underlying list changes (e.g. category switch)
  useEffect(() => {
    setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (order.length === 0) return null;

  const advance = () =>
    setOrder((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));

  const top = order[0];
  const peek1 = order[1];
  const peek2 = order[2];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted)]">
          ★ {label || "Featured"}
        </p>
        {order.length > 1 && (
          <span className="text-[9px] font-mono text-[var(--muted)]/70">
            {order.length} · {label ? "swipe →" : "swipe →"}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Peek card 2 (furthest back) */}
        {peek2 && (
          <div className="absolute inset-0 -z-20 origin-top scale-[0.90] translate-y-4 opacity-40 pointer-events-none">
            {peek2.render()}
          </div>
        )}
        {/* Peek card 1 */}
        {peek1 && (
          <div className="absolute inset-0 -z-10 origin-top scale-[0.95] translate-y-2 opacity-70 pointer-events-none">
            {peek1.render()}
          </div>
        )}

        {/* Top draggable card */}
        <motion.div
          key={top.id}
          drag={order.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 400) {
              advance();
            }
          }}
          initial={{ scale: 0.96, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          whileTap={{ cursor: "grabbing" }}
          className="relative cursor-grab touch-pan-y"
        >
          {top.render()}
        </motion.div>
      </div>
    </div>
  );
}
