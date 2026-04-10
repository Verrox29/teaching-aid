'use client';

import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="ui-button ui-button-secondary"
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden>{isDark ? '☾' : '☼'}</span>
      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
