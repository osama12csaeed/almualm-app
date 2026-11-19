import Constants from 'expo-constants';
import { PermissionsAndroid, Platform } from 'react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

/**
 * Firebase Cloud Messaging. The plugin sends to the topic "all"; the app only
 * subscribes, so there is no device database to keep. Builds without
 * google-services.json simply skip push.
 */

const enabled = Boolean((Constants.expoConfig?.extra as { pushEnabled?: boolean } | undefined)?.pushEnabled);

type Data = { type?: string; id?: string; url?: string; notice_id?: string };

type MessagingModule = typeof import('@react-native-firebase/messaging');

function load(): MessagingModule | null {
  if (!enabled) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/messaging') as MessagingModule;
  } catch {
    return null;
  }
}

export function openTarget(data: Data | undefined) {
  if (!data) return;
  const id = Number(data.id);
  if (data.type === 'file' && id > 0) router.push({ pathname: '/file/[id]', params: { id: String(id) } });
  else if (data.type === 'node' && id > 0) router.push({ pathname: '/node/[id]', params: { id: String(id) } });
  else if (data.type === 'url' && data.url) Linking.openURL(data.url).catch(() => {});
  else router.push('/notices');
}

/** Registers the background handler. Must run at module load (see src/app/_layout.tsx). */
export function registerBackgroundHandler() {
  const m = load();
  if (!m) return;
  m.setBackgroundMessageHandler(m.getMessaging(), async () => {
    // The system tray shows notification messages by itself; nothing to do here.
  });
}

/**
 * Asks for permission (Android 13+), subscribes to topics, and wires taps.
 * Returns an unsubscribe function for foreground messages.
 */
export async function setupPush(opts: { wanted: boolean; topics: string[]; onForeground: (title: string, body: string, data: Data) => void }) {
  const m = load();
  if (!m) return () => {};
  const messaging = m.getMessaging();

  if (!opts.wanted) {
    for (const t of opts.topics) await m.unsubscribeFromTopic(messaging, t).catch(() => {});
    return () => {};
  }

  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (res !== PermissionsAndroid.RESULTS.GRANTED) return () => {};
  }
  await m.registerDeviceForRemoteMessages(messaging).catch(() => {});
  for (const t of opts.topics) await m.subscribeToTopic(messaging, t).catch(() => {});

  const initial = await m.getInitialNotification(messaging).catch(() => null);
  if (initial?.data) setTimeout(() => openTarget(initial.data as Data), 600);

  const offOpened = m.onNotificationOpenedApp(messaging, (msg) => openTarget(msg.data as Data));
  const offMessage = m.onMessage(messaging, (msg) => {
    opts.onForeground(msg.notification?.title ?? '', msg.notification?.body ?? '', (msg.data ?? {}) as Data);
  });
  return () => {
    offOpened();
    offMessage();
  };
}
