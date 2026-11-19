import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  View,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { BookOpen, CloudOff, FileText, RefreshCw } from 'lucide-react-native';
import { font, radius, space, type, useTheme } from '@/theme/theme';
import { relativeDate, textOn } from '@/lib/core';
import type { FileSummary } from '@/api/types';

/* ---------------- Text ---------------- */

type TProps = TextProps & { size?: keyof typeof type; weight?: keyof typeof font; muted?: boolean; color?: string; center?: boolean };

export function Text({ size = 'base', weight = 'regular', muted, color, center, style, ...rest }: TProps) {
  const { c } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        type[size],
        { fontFamily: font[weight], color: color ?? (muted ? c.textMuted : c.text), textAlign: center ? 'center' : 'left', writingDirection: 'rtl' },
        style,
      ]}
    />
  );
}

/* ---------------- Buttons ---------------- */

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : variant === 'danger' ? textOn(c.danger) : c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderColor: variant === 'secondary' ? c.border : 'transparent' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text weight="medium" color={fg}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ label, onPress, children, ...rest }: { label: string; onPress?: () => void; children: React.ReactNode } & PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

/* ---------------- Badge ---------------- */

export function Badge({ name, color }: { name: string; color?: string | null }) {
  const t = useTheme();
  const bg = t.badge(name, color);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text size="xs" weight="medium" color={textOn(bg)}>
        {name}
      </Text>
    </View>
  );
}

/* ---------------- Cards ---------------- */

export function ImageCard({ title, image, subtitle, onPress, width }: { title: string; image: string | null; subtitle?: string; onPress: () => void; width: number }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.imageCard, { width, backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.imageWrap, { backgroundColor: c.surface }]}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} cachePolicy="disk" />
        ) : (
          <BookOpen color={c.accent} size={36} />
        )}
      </View>
      <View style={{ padding: space[2] }}>
        <Text size="sm" weight="medium" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" muted numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function FileRow({
  file,
  onPress,
  right,
  meta,
}: {
  file: Pick<FileSummary, 'id' | 'title' | 'badge' | 'badge_color' | 'thumb' | 'modified'> & Partial<Pick<FileSummary, 'nodes'>>;
  onPress: () => void;
  right?: React.ReactNode;
  meta?: string;
}) {
  const { c } = useTheme();
  const where = file.nodes?.[0]?.title;
  const line = meta ?? [where, relativeDate(file.modified)].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${file.badge}: ${file.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.fileRow, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.thumb, { backgroundColor: c.surface }]}>
        {file.thumb ? <Image source={{ uri: file.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" /> : <FileText color={c.textMuted} size={26} />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          <Badge name={file.badge} color={file.badge_color} />
        </View>
        <Text size="sm" weight="medium" numberOfLines={2}>
          {file.title}
        </Text>
        {line ? (
          <Text size="xs" muted numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/* ---------------- States ---------------- */

export function Skeleton({ height = 80, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height, borderRadius: radius.md, backgroundColor: c.skeleton }, style]} accessibilityLabel="جارٍ التحميل" />;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.state}>
      {icon}
      <Text size="lg" weight="bold" center>
        {title}
      </Text>
      {body ? (
        <Text muted center>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <EmptyState
      icon={<CloudOff color={c.textMuted} size={44} />}
      title="تعذّر التحميل"
      body={message}
      action={onRetry ? <Button title="إعادة المحاولة" variant="secondary" icon={<RefreshCw color={c.accent} size={18} />} onPress={onRetry} /> : undefined}
    />
  );
}

export function OfflineBanner() {
  const { c } = useTheme();
  return (
    <View style={[styles.offline, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityLiveRegion="polite">
      <CloudOff color={c.textMuted} size={16} />
      <Text size="xs" muted>
        أنت غير متصل. تعرض الآن آخر نسخة محفوظة.
      </Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text size="lg" weight="bold">
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: space[5],
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.pill },
  imageCard: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  imageWrap: { aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, borderWidth: 1 },
  thumb: { width: 64, height: 80, borderRadius: radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6], minHeight: 280 },
  offline: { flexDirection: 'row', gap: space[2], alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[2], borderBottomWidth: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[5], marginBottom: space[3] },
});
