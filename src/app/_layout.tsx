import React, { useEffect, useState } from 'react';
import { I18nManager, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Almarai_400Regular } from '@expo-google-fonts/almarai/400Regular';
import { Almarai_700Bold } from '@expo-google-fonts/almarai/700Bold';
import { Almarai_800ExtraBold } from '@expo-google-fonts/almarai/800ExtraBold';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Wrench, Download as DownloadIcon } from 'lucide-react-native';
import { queryClient, useConfig } from '@/api/hooks';
import { VERSION_CODE } from '@/api/client';
import { ThemeProvider, useTheme, space, radius } from '@/theme/theme';
import { Button, Text } from '@/components/ui';
import { actions, hydrate, useStore } from '@/store/store';
import { reconcile } from '@/store/pdfCache';
import { updateDecision } from '@/lib/core';
import { initAds } from '@/ads/ads';
import { openTarget, registerBackgroundHandler, setupPush } from '@/push/push';

registerBackgroundHandler();
SplashScreen.preventAutoHideAsync().catch(() => {});
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'almualm-query-cache' });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Almarai_400Regular, Almarai_700Bold, Almarai_800ExtraBold });
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    hydrate().then(reconcile);
  }, []);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: 30 * 24 * 60 * 60 * 1000, buster: 'v1' }}
        >
          <Shell />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const config = useConfig();
  const settings = useStore((s) => s.settings);
  const look = config.data?.look;
  const mode = settings.theme ?? look?.theme_default ?? 'system';

  useEffect(() => {
    // Show the app as soon as we have either fresh or cached config, or after a failed first fetch.
    if (config.data || config.isError) SplashScreen.hideAsync().catch(() => {});
  }, [config.data, config.isError]);

  // Pick the curriculum automatically when there is only one (Sudan first).
  const curricula = config.data?.home.curricula ?? [];
  useEffect(() => {
    if (!config.data) return;
    const ids = curricula.map((c) => c.id);
    if (settings.rootId && ids.includes(settings.rootId)) return;
    const fallback = config.data.home.default_root || ids[0];
    if (fallback && (ids.length === 1 || !settings.rootId)) actions.setSettings({ rootId: fallback });
  }, [config.data, curricula, settings.rootId]);

  useEffect(() => {
    if (config.data?.ads) initAds(config.data.ads).catch(() => {});
  }, [config.data?.ads]);

  return (
    <ThemeProvider mode={mode} primary={look?.color_primary} accent={look?.color_accent}>
      <Themed>
        <PushBridge wanted={settings.notifications} topics={config.data?.push.topics ?? ['all']} />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_left' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="file/[id]" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        {config.data ? <Gates config={config.data} /> : null}
      </Themed>
    </ThemeProvider>
  );
}

function Themed({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

/** Maintenance notice and update prompts, both controlled from wp-admin. */
function Gates({ config }: { config: NonNullable<ReturnType<typeof useConfig>['data']> }) {
  const { c } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const decision = updateDecision(VERSION_CODE, config.update.latest_code, config.update.min_code);
  const required = decision === 'required';
  const optional = decision === 'optional' && !dismissed;
  // Maintenance can be dismissed to reach saved files; it comes back on the next launch.
  const maintenance = config.maintenance.enabled && !dismissed;

  if (!maintenance && !required && !optional) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {
        if (!required && !maintenance) setDismissed(true);
      }}>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: c.bg }]} edges={['bottom']}>
          {maintenance ? <Wrench color={c.accent} size={40} /> : <DownloadIcon color={c.accent} size={40} />}
          <Text size="lg" weight="bold" center>
            {maintenance ? 'صيانة قصيرة' : required ? 'يلزم تحديث التطبيق' : 'يتوفر تحديث جديد'}
          </Text>
          <Text muted center>
            {maintenance ? config.maintenance.message : config.update.message}
          </Text>
          {maintenance ? (
            <Button
              title="فتح الملفات المحفوظة"
              variant="secondary"
              onPress={() => {
                setDismissed(true);
                router.navigate('/downloads');
              }}
            />
          ) : (
            <Button title="تحديث الآن" onPress={() => Linking.openURL(config.update.store_url).catch(() => {})} />
          )}
          {!required && !maintenance ? (
            <Pressable accessibilityRole="button" onPress={() => setDismissed(true)} style={{ padding: space[3] }}>
              <Text muted center>
                لاحقاً
              </Text>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Foreground notifications appear as a small banner instead of being lost. */
function PushBridge({ wanted, topics }: { wanted: boolean; topics: string[] }) {
  const { c } = useTheme();
  const [toast, setToast] = useState<{ title: string; body: string; data: Record<string, string> } | null>(null);
  const topicsKey = topics.join(',');

  useEffect(() => {
    let off: () => void = () => {};
    setupPush({ wanted, topics: topicsKey.split(','), onForeground: (title, body, data) => setToast({ title, body, data: data as Record<string, string> }) })
      .then((fn) => (off = fn))
      .catch(() => {});
    return () => off();
  }, [wanted, topicsKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <SafeAreaView edges={['top']} style={styles.toastWrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          openTarget(toast.data);
          setToast(null);
        }}
        style={[styles.toast, { backgroundColor: c.card, borderColor: c.border }]}
      >
        <Text weight="bold" numberOfLines={1}>
          {toast.title}
        </Text>
        <Text size="sm" muted numberOfLines={2}>
          {toast.body}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: space[5], gap: space[3], alignItems: 'stretch', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  toastWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space[3] },
  toast: { padding: space[3], borderRadius: radius.md, borderWidth: 1, elevation: 6 },
});
