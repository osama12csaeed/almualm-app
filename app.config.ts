import { existsSync } from 'fs';
import type { ExpoConfig } from 'expo/config';

/**
 * Build-time settings. Everything that can change without a new release
 * (colours, home sections, ads units, update prompts, maintenance) comes from
 * the WordPress plugin at runtime instead.
 */

// Your site. The app reads /wp-json/almualm-app/v1 from here.
const SITE_URL = process.env.ALMUALM_SITE_URL || 'https://www.almualm.com';

// AdMob *App ID* (not a unit ID). It is compiled into the APK, so it lives here.
// Google's sample ID is used until you paste yours (AdMob → Apps → App settings).
const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';

// Push needs google-services.json from Firebase (Project settings → Your apps → Android).
const hasFirebase = existsSync('./google-services.json');

const VERSION = '1.0.0';
const VERSION_CODE = 2; // raise by 1 for every Play upload; matches "versionCode" in the plugin's update settings.

const config: ExpoConfig = {
  name: 'المعلم التعليمي',
  slug: 'almualm',
  scheme: 'almualm',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#ffffff',
  android: {
    package: 'com.almualm.app',
    versionCode: VERSION_CODE,
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#ffffff' },
    ],
    'expo-sharing',
    ['expo-localization', { supportsRTL: true, forcesRTL: true }],
    'expo-image',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: false,
          // Google Play: new apps and updates must target Android 16 (API 36); compileSdk stays at the SDK default.
          targetSdkVersion: 36,
          // SDK 58 turns on R8 by default; it stripped WorkManager's Room database (used by
          // Google Mobile Ads / Firebase) and the release app crashed on launch. Off for v1.
          enableMinifyInReleaseBuilds: false,
          enableShrinkResourcesInReleaseBuilds: false,
          // Kept for when minification is switched back on.
          extraProguardRules: [
            '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
            '-keep class androidx.work.** { *; }',
            '-keep class org.wonday.pdf.** { *; }',
            '-keep class com.github.barteksc.** { *; }',
            '-keep class io.legere.pdfiumandroid.** { *; }',
            '-keep class com.ReactNativeBlobUtil.** { *; }',
            '-keep class com.google.android.gms.ads.** { *; }',
          ].join('\n'),
        },
      },
    ],
    [
      'react-native-google-mobile-ads',
      { androidAppId: ADMOB_ANDROID_APP_ID, delayAppMeasurementInit: true },
    ],
    ...(hasFirebase ? ['@react-native-firebase/app', '@react-native-firebase/messaging'] : []),
  ],
  experiments: { typedRoutes: true },
  extra: {
    siteUrl: SITE_URL,
    apiBase: `${SITE_URL.replace(/\/$/, '')}/wp-json/almualm-app/v1`,
    pushEnabled: hasFirebase,
    versionCode: VERSION_CODE,
  },
};

export default config;
