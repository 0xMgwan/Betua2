'use client';

import { useState } from 'react';
import { Globe } from '@phosphor-icons/react';

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.cookie.includes('NEXT_LOCALE=sw') ? 'sw' : 'en';
    }
    return 'en';
  });

  const switchLanguage = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    setLocale(newLocale);
    window.location.reload();
  };

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--card)] transition-colors"
        aria-label="Change language"
      >
        <Globe size={20} weight="duotone" />
        <span className="text-sm font-semibold uppercase">{locale}</span>
      </button>
      
      <div className="absolute right-0 mt-2 w-32 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <button
          onClick={() => switchLanguage('en')}
          className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--background)] transition-colors rounded-t-lg ${
            locale === 'en' ? 'font-bold text-[var(--accent)]' : ''
          }`}
        >
          English
        </button>
        <button
          onClick={() => switchLanguage('sw')}
          className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--background)] transition-colors rounded-b-lg ${
            locale === 'sw' ? 'font-bold text-[var(--accent)]' : ''
          }`}
        >
          Kiswahili
        </button>
      </div>
    </div>
  );
}
