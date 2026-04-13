'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  mounted: boolean;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = 'teaching-aid-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [mounted, setMounted] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('light');

  useEffect(() => {
    const nextTheme = getStoredTheme() ?? getSystemTheme();
    setResolvedTheme(nextTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  }, [mounted, resolvedTheme]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function handleChange(event: MediaQueryListEvent) {
      if (getStoredTheme()) {
        return;
      }

      setResolvedTheme(event.matches ? 'dark' : 'light');
    }

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [mounted]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mounted,
      resolvedTheme,
      setTheme: setResolvedTheme,
      toggleTheme: () => setResolvedTheme((current) => (current === 'dark' ? 'light' : 'dark'))
    }),
    [mounted, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return value;
}
