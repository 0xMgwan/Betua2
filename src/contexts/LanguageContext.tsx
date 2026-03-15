'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from '../../messages/en.json';
import sw from '../../messages/sw.json';

type Locale = 'en' | 'sw';
type Messages = typeof en;

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [messages, setMessages] = useState<Messages>(en);

  useEffect(() => {
    // Load locale from cookie
    const savedLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('NEXT_LOCALE='))
      ?.split('=')[1] as Locale | undefined;
    
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'sw')) {
      setLocaleState(savedLocale);
      setMessages(savedLocale === 'sw' ? sw : en);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    setMessages(newLocale === 'sw' ? sw : en);
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    
    // Save to database for authenticated users
    fetch('/api/user/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: newLocale }),
    }).catch(err => console.error('Failed to save locale preference:', err));
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: messages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
