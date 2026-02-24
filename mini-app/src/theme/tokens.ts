export const colors = {
  accent: '#5B8C5A',
  accentLight: '#7DB87C',
  accentDark: '#3D6B3C',
  accentSubtle: 'rgba(91, 140, 90, 0.12)',
} as const;

export const fontSizePresets = {
  small: { body: '15px', heading: '19px', small: '12px' },
  medium: { body: '17px', heading: '22px', small: '14px' },
  large: { body: '19px', heading: '25px', small: '16px' },
} as const;

export type FontSize = keyof typeof fontSizePresets;
export type Theme = 'light' | 'dark';
