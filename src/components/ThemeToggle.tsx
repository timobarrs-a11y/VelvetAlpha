import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Light/dark toggle. Reads and flips the resolved theme via the theme store.
 * Drop it into any header or settings menu:  <ThemeToggle />
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const resolved = useThemeStore((s) => s.resolved);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border border-surface-300 bg-surface-100 text-ink-secondary hover:text-ink hover:border-surface-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${className}`}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

export default ThemeToggle;
