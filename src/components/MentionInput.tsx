"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { UserAvatar } from "@/components/UserAvatar";

interface Suggestion { username: string; avatarUrl?: string | null }

// A text input with @mention autocomplete. Detects the @token at the caret,
// queries /api/users/search, and shows a dropdown; picking inserts @username.
export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  // Character range of the @token currently being typed
  const tokenRange = useRef<{ start: number; end: number } | null>(null);

  // Find an @token that the caret sits inside/at the end of.
  const detectToken = useCallback((text: string, caret: number) => {
    // Walk back from the caret to a whitespace or start, looking for '@'
    let i = caret - 1;
    while (i >= 0 && /[a-zA-Z0-9_.-]/.test(text[i])) i--;
    if (i >= 0 && text[i] === "@") {
      const before = i === 0 ? "" : text[i - 1];
      if (before === "" || /[^\w@]/.test(before)) {
        return { start: i, end: caret, query: text.slice(i + 1, caret) };
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!open || tokenRange.current === null) return;
    const q = value.slice(tokenRange.current.start + 1, tokenRange.current.end);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setSuggestions(data.users || []);
        setActive(0);
      } catch { /* aborted / offline */ }
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart ?? text.length;
    const tok = detectToken(text, caret);
    if (tok) {
      tokenRange.current = { start: tok.start, end: tok.end };
      setOpen(true);
    } else {
      tokenRange.current = null;
      setOpen(false);
    }
  };

  const pick = (username: string) => {
    const tr = tokenRange.current;
    if (!tr) return;
    const next = value.slice(0, tr.start) + "@" + username + " " + value.slice(tr.end);
    onChange(next);
    setOpen(false);
    tokenRange.current = null;
    // Restore focus + caret after the inserted mention
    requestAnimationFrame(() => {
      const pos = tr.start + username.length + 2;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(suggestions[active].username); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && onSubmit) { onSubmit(); }
  };

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={boxRef} className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute bottom-full left-0 mb-1 w-56 max-h-56 overflow-y-auto bg-[var(--card)] border-2 border-[var(--card-border)] rounded-xl shadow-2xl z-50">
          {suggestions.map((s, i) => (
            <button
              key={s.username}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(s.username); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${i === active ? "bg-[var(--accent)]/10" : "hover:bg-[var(--background)]"}`}
            >
              <UserAvatar username={s.username} avatarUrl={s.avatarUrl} size="sm" />
              <span className="text-sm font-mono font-bold truncate">@{s.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
