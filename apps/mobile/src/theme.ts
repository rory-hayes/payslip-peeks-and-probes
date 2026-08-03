export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  navy: '#17155D',
  ink: '#16154D',
  muted: '#64658D',
  lavender: '#EEEAFE',
  lavenderLine: '#E5E0FA',
  violet: '#704BFF',
  aqua: '#3CC7DE',
  aquaSoft: '#DDF8FC',
  // These action/status colours retain the Option 1 palette while meeting
  // readable text contrast on the white and soft-colour surfaces we use.
  orange: '#C63F09',
  orangePressed: '#A93205',
  green: '#087A4B',
  greenSoft: '#DCF9EC',
  coral: '#C4342C',
  coralSoft: '#FFF0EA',
  placeholder: '#5A5A84',
  white: '#FFFFFF',
  shadow: 'rgba(23, 21, 93, 0.12)',
} as const;

export const radius = {
  small: 14,
  medium: 22,
  large: 30,
  pill: 999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
} as const;
