'use client';

import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { mounted, resolvedTheme, toggleTheme } = useTheme();

  if (!mounted) {
    return (
      <button
        aria-hidden="true"
        className="ui-switch invisible pointer-events-none"
        disabled
        type="button"
      >
        <span className="ui-switch-track" aria-hidden>
          <span className="ui-switch-thumb" />
        </span>
        <span className="text-sm font-medium">Theme</span>
      </button>
    );
  }

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
