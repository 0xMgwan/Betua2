"use client";
import { useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

interface DeckItem {
  id: string;
  render: () => ReactNode;
}

// Stacked, swipeable card deck (Limitless style): the top card is draggable;
// swipe left/right past a threshold sends it to the back and brings the next
// card forward. Peek cards behind clearly signal "more to swipe", and
// pagination dots show position.
export function FeaturedDeck({ items, label }: { items: DeckItem[]; label?: string }) {
  const idsKey = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<DeckItem[]>(items);
  const [pos, setPos] = useState(0); // current index for dots (0..n-1)

  useEffect(() => {
    setOrder(items);
    setPos(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (order.length === 0) return null;

  const total = order.length;
  const advance = () => {
    setOrder((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));
    setPos((p) => (p + 1) % total);
  };

  const top = order[0];
  const peek1 = order[1];
  const peek2 = order[2];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono font-black uppercase tracking-widest text-[var(--foreground)]">
          ★ {label || "Featured"}
        </p>
        {total > 1 && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--accent)] uppercase tracking-wider">
            <motion.span animate={{ x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}>
              ←
            </motion.span>
            swipe
            <motion.span animate={{ x: [3, -3, 3] }} transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}>
              →
            </motion.span>
          </span>
        )}
      </div>

      {/* Deck — extra right/bottom padding gives the peek cards room to show */}
      <div className="relative pr-3 pb-3">
        {/* Peek card 2 (furthest back) */}
        {peek2 && (
          <div className="absolute inset-y-0 left-0 right-0 -z-20 origin-center scale-[0.92] translate-x-4 translate-y-3 rounded-xl overflow-hidden opacity-40 pointer-events-none shadow-lg">
            {peek2.render()}
          </div>
        )}
        {/* Peek card 1 — clearly visible edge on the right so users know to swipe */}
        {peek1 && (
          <div className="absolute inset-y-0 left-0 right-0 -z-10 origin-center scale-[0.96] translate-x-2.5 translate-y-1.5 rounded-xl overflow-hidden opacity-70 pointer-events-none shadow-lg">
            {peek1.render()}
          </div>
        )}

        {/* Top draggable card */}
        <motion.div
          key={top.id}
          drag={total > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.55}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 350) {
              advance();
            }
          }}
          initial={{ scale: 0.97, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          whileDrag={{ rotate: 1.5, cursor: "grabbing" }}
          className="relative cursor-grab touch-pan-y"
        >
          {top.render()}
        </motion.div>
      </div>

      {/* Pagination dots — show position in the deck */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={
                i === pos
                  ? "w-5 h-1.5 rounded-full bg-[var(--accent)] transition-all"
                  : "w-1.5 h-1.5 rounded-full bg-[var(--card-border)] transition-all"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
