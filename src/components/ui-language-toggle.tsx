'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type UiLanguage = 'en' | 'fr';

type UiLanguageContextValue = {
  mounted: boolean;
  uiLanguage: UiLanguage;
  setUiLanguage: (language: UiLanguage) => void;
  toggleUiLanguage: () => void;
};

const UI_LANGUAGE_STORAGE_KEY = 'teaching-aid-ui-language';

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
      setUiLanguage,
      toggleUiLanguage: () => setUiLanguage((current) => (current === 'fr' ? 'en' : 'fr'))
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

function FlagIcon({
  active,
  children
}: {
  active: boolean;
  children: ReactNode;
}) {
  return <span className={`text-sm transition-opacity ${active ? 'opacity-100' : 'opacity-45'}`}>{children}</span>;
}

export function UiLanguageToggle() {
  const { mounted, toggleUiLanguage, uiLanguage } = useUiLanguage();

  if (!mounted) {
    return (
      <button aria-hidden="true" className="ui-switch invisible pointer-events-none" disabled type="button">
        <span className="ui-switch-track relative flex items-center justify-between" aria-hidden style={{ width: '4rem' }}>
          <span className="absolute inset-y-0 left-3 flex items-center">
            <FlagIcon active>{'🇫🇷'}</FlagIcon>
          </span>
          <span className="ui-switch-thumb absolute left-[0.125rem] top-[0.125rem]" />
          <span className="absolute inset-y-0 right-3 flex items-center">
            <FlagIcon active>{'🇬🇧'}</FlagIcon>
          </span>
        </span>
      </button>
    );
  }

  const isFrench = uiLanguage === 'fr';

  return (
    <button
      aria-checked={isFrench}
      aria-label={isFrench ? 'Switch interface to English' : 'Switch interface to French'}
      className="ui-switch"
      onClick={toggleUiLanguage}
      role="switch"
      type="button"
    >
      <span className="ui-switch-track" aria-hidden>
        <span className="absolute inset-y-0 left-3 flex items-center">
          <FlagIcon active={isFrench}>{'🇫🇷'}</FlagIcon>
        </span>
        <span
          className="ui-switch-thumb absolute top-[0.125rem] transition-[left] duration-150 ease-out"
          style={{ left: isFrench ? '0.75rem' : '2.5rem' }}
        />
        <span className="absolute inset-y-0 right-3 flex items-center">
          <FlagIcon active={!isFrench}>{'🇬🇧'}</FlagIcon>
        </span>
      </span>
    </button>
  );
}
