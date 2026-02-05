import { PATTERN_NAMES, type PatternName } from './patterns';

export const COLORS = {
  hotPink: '#FF1493',
  tomato: '#FF4136',
  lemon: '#FFDC00',
  lavender: '#B388FF',
  mint: '#00D9A5',
  sky: '#00BFFF',
  cream: '#FFF8E7',
  ink: '#1A1A1A',
  white: '#FFFFFF',
  coral: '#FF6B6B',
  peach: '#FFAB91',
  violet: '#7C4DFF',
  lime: '#C6FF00',
  tangerine: '#FF9800',
} as const;

export type ColorName = keyof typeof COLORS;

export interface Palette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export const PALETTES: Palette[] = [
  {
    name: 'hotshot',
    primary: COLORS.hotPink,
    secondary: COLORS.lemon,
    accent: COLORS.ink,
    background: COLORS.cream,
    text: COLORS.ink,
  },
  {
    name: 'citrus',
    primary: COLORS.tangerine,
    secondary: COLORS.lemon,
    accent: COLORS.tomato,
    background: COLORS.cream,
    text: COLORS.ink,
  },
  {
    name: 'ocean',
    primary: COLORS.sky,
    secondary: COLORS.mint,
    accent: COLORS.lavender,
    background: COLORS.white,
    text: COLORS.ink,
  },
  {
    name: 'berry',
    primary: COLORS.violet,
    secondary: COLORS.hotPink,
    accent: COLORS.lavender,
    background: COLORS.cream,
    text: COLORS.ink,
  },
  {
    name: 'tropical',
    primary: COLORS.mint,
    secondary: COLORS.coral,
    accent: COLORS.lemon,
    background: COLORS.white,
    text: COLORS.ink,
  },
  {
    name: 'sunset',
    primary: COLORS.tomato,
    secondary: COLORS.peach,
    accent: COLORS.lemon,
    background: COLORS.cream,
    text: COLORS.ink,
  },
];

export const TYPE_SCALE = {
  hero: 'text-5xl md:text-6xl font-black tracking-tight',
  headline: 'text-3xl md:text-4xl font-bold tracking-tight',
  title: 'text-2xl font-bold',
  subtitle: 'text-xl font-semibold',
  body: 'text-base',
  caption: 'text-sm font-medium',
  label: 'text-xs font-bold uppercase tracking-wide',
} as const;

export function getPaletteForProfile(profileId: number): Palette {
  const index = Math.abs(profileId) % PALETTES.length;
  return PALETTES[index];
}

export function getPatternForProfile(profileId: number): PatternName {
  const index = Math.abs(profileId * 7) % PATTERN_NAMES.length;
  return PATTERN_NAMES[index];
}

let sessionAccentIndex: number | null = null;

export function getSessionPalette(): Palette {
  if (sessionAccentIndex === null) {
    const rand = Math.random();
    if (rand < 0.4) {
      sessionAccentIndex = 0;
    } else {
      sessionAccentIndex = 1 + Math.floor(Math.random() * (PALETTES.length - 1));
    }
  }
  return PALETTES[sessionAccentIndex];
}

export interface ProfileTheme {
  palette: Palette;
  patternName: PatternName;
  cssVars: Record<string, string>;
}

export function getProfileTheme(profileId: number): ProfileTheme {
  const palette = getPaletteForProfile(profileId);
  const patternName = getPatternForProfile(profileId);
  
  return {
    palette,
    patternName,
    cssVars: {
      '--eg-primary': palette.primary,
      '--eg-secondary': palette.secondary,
      '--eg-accent': palette.accent,
      '--eg-background': palette.background,
      '--eg-text': palette.text,
    },
  };
}

export function applyThemeVars(element: HTMLElement | null, theme: ProfileTheme) {
  if (!element) return;
  Object.entries(theme.cssVars).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
}

/**
 * Calculate relative luminance of a color for WCAG contrast calculations
 * Returns a value between 0 (black) and 1 (white)
 */
export function getLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Determine if a background color is light or dark
 * Returns true if the color is considered "light" (should use dark text)
 */
export function isLightColor(hexColor: string): boolean {
  return getLuminance(hexColor) > 0.5;
}

/**
 * Get the appropriate contrast text color for a given background
 * Returns black for light backgrounds, white for dark backgrounds
 */
export function getContrastTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? COLORS.ink : COLORS.white;
}

export type { PatternName };
