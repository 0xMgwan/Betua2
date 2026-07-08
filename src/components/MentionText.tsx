"use client";

// Renders comment text with @mentions highlighted in the accent color.
// A token only counts as a mention when the @ starts the text or follows a
// non-word character — so emails (test@example.com) stay plain. Pure display;
// mention notifications are handled server-side on post.
export function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_.-]{2,32})/g);
  return (
    <>
      {parts.map((part, i) => {
        const isMentionShape = /^@[a-zA-Z0-9_.-]{2,32}$/.test(part);
        const prev = i > 0 ? parts[i - 1] : "";
        const validBoundary = prev === "" || /[^\w@]$/.test(prev);
        return isMentionShape && validBoundary ? (
          <span key={i} className="text-[var(--accent)] font-bold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}
