export const colors = {
  accent: '#4A7FB5',
  accentLight: '#6BA3D6',
  accentDark: '#365F8C',
  accentSubtle: 'rgba(74, 127, 181, 0.12)',
} as const;

export const fontSizePresets = {
  small: { body: '15px', heading: '19px', small: '12px' },
  medium: { body: '17px', heading: '22px', small: '14px' },
  large: { body: '19px', heading: '25px', small: '16px' },
} as const;

export type FontSize = keyof typeof fontSizePresets;
export type Theme = 'light' | 'dark';
