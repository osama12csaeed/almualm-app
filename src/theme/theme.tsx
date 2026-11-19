import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { contrast, ensureReadableBadge, textOn } from '@/lib/core';

/** Values from replica/design/tokens.json (checked for WCAG AA). */
const light = {
  bg: '#ffffff',
  surface: '#f4f6fb',
  card: '#ffffff',
  border: '#e2e7f0',
  borderInput: '#7b8597',
  text: '#0f172a',
  textMuted: '#526077',
  accent: '#035dcd', // almualm.com brand blue
  onAccent: '#ffffff',
  highlight: '#f87829', // the site's orange
  onHighlight: '#1f1300',
  danger: '#b42318',
  success: '#157347',
  skeleton: '#e8edf5',
  overlay: 'rgba(15,23,42,0.45)',
};

const dark: typeof light = {
  bg: '#0b1220',
  surface: '#131c2e',
  card: '#131c2e',
  border: '#26324a',
  borderInput: '#6b7890',
  text: '#e8edf7',
  textMuted: '#a3afc4',
  accent: '#7aa2ff',
  onAccent: '#0b1220',
  highlight: '#fbbf24',
  onHighlight: '#1f1300',
  danger: '#ff8a80',
  success: '#5fd39a',
  skeleton: '#1c2740',
  overlay: 'rgba(0,0,0,0.6)',
};

export const BADGE_COLORS: Record<string, string> = {
  // Same as the website's badges (darkened automatically where white text needs it).
  كتاب: '#4a83fa',
  اوراق: '#f87829',
  اختبار: '#abb8d4',
  مراجعة: '#a0a0a0',
  حل: '#15803d',
  ملخص: '#0e7490',
  تحضير: '#a16207',
  توزيع: '#be185d',
  ملف: '#475569',
};

export const space = [0, 4, 8, 12, 16, 24, 32, 48] as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const font = { regular: 'Cairo_400Regular', medium: 'Cairo_600SemiBold', bold: 'Cairo_700Bold' } as const;
export const type = {
  xs: { fontSize: 12, lineHeight: 18 },
  sm: { fontSize: 14, lineHeight: 22 },
  base: { fontSize: 16, lineHeight: 26 },
  lg: { fontSize: 19, lineHeight: 30 },
  xl: { fontSize: 24, lineHeight: 36 },
} as const;

export type Colors = typeof light;
export type Theme = { dark: boolean; c: Colors; badge: (name: string, siteColor?: string | null) => string };

const ThemeContext = createContext<Theme | null>(null);

/**
 * `primary`/`accent` come from wp-admin. They are only used if they stay readable;
 * otherwise the checked default is kept, so a colour change on the site can never
 * make the app unreadable.
 */
export function ThemeProvider({
  mode,
  primary,
  accent,
  children,
}: {
  mode: 'system' | 'light' | 'dark';
  primary?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const theme = useMemo<Theme>(() => {
    const base = isDark ? dark : light;
    const c = { ...base };
    if (!isDark && primary && contrast(primary, c.bg) >= 4.5) {
      c.accent = primary;
      c.onAccent = textOn(primary);
    }
    if (accent && contrast(accent, textOn(accent)) >= 4.5) {
      c.highlight = accent;
      c.onHighlight = textOn(accent);
    }
    return {
      dark: isDark,
      c,
      badge: (name, siteColor) => ensureReadableBadge(siteColor ?? BADGE_COLORS[name], BADGE_COLORS.ملف),
    };
  }, [isDark, primary, accent]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}
