'use client';

import { useState } from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme, mounted } = useTheme();
  const [spinning, setSpinning] = useState(false);

  // Until mounted, render a placeholder with same dimensions
  if (!mounted) {
    return (
      <div
        className={`header-btn w-10 h-10 flex items-center justify-center p-0.5 text-muted opacity-50 ${className}`}
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-[18px]">dark_mode</span>
      </div>
    );
  }

  const isLight = theme === 'light';

  const handleClick = () => {
    setSpinning(true);
    toggleTheme();
    setTimeout(() => setSpinning(false), 460);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={isLight ? 'Switch to Dark theme' : 'Switch to Light theme'}
      aria-label={isLight ? 'Switch to Dark theme' : 'Switch to Light theme'}
      className={`header-btn w-10 h-10 flex items-center justify-center p-0.5 transition-all duration-200 cursor-pointer ${
        isLight
          ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-500/10'
          : 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
      } ${className}`}
    >
      <span
        key={theme}
        className={`material-symbols-outlined text-[19px] inline-block ${
          spinning ? 'animate-theme-spin' : ''
        }`}
      >
        {isLight ? 'dark_mode' : 'light_mode'}
      </span>
    </button>
  );
}
