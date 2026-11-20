import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bookmark, Download, House, Settings } from 'lucide-react-native';
import { Text } from './ui';
import { font, useTheme } from '@/theme/theme';

const ITEMS: { href: Href; label: string; Icon: typeof House }[] = [
  { href: '/', label: 'الرئيسية', Icon: House },
  { href: '/favorites', label: 'المفضلة', Icon: Bookmark },
  { href: '/downloads', label: 'ملفاتي', Icon: Download },
  { href: '/settings', label: 'الإعدادات', Icon: Settings },
];

/**
 * The app's bottom bar on the inner screens (sections, files, search…), so it never disappears.
 * Looks exactly like the tab bar; a tap goes back to the tabs and opens that tab.
 */
export function BottomNav({ active = 0 }: { active?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const go = (href: Href) => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate(href);
  };
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 4) }]}
    >
      {ITEMS.map(({ href, label, Icon }, i) => {
        const color = i === active ? c.accent : c.textMuted;
        return (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: i === active }}
            onPress={() => go(href)}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon color={color} size={24} />
            <Text style={{ color, fontSize: 12, fontFamily: font.medium }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52 },
});
