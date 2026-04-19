'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
  UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS,
  UI_LANGUAGE_COOKIE_NAME,
  UI_LANGUAGE_STORAGE_KEY,
  type UiLanguage
} from '@/lib/ui-language';

type UiLanguageContextValue = {
  mounted: boolean;
  uiLanguage: UiLanguage;
  setUiLanguage: (language: UiLanguage) => void;
};

const UiLanguageContext = createContext<UiLanguageContextValue | null>(null);

function getStoredUiLanguage(): UiLanguage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  return value === 'fr' || value === 'en' ? value : null;
}

export function UiLanguageProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [mounted, setMounted] = useState(false);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');

  useEffect(() => {
    const nextLanguage = getStoredUiLanguage() ?? 'en';
    setUiLanguage(nextLanguage);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    document.documentElement.lang = uiLanguage;
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, uiLanguage);
  }, [mounted, uiLanguage]);

  const value = useMemo<UiLanguageContextValue>(
    () => ({
      mounted,
      uiLanguage,
      setUiLanguage
    }),
    [mounted, uiLanguage]
  );

  return <UiLanguageContext.Provider value={value}>{children}</UiLanguageContext.Provider>;
}

export function useUiLanguage() {
  const value = useContext(UiLanguageContext);

  if (!value) {
    throw new Error('useUiLanguage must be used within UiLanguageProvider');
  }

  return value;
}

export function UiLanguageToggle() {
  const router = useRouter();
  const { mounted, setUiLanguage, uiLanguage } = useUiLanguage();

  function applyUiLanguage(nextLanguage: UiLanguage) {
    setUiLanguage(nextLanguage);
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
    document.cookie = `${UI_LANGUAGE_COOKIE_NAME}=${nextLanguage}; path=/; max-age=${UI_LANGUAGE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.refresh();
  }

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="inline-flex overflow-hidden rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
      >
        <span className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
          <span aria-hidden="true">🇫🇷</span>
          <span>FR</span>
        </span>
        <span className="my-1 w-px bg-[color:var(--app-border)]" />
        <span className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
          <span aria-hidden="true">🇬🇧</span>
          <span>EN</span>
        </span>
      </div>
    );
  }

  const isFrench = uiLanguage === 'fr';

  return (
    <div
      aria-label="Interface language"
      className="inline-flex overflow-hidden rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1"
      role="group"
    >
      <button
        aria-pressed={isFrench}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
          isFrench
            ? 'bg-[color:var(--app-surface)] text-[color:var(--app-fg)] shadow-sm'
            : 'text-[color:var(--app-fg-muted)] hover:text-[color:var(--app-fg)]'
        }`}
        onClick={() => applyUiLanguage('fr')}
        type="button"
      >
        <span aria-hidden="true">🇫🇷</span>
        <span>FR</span>
      </button>
      <button
        aria-pressed={!isFrench}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
          !isFrench
            ? 'bg-[color:var(--app-surface)] text-[color:var(--app-fg)] shadow-sm'
            : 'text-[color:var(--app-fg-muted)] hover:text-[color:var(--app-fg)]'
        }`}
        onClick={() => applyUiLanguage('en')}
        type="button"
      >
        <span aria-hidden="true">🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
