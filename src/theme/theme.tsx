import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { contrast, ensureReadableBadge, textOn } from '@/lib/core';

/** Values from replica/design/tokens.json (checked for WCAG AA). */
/** Light theme = almualm.com's own CSS (measured from the live post page). */
const light = {
  bg: '#ffffff',
  surface: '#f9f9f9', // site boxes (download, follow, comments)
  card: '#ffffff',
  border: '#dddddd',
  borderSoft: '#dadada', // section title underline
  borderInput: '#767676',
  text: '#28303d',
  heading: '#2b76bf', // site h1 / section titles
  textMuted: '#5b6472',
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
  borderSoft: '#26324a',
  borderInput: '#6b7890',
  text: '#e8edf7',
  heading: '#8ab4ff',
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
// Almarai: the website's font.
export const font = { regular: 'Almarai_400Regular', medium: 'Almarai_700Bold', bold: 'Almarai_800ExtraBold' } as const;
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
