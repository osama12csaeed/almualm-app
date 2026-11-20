import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from 'react-native-google-mobile-ads';
import type { AppConfig } from '@/api/types';
import { useConfigValue } from '@/api/hooks';
import { actions, getState } from '@/store/store';
import { nextInterstitial } from '@/lib/core';

/**
 * AdMob, driven by wp-admin → تطبيق المعلم → الإعلانات.
 * In development builds Google's test units are used so you never click your own ads.
 */

type Placement = 'banner_home' | 'banner_list' | 'banner_search' | 'banner_reader';

let initialised = false;
let lastConfigKey = '';

export async function initAds(ads: AppConfig['ads']) {
  if (!ads.enabled) return;
  // The app carries primary-school material, so Google Play's Families policy applies to every
  // user: child-directed, G-rated, non-personalised ads only, whatever the plugin says
  // (the advertising ID permission is also removed in app.config.ts).
  const key = 'families';
  if (initialised && key === lastConfigKey) return;
  lastConfigKey = key;
  await mobileAds().setRequestConfiguration({
    maxAdContentRating: MaxAdContentRating.G,
    tagForChildDirectedTreatment: true,
    tagForUnderAgeOfConsent: true,
  });
  if (!initialised) {
    await mobileAds().initialize();
    initialised = true;
  }
}

function unitFor(ads: AppConfig['ads'], placement: Placement): string {
  const id = ads.units[placement];
  if (!id) return '';
  return __DEV__ ? TestIds.BANNER : id;
}

/** A banner that takes no space at all until an ad has actually loaded. */
export function AdBanner({ placement }: { placement: Placement }) {
  const config = useConfigValue();
  const [failed, setFailed] = useState(false);
  const ads = config?.ads;
  if (!ads?.enabled || failed) return null;
  const unitId = unitFor(ads, placement);
  if (!unitId) return null;
  return (
    <View style={{ alignItems: 'center', width: '100%' }} accessibilityLabel="إعلان">
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

/**
 * Preloads one interstitial and shows it when a file is opened, within the
 * frequency cap from wp-admin (every N opens, at least M seconds apart).
 */
export function useInterstitialOnOpen() {
  const config = useConfigValue();
  const adRef = useRef<InterstitialAd | null>(null);
  const loaded = useRef(false);
  const ads = config?.ads;
  const unit = ads?.enabled && ads.units.interstitial ? (__DEV__ ? TestIds.INTERSTITIAL : ads.units.interstitial) : '';

  useEffect(() => {
    if (!unit || !ads) return;
    const ad = InterstitialAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true });
    adRef.current = ad;
    loaded.current = false;
    const subs = [
      ad.addAdEventListener(AdEventType.LOADED, () => (loaded.current = true)),
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        loaded.current = false;
        ad.load();
      }),
      ad.addAdEventListener(AdEventType.ERROR, () => (loaded.current = false)),
    ];
    ad.load();
    return () => subs.forEach((s) => s());
  }, [unit, ads]);

  /** Call when a file is opened. Returns true if an ad was shown. */
  return function onFileOpened(): boolean {
    if (!ads?.enabled || !unit) return false;
    const r = nextInterstitial(getState().ads, Date.now(), ads.interstitial_every, ads.interstitial_seconds);
    if (r.show && loaded.current && adRef.current) {
      actions.setAds(r.state);
      adRef.current.show().catch(() => {});
      return true;
    }
    // Not shown: either the cap says no (count this open) or the ad wasn't ready (try again next open).
    const prev = getState().ads;
    actions.setAds(r.show ? { opensSinceLast: prev.opensSinceLast + 1, lastShownAt: prev.lastShownAt } : r.state);
    return false;
  };
}
