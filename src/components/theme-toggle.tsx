'use client';

import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="ui-switch"
      role="switch"
      onClick={toggleTheme}
      type="button"
    >
      <span className="ui-switch-track" aria-hidden>
        <span className={`ui-switch-thumb ${isDark ? 'translate-x-4' : ''}`} />
      </span>
      <span className="text-sm font-medium">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
