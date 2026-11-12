'use client';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'gym:theme';

/** The theme the operating system asks for. */
export function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Puts the theme on <html>, where the CSS picks it up. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private browsing, no big deal.
  }
}

/**
 * Runs before the page paints so the first frame is already the right theme.
 * Kept as a string because it has to run before React hydrates.
 */
export const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem('${THEME_KEY}');var d=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=d;}catch(e){}})();`;
