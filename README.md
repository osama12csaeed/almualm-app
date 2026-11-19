# تطبيق المعلم التعليمي (Android)

A native Android app that mirrors **almualm.com**. Every page and post you edit on the site reaches the app automatically. There is no second place to enter content.

```
WordPress (almualm.com) + plugin "Almualm App"  ──REST──▶  this app
   pages tree: المنهج ← الصف ← المادة                      Home → grade → subject → PDF reader
   posts with PDFs                                          offline copies, favourites, search
   wp-admin: look, ads, push, updates, maintenance          everything follows wp-admin
```

## 1. Install the WordPress plugin (5 minutes)

1. wp-admin → **Plugins → Add New → Upload Plugin** → `almualm-app.zip` → **Activate**.
2. **تطبيق المعلم → الإعدادات → المحتوى والمناهج**: choose the page **«المنهج السوداني»** in row 1, choose the category **«كتب السودان»** next to it, then save.
3. **تطبيق المعلم → صحة المحتوى** → press **«تحديث التطبيق الآن…»**. Every subject should show a file count with the method «من صفحة الموقع». A subject marked in orange has no files or used the fallback. Open it and pick its posts by hand in the «في التطبيق» box.

Adding Yemen, Saudi and the other curricula later takes one more row on the same screen. No app update is needed.

## 2. Get the APK

Every push to `main` builds an APK on GitHub: **Actions → Build Android APK → latest run → Artifacts → almualm-app-apk**. It is a zip with `app-release.apk` inside. To rebuild without changing code, use **Run workflow** on the same page.

Install it on a phone: send the APK to the phone, open it, and allow "install from this source".

## 3. Switch on ads (AdMob)

1. https://admob.google.com → **Apps → Add app** (Android, not yet on Play) → copy the **App ID** (`ca-app-pub-…~…`).
2. GitHub: **Settings → Secrets and variables → Actions → New secret**. Name `ADMOB_ANDROID_APP_ID`, value = the App ID. Then **Run workflow** to rebuild.
3. In AdMob, create the ad units (Banner ×3–4, Interstitial ×1). Paste their IDs in **wp-admin → تطبيق المعلم → الإعدادات → الإعلانات** and tick «تشغيل الإعلانات». This takes effect at once, with no new APK.

Until step 2 is done the app uses Google's test App ID. Never click your own live ads.

## 4. Switch on push notifications (Firebase)

1. https://console.firebase.google.com → new project → **Add app → Android**, package name **`com.almualm.app`** → download **google-services.json**.
2. GitHub secret `GOOGLE_SERVICES_JSON` = the whole content of that file → **Run workflow**.
3. Firebase → **Project settings → Service accounts → Generate new private key** → paste that JSON in **wp-admin → تطبيق المعلم → Firebase والإشعارات**.
4. Send one from **تطبيق المعلم → الإشعارات**, or tick «إشعار مستخدمي التطبيق» when publishing a post.

## 5. Publish on Google Play

- Google Play Console account ($25 once). Create the app with package **`com.almualm.app`**.
- Play needs an **AAB signed with your own upload key**, not the APK above, which is signed with a test key and meant for phones and testers. The easiest route is `npx eas-cli build -p android --profile production` with a free Expo account. EAS creates and keeps the signing key for you.
- Listing text, icon (512) and feature graphic are in `store/` and `replica/launch/listing.json`.
- Data safety: no accounts and no personal data. Declare AdMob (advertising ID) and Firebase (device token for notifications).
- Each new upload: raise `VERSION_CODE` in `app.config.ts`. To force old versions to update, raise «أقل إصدار مسموح» in wp-admin.

## Development

```bash
npm ci
npm test            # logic tests
npx tsc --noEmit    # typecheck
node scripts/contract.mjs https://www.almualm.com/wp-json/almualm-app/v1 ids.json   # API contract (needs test ids)
```

Built clean-room: no code, text, images or content from any other app. Icons: Lucide (ISC). Font: Cairo (OFL).
