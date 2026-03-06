import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useTheme } from '../theme/ThemeContext.js';
import type { Theme, FontSize } from '../theme/tokens.js';
import { apiFetch } from '../api.js';

// --- Types ---

type SettingsTab = 'app' | 'schedule' | 'memory';

interface MemoryItem {
  id: number;
  content: string;
}

interface MemoryCategory {
  name: string;
  memories: MemoryItem[];
}

interface AppSettings {
  timezone: string;
  morning_time: string;
  breakfast_time: string;
  lunch_time: string;
  snack_time: string;
  dinner_time: string;
  dessert_time: string;
  morning_enabled: boolean;
  prep_alerts_enabled: boolean;
  muted_until: number | null;
}

// --- Category display labels ---

const categoryLabels: Record<string, string> = {
  dietary: 'Dietary',
  taste: 'Taste',
  cooking_style: 'Cooking Style',
  household: 'Household',
  schedule: 'Schedule',
  logistics: 'Logistics',
  general: 'General',
};

// --- Appearance options ---

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const fontSizeOptions: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

// --- Time input fields config ---

const timeFields: Array<{ key: keyof Pick<AppSettings, 'breakfast_time' | 'lunch_time' | 'snack_time' | 'dinner_time' | 'dessert_time'>; label: string }> = [
  { key: 'breakfast_time', label: 'Breakfast' },
  { key: 'lunch_time', label: 'Lunch' },
  { key: 'snack_time', label: 'Snack' },
  { key: 'dinner_time', label: 'Dinner' },
  { key: 'dessert_time', label: 'Dessert' },
];

// --- Tab config ---

const tabs: { key: SettingsTab; label: string }[] = [
  { key: 'app', label: 'App' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'memory', label: 'Memory' },
];

export function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('app');

  // Memory state
  const [categories, setCategories] = useState<MemoryCategory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  // Settings state
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => { off(); };
  }, [navigate]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Fetch memories on mount
  useEffect(() => {
    apiFetch('/memories')
      .then((res) => res.json())
      .then((data: { categories: MemoryCategory[] }) => {
        if (isMountedRef.current) {
          setCategories(data.categories);
          setMemoriesLoading(false);
        }
      })
      .catch(() => {
        if (isMountedRef.current) setMemoriesLoading(false);
      });
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    apiFetch('/settings')
      .then((res) => res.json())
      .then((data: AppSettings) => {
        if (isMountedRef.current) {
          setSettings(data);
          setSettingsLoading(false);
        }
      })
      .catch(() => {
        if (isMountedRef.current) setSettingsLoading(false);
      });
  }, []);

  // Delete a memory (optimistic)
  const deleteMemory = useCallback((id: number) => {
    setCategories((prev) =>
      prev
        .map((cat) => ({
          ...cat,
          memories: cat.memories.filter((m) => m.id !== id),
        }))
        .filter((cat) => cat.memories.length > 0),
    );
    apiFetch(`/memories/${id}`, { method: 'DELETE' }).catch(() => {
      // Silently fail -- optimistic delete already applied
    });
  }, []);

  // Save a settings field with debounce
  const saveSettingsField = useCallback(
    (field: string, value: string | boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        apiFetch('/settings', {
          method: 'PUT',
          body: JSON.stringify({ [field]: value }),
        })
          .then(() => {
            if (isMountedRef.current) {
              setSavedMessage(true);
              setTimeout(() => {
                if (isMountedRef.current) setSavedMessage(false);
              }, 2000);
            }
          })
          .catch(() => {});
      }, 500);
    },
    [],
  );

  // Update a settings value locally and trigger save
  const updateSetting = useCallback(
    (field: string, value: string | boolean) => {
      setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
      saveSettingsField(field, value);
    },
    [saveSettingsField],
  );

  // --- Styles ---

  const subLabelStyle: React.CSSProperties = {
    fontSize: 'var(--hs-font-size-small)',
    color: 'var(--tg-theme-hint-color, #999)',
    marginBottom: '8px',
    marginTop: '16px',
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

  const cardStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 'var(--hs-border-radius)',
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    marginBottom: '12px',
  };

  const memoryItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--tg-theme-secondary-bg-color, #eee)',
    gap: '8px',
  };

  const deleteButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--tg-theme-hint-color, #999)',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: 'var(--hs-font-size-body)',
    lineHeight: 1,
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--tg-theme-hint-color, #ccc)',
    background: 'var(--tg-theme-bg-color, #fff)',
    color: 'var(--tg-theme-text-color, #000)',
    fontSize: 'var(--hs-font-size-body)',
    boxSizing: 'border-box',
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
  };

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: '48px',
    height: '28px',
    borderRadius: '14px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--hs-accent)' : 'var(--tg-theme-hint-color, #ccc)',
    position: 'relative',
    transition: 'background 0.2s',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  });

  const toggleKnobStyle = (active: boolean): React.CSSProperties => ({
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#ffffff',
    position: 'absolute',
    top: '3px',
    left: active ? '23px' : '3px',
    transition: 'left 0.2s',
  });

  function tabButtonStyle(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      padding: '10px 0',
      border: 'none',
      borderRadius: '8px',
      fontSize: 'var(--hs-font-size-small)',
      fontWeight: 600,
      cursor: 'pointer',
      textAlign: 'center',
      background: active ? 'var(--hs-accent)' : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
      color: active ? '#ffffff' : 'var(--tg-theme-text-color, #000)',
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

      {/* Top tabs */}
      <div style={{ display: 'flex', gap: '6px', paddingBottom: '12px', borderBottom: '1px solid var(--tg-theme-hint-color, #ccc)', marginBottom: '16px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={tabButtonStyle(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>

          {/* App tab */}
          {activeTab === 'app' && (
            <div>
              <div style={subLabelStyle}>Theme</div>
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

              <div style={subLabelStyle}>Text Size</div>
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
          )}

          {/* Schedule tab */}
          {activeTab === 'schedule' && (
            <div>
              {settingsLoading || !settings ? (
                <div style={{ color: 'var(--tg-theme-hint-color, #999)', fontSize: 'var(--hs-font-size-body)' }}>
                  Loading...
                </div>
              ) : (
                <div>
                  {/* Timezone (read-only) */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: 'var(--hs-font-size-small)', color: 'var(--tg-theme-hint-color, #999)', marginBottom: '4px' }}>
                      Timezone
                    </div>
                    <input
                      type="text"
                      value={settings.timezone}
                      readOnly
                      style={{ ...inputStyle, opacity: 0.7, cursor: 'default' }}
                    />
                  </div>

                  {/* Time inputs */}
                  {timeFields.map(({ key, label }) => (
                    <div key={key} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: 'var(--hs-font-size-small)', color: 'var(--tg-theme-hint-color, #999)', marginBottom: '4px' }}>
                        {label}
                      </div>
                      <input
                        type="time"
                        value={settings[key]}
                        onChange={(e) => updateSetting(key, e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  ))}

                  {/* Toggles */}
                  <div style={toggleRowStyle}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 'var(--hs-font-size-body)', color: 'var(--tg-theme-text-color, #000)' }}>
                        Morning summary
                      </span>
                      <div style={{ fontSize: 'var(--hs-font-size-small)', color: 'var(--tg-theme-hint-color, #999)', marginTop: '2px' }}>
                        A daily overview of your planned meals sent each morning
                      </div>
                    </div>
                    <button
                      style={toggleStyle(settings.morning_enabled)}
                      onClick={() => updateSetting('morning_enabled', !settings.morning_enabled)}
                      aria-label="Toggle morning summary"
                    >
                      <div style={toggleKnobStyle(settings.morning_enabled)} />
                    </button>
                  </div>

                  <div style={toggleRowStyle}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 'var(--hs-font-size-body)', color: 'var(--tg-theme-text-color, #000)' }}>
                        Prep alerts
                      </span>
                      <div style={{ fontSize: 'var(--hs-font-size-small)', color: 'var(--tg-theme-hint-color, #999)', marginTop: '2px' }}>
                        Reminders to start cooking based on your meal times
                      </div>
                    </div>
                    <button
                      style={toggleStyle(settings.prep_alerts_enabled)}
                      onClick={() => updateSetting('prep_alerts_enabled', !settings.prep_alerts_enabled)}
                      aria-label="Toggle prep alerts"
                    >
                      <div style={toggleKnobStyle(settings.prep_alerts_enabled)} />
                    </button>
                  </div>

                  {/* Saved confirmation */}
                  {savedMessage && (
                    <div
                      style={{
                        textAlign: 'center',
                        color: 'var(--hs-accent)',
                        fontSize: 'var(--hs-font-size-small)',
                        marginTop: '8px',
                        transition: 'opacity 0.3s',
                      }}
                    >
                      Saved
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memory tab */}
          {activeTab === 'memory' && (
            <div>
              {memoriesLoading ? (
                <div style={{ color: 'var(--tg-theme-hint-color, #999)', fontSize: 'var(--hs-font-size-body)' }}>
                  Loading...
                </div>
              ) : categories.length === 0 ? (
                <div style={{ color: 'var(--tg-theme-hint-color, #999)', fontSize: 'var(--hs-font-size-body)' }}>
                  No memories yet. Chat with Sous and your preferences will appear here.
                </div>
              ) : (
                categories.map((cat) => (
                  <div key={cat.name} style={cardStyle}>
                    <div
                      style={{
                        fontSize: 'var(--hs-font-size-small)',
                        fontWeight: 600,
                        color: 'var(--tg-theme-hint-color, #999)',
                        marginBottom: '4px',
                      }}
                    >
                      {categoryLabels[cat.name] ?? cat.name}
                    </div>
                    {cat.memories.map((mem, idx) => (
                      <div
                        key={mem.id}
                        style={{
                          ...memoryItemStyle,
                          borderBottom:
                            idx === cat.memories.length - 1
                              ? 'none'
                              : memoryItemStyle.borderBottom,
                        }}
                      >
                        <span style={{ fontSize: 'var(--hs-font-size-body)', color: 'var(--tg-theme-text-color, #000)' }}>
                          {mem.content}
                        </span>
                        <button
                          style={deleteButtonStyle}
                          onClick={() => deleteMemory(mem.id)}
                          aria-label="Delete memory"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

      </div>
    </div>
  );
}
