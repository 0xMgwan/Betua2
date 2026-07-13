"use client";
import { Image as ImageIcon } from "@phosphor-icons/react";

// A small click-to-upload logo slot (e.g. a team badge). Shows the current
// image or a placeholder letter, a hover overlay, and a persistent corner
// camera indicator so it clearly reads as an upload target.
export function LogoUploadSlot({
  url,
  letter,
  onFile,
  size = 32,
  title,
}: {
  url?: string;
  letter?: string;
  onFile: (file: File | null) => void;
  size?: number;
  title?: string;
}) {
  return (
    <label
      className="shrink-0 flex items-center justify-center border border-[var(--card-border)] rounded-lg cursor-pointer overflow-hidden relative group/logo bg-[var(--background)]"
      style={{ width: size, height: size }}
      title={title || "Upload logo"}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-mono font-black text-[var(--muted)]">{letter}</span>
      )}
      <span className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity">
        <ImageIcon size={12} weight="bold" className="text-white" />
      </span>
      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 border border-[var(--card)] flex items-center justify-center">
        <ImageIcon size={8} weight="fill" className="text-white" />
      </span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}
