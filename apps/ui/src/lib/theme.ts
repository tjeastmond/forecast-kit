export const THEME_STORAGE_KEY = 'forecast-kit-theme';

const THEME_COOKIE_MAX_AGE_SECONDS = String(60 * 60 * 24 * 365);

/** Runs before paint to apply stored dark theme and prevent a flash of light background. */
export const themeInitScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k);if(t!=='dark'&&t!=='light'){return}document.documentElement.classList.toggle('dark',t==='dark');document.cookie=k+'='+t+';path=/;max-age=${THEME_COOKIE_MAX_AGE_SECONDS};SameSite=Lax'}catch(e){}})();`;

export type Theme = 'light' | 'dark';

export function parseTheme(value: string | undefined): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

export function readThemeFromStorage(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
  return 'light';
}

export function writeThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_STORAGE_KEY}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
}
