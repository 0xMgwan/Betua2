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
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono font-black uppercase tracking-widest text-[var(--foreground)]">
          ★ {label || "Featured"}
        </p>
        {order.length > 1 && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider">
            {order.length} {label ? "" : ""}
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            >
              swipe →
            </motion.span>
          </span>
        )}
      </div>

      {/* Padded so the stacked peek edges below the top card are visible but clipped */}
      <div className="relative pb-3">
        {/* Peek card 2 (furthest back) — clipped to the deck box, only a sliver shows */}
        {peek2 && (
          <div className="absolute inset-x-0 top-0 bottom-3 -z-20 origin-top scale-[0.90] translate-y-3 rounded-xl overflow-hidden opacity-50 pointer-events-none">
            {peek2.render()}
          </div>
        )}
        {/* Peek card 1 */}
        {peek1 && (
          <div className="absolute inset-x-0 top-0 bottom-3 -z-10 origin-top scale-[0.95] translate-y-1.5 rounded-xl overflow-hidden opacity-80 pointer-events-none">
            {peek1.render()}
          </div>
        )}

        {/* Top draggable card */}
        <motion.div
          key={top.id}
          drag={order.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 350) {
              advance();
            }
          }}
          initial={{ scale: 0.97, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          whileTap={{ cursor: "grabbing", scale: 0.99 }}
          className="relative cursor-grab touch-pan-y"
        >
          {top.render()}
        </motion.div>
      </div>
    </div>
  );
}
