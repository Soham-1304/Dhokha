import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

function getInitialTheme() {
  return localStorage.getItem('theme') || 'dark';
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-orbit-toggle ${className}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-orbit-icon" aria-hidden="true">
        {isDark ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
      </span>
      <span className="theme-orbit-label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
