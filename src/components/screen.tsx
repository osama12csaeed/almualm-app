import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { ChevronRight, Search } from 'lucide-react-native';
import { IconButton, OfflineBanner, Text } from './ui';
import { BottomNav } from './BottomNav';
import { space, useTheme } from '@/theme/theme';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        setOnline(s.isConnected !== false && s.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}

export function Screen({
  title,
  back,
  actions,
  search,
  children,
  edges = ['top'],
  nav,
}: {
  title?: string;
  back?: boolean;
  actions?: React.ReactNode;
  search?: boolean;
  children: React.ReactNode;
  edges?: ('top' | 'bottom')[];
  /** Bottom bar; on by default for inner screens (not the full-screen reader). */
  nav?: boolean;
}) {
  const { c } = useTheme();
  const showNav = nav ?? (Boolean(back) && !edges.includes('bottom'));
  const online = useOnline();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges}>
      {title !== undefined ? (
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          {back ? (
            <IconButton label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              {/* In RTL "back" points right. */}
              <ChevronRight color={c.text} size={26} />
            </IconButton>
          ) : (
            <View style={{ width: space[2] }} />
          )}
          <Text size="lg" weight="bold" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          {actions}
          {search ? (
            <IconButton label="بحث" onPress={() => router.push('/search')}>
              <Search color={c.text} size={22} />
            </IconButton>
          ) : null}
        </View>
      ) : null}
      {!online ? <OfflineBanner /> : null}
      <View style={{ flex: 1 }}>{children}</View>
      {showNav ? <BottomNav /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space[1], borderBottomWidth: StyleSheet.hairlineWidth, gap: space[1] },
});
