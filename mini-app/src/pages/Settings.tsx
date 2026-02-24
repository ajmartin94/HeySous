import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useTheme } from '../theme/ThemeContext.js';
import type { Theme, FontSize } from '../theme/tokens.js';

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const fontSizeOptions: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => {
      off();
    };
  }, [navigate]);

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 'var(--hs-font-size-small)',
    fontWeight: 600,
    color: 'var(--tg-theme-hint-color, #999)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
    marginTop: '24px',
  };

  const pillRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      padding: '12px 16px',
      borderRadius: '12px',
      border: 'none',
      fontSize: 'var(--hs-font-size-body)',
      fontWeight: 500,
      cursor: 'pointer',
      minHeight: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'var(--hs-accent)' : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
      color: active ? '#ffffff' : 'var(--tg-theme-text-color, #000)',
      transition: 'background 0.15s, color 0.15s',
      WebkitTapHighlightColor: 'transparent',
    };
  }

  return (
    <div style={{ padding: 'var(--hs-spacing-section)' }}>
      {/* Header */}
      <div
        style={{
          fontSize: 'var(--hs-font-size-heading)',
          fontWeight: 600,
          color: 'var(--hs-accent)',
          paddingBottom: '8px',
        }}
      >
        Settings
      </div>

      {/* Appearance section */}
      <div style={sectionLabelStyle}>Appearance</div>
      <div style={pillRowStyle}>
        {themeOptions.map((opt) => (
          <button
            key={opt.value}
            style={pillStyle(theme === opt.value)}
            onClick={() => setTheme(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Text Size section */}
      <div style={sectionLabelStyle}>Text Size</div>
      <div style={pillRowStyle}>
        {fontSizeOptions.map((opt) => (
          <button
            key={opt.value}
            style={pillStyle(fontSize === opt.value)}
            onClick={() => setFontSize(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div
        style={{
          marginTop: '28px',
          padding: '16px',
          borderRadius: 'var(--hs-border-radius)',
          background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--hs-font-size-small)',
            fontWeight: 600,
            color: 'var(--tg-theme-hint-color, #999)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Preview
        </div>
        <div
          style={{
            fontSize: 'var(--hs-font-size-heading)',
            fontWeight: 600,
            color: 'var(--tg-theme-text-color, #000)',
            marginBottom: '4px',
          }}
        >
          Heading Text
        </div>
        <div
          style={{
            fontSize: 'var(--hs-font-size-body)',
            color: 'var(--tg-theme-text-color, #000)',
            lineHeight: 1.5,
          }}
        >
          This is body text at your current size. Adjust the settings above and see the changes here instantly.
        </div>
        <div
          style={{
            fontSize: 'var(--hs-font-size-small)',
            color: 'var(--tg-theme-hint-color, #999)',
            marginTop: '6px',
          }}
        >
          This is small hint text.
        </div>
      </div>
    </div>
  );
}
