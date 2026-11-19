import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Text } from './ui';
import type { FileSummary } from '@/api/types';
import { BADGE_COLORS, useTheme } from '@/theme/theme';
import { ensureReadableBadge } from '@/lib/core';

/**
 * Components that copy almualm.com's own markup and CSS (values measured on the live site),
 * so the app's post and subject pages look like the website.
 */

/** Font Awesome 6, the icon font the website uses. */
export function Fa({ name, size = 16, color, brand, solid }: { name: string; size?: number; color: string; brand?: boolean; solid?: boolean }) {
  return <FontAwesome6 name={name} size={size} color={color} brand={brand} solid={solid ?? !brand} />;
}

/** h2.data-block-title: blue 18px title, grey underline, 58×2 brand-blue accent at the start. */
export function SiteHeading({ title, size = 18, style }: { title: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.headingWrap, { borderBottomColor: c.borderSoft }, style]}>
      <Text accessibilityRole="header" style={{ color: c.heading, fontSize: size, lineHeight: size * 1.5 }}>
        {title}
      </Text>
      <View style={[styles.headingAccent, { backgroundColor: c.accent }]} />
    </View>
  );
}

/** The site's grey box (.file-download-container / .sharer / .comment-body). */
export function SiteBox({ children, style, radius = 12 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const { c, dark } = useTheme();
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: c.surface, borderRadius: radius, borderColor: dark ? c.border : '#eeeeee', shadowOpacity: dark ? 0 : 0.08 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** a.data-post: rounded image with shadow, ribbon badge, centred 14px title. */
export function SiteCard({ file, width, onPress }: { file: Pick<FileSummary, 'id' | 'title' | 'badge' | 'badge_color' | 'thumb'>; width: number; onPress: () => void }) {
  const { c } = useTheme();
  const ribbon = ensureReadableBadge(file.badge_color ?? BADGE_COLORS[file.badge], BADGE_COLORS.ملف);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${file.badge}: ${file.title}`}
      onPress={onPress}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.cardImage, { borderColor: '#d7d7d7', backgroundColor: c.surface }]}>
        {file.thumb ? (
          <Image source={{ uri: file.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" cachePolicy="disk" transition={120} />
        ) : (
          <View style={styles.cardIcon}>
            <Fa name="file-pdf" size={34} color={c.textMuted} />
          </View>
        )}
        {file.badge ? (
          <View style={[styles.ribbon, { backgroundColor: ribbon }]}>
            <Text style={styles.ribbonText} numberOfLines={1}>
              {file.badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text center numberOfLines={3} style={[styles.cardTitle, { color: c.text }]}>
        {file.title}
      </Text>
    </Pressable>
  );
}

/** ul.data-post-list: two columns. */
export function SiteCardGrid({ files, width, onOpen }: { files: Pick<FileSummary, 'id' | 'title' | 'badge' | 'badge_color' | 'thumb'>[]; width: number; onOpen: (id: number) => void }) {
  const gap = 14;
  const cardW = (width - gap) / 2;
  return (
    <View style={[styles.grid, { gap, rowGap: 22 }]}>
      {files.map((f) => (
        <SiteCard key={f.id} file={f} width={cardW} onPress={() => onOpen(f.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headingWrap: { borderBottomWidth: StyleSheet.hairlineWidth * 1.5, paddingBottom: 10, alignSelf: 'stretch' },
  headingAccent: { position: 'absolute', bottom: -1, start: 0, width: 58, height: 2 },
  box: {
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    paddingVertical: 15,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: {
    height: 132,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
  },
  cardIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // .badges: border-radius 28px 50px 50px 0, 100×32, white 12px text.
  ribbon: {
    position: 'absolute',
    top: 16,
    start: 8,
    minWidth: 76,
    maxWidth: 110,
    height: 30,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 50,
    borderBottomRightRadius: 50,
    borderBottomLeftRadius: 0,
    opacity: 0.95,
  },
  ribbonText: { color: '#ffffff', fontSize: 12, lineHeight: 18 },
  cardTitle: { fontSize: 14, lineHeight: 20, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
