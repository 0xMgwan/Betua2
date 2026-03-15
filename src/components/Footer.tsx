"use client";
import { XLogo, InstagramLogo, WhatsappLogo } from "@phosphor-icons/react";

export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-center gap-5">
        <a
          href="https://x.com/shindaguap?s=11&t=hj2iETJ0AG45JhGdjSLNcg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Follow us on X"
        >
          <XLogo size={18} weight="fill" />
        </a>
        <a
          href="https://www.instagram.com/shindaguap?igsh=MWhzMm9xa2t4bmRvbw=="
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Follow us on Instagram"
        >
          <InstagramLogo size={18} weight="fill" />
        </a>
        <a
          href="https://chat.whatsapp.com/CfFU1jLmjDO8QLrH31Sv0C"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--muted)] hover:text-[#25D366] transition-colors"
          aria-label="Join our WhatsApp community"
        >
          <WhatsappLogo size={18} weight="fill" />
        </a>
      </div>
    </footer>
  );
}
