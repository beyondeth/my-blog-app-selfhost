'use client';

import { createContext, useContext, useMemo } from 'react';
import { getMessages, translate } from '@/lib/i18n/messages';
import { localizePath, type AppLocale } from '@/lib/i18n/config';

type LocaleContextValue = {
  locale: AppLocale;
  t: (key: string) => string;
  href: (path: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: React.ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(() => {
    const messages = getMessages(locale);

    return {
      locale,
      t: (key: string) => translate(locale, key),
      href: (path: string) => localizePath(path, locale),
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocaleContext must be used inside LocaleProvider');
  }

  return context;
}
