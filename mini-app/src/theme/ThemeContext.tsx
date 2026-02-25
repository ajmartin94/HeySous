import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Theme, FontSize } from './tokens.js';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontSize: FontSize;
  setFontSize: (fs: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = 'hs-theme';
const FONT_SIZE_KEY = 'hs-font-size';

// Inline style overrides keyed by theme — must match variables.css values.
// These are applied as inline styles to override Telegram SDK's bindCssVars().
const themeInlineVars: Record<Theme, Record<string, string>> = {
  dark: {
    '--tg-theme-bg-color': '#1a1a2e',
    '--tg-theme-text-color': '#e8e8e8',
    '--tg-theme-hint-color': '#8a8a9a',
    '--tg-theme-subtitle-text-color': '#8a8a9a',
    '--tg-theme-secondary-bg-color': '#232340',
    '--tg-theme-section-bg-color': '#232340',
    '--tg-theme-section-header-text-color': '#8a8a9a',
    '--tg-theme-header-bg-color': '#16213e',
    '--tg-theme-accent-text-color': '#4A7FB5',
    '--tg-theme-link-color': '#6BA3D6',
    '--tg-theme-button-color': '#4A7FB5',
    '--tg-theme-button-text-color': '#ffffff',
    '--tg-theme-destructive-text-color': '#e53935',
    '--tgui--bg_color': '#1a1a2e',
    '--tgui--text_color': '#e8e8e8',
    '--tgui--secondary_hint_color': '#6a6a7a',
    '--tgui--section_bg_color': '#232340',
  },
  light: {
    '--tg-theme-bg-color': '#ffffff',
    '--tg-theme-text-color': '#1a1a1a',
    '--tg-theme-hint-color': '#999999',
    '--tg-theme-subtitle-text-color': '#999999',
    '--tg-theme-secondary-bg-color': '#f5f5f5',
    '--tg-theme-section-bg-color': '#ffffff',
    '--tg-theme-section-header-text-color': '#999999',
    '--tg-theme-header-bg-color': '#f5f5f5',
    '--tg-theme-accent-text-color': '#365F8C',
    '--tg-theme-link-color': '#365F8C',
    '--tg-theme-button-color': '#4A7FB5',
    '--tg-theme-button-text-color': '#ffffff',
    '--tg-theme-destructive-text-color': '#e53935',
    '--tgui--bg_color': '#ffffff',
    '--tgui--text_color': '#1a1a1a',
    '--tgui--secondary_hint_color': '#bbbbbb',
    '--tgui--section_bg_color': '#ffffff',
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    return (stored === 'small' || stored === 'medium' || stored === 'large') ? stored : 'small';
  });

  // Apply to DOM immediately when state changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    // Set as inline styles to override Telegram SDK's bindCssVars()
    const vars = themeInlineVars[theme];
    for (const [prop, val] of Object.entries(vars)) {
      root.style.setProperty(prop, val);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  function setTheme(t: Theme) { setThemeState(t); }
  function setFontSize(fs: FontSize) { setFontSizeState(fs); }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
