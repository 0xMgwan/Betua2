# GUAP Mobile App Build Guide

This guide covers building and deploying the GUAP app to Google Play Store and Apple App Store using Capacitor.

## Overview

GUAP uses Capacitor to wrap the web app (https://guap.gold) in a native mobile container. The app loads the live website, so updates to the website automatically reflect in the mobile app without requiring app updates.

## Prerequisites

### For Android (Play Store)
- Android Studio installed
- Java Development Kit (JDK) 17+
- Google Play Developer account ($25 one-time fee)

### For iOS (App Store)
- Mac computer with Xcode installed
- Apple Developer account ($99/year)
- Valid Apple Developer certificates

## Project Setup (Already Completed)

```bash
# Capacitor is already installed and configured
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Platforms already added
npx cap add android
npx cap add ios
```

## Configuration

**App ID:** `gold.guap.app`  
**App Name:** GUAP  
**Website URL:** https://guap.gold

## Building for Android (Play Store)

### 1. Open Android Project

```bash
npx cap open android
```

This opens Android Studio with the GUAP project.

### 2. Configure App Details

In Android Studio:
- Navigate to `app/src/main/res/values/strings.xml`
- Update app name if needed
- Navigate to `app/build.gradle`
- Update `versionCode` and `versionName` for each release

### 3. Generate Signing Key

First time only - create a keystore for signing your app:

```bash
keytool -genkey -v -keystore guap-release-key.keystore -alias guap -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT:** Store the keystore file and passwords securely. You'll need them for all future updates.

### 4. Configure Signing in Android Studio

1. In Android Studio, go to **Build > Generate Signed Bundle / APK**
2. Select **Android App Bundle** (for Play Store) or **APK** (for testing)
3. Create or select your keystore
4. Enter keystore password and key alias
5. Select **release** build variant
6. Click **Finish**

### 5. Build Release Bundle

```bash
cd android
./gradlew bundleRelease
```

The signed AAB file will be at:
`android/app/build/outputs/bundle/release/app-release.aab`

### 6. Upload to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app or select existing
3. Fill in store listing details:
   - **App name:** GUAP
   - **Short description:** Africa's first prediction market
   - **Full description:** Trade YES or NO on African events. Politics, sports, business. Powered by nTZS.
   - **Category:** Finance
   - **Screenshots:** Minimum 2 (phone), recommended 8
   - **Feature graphic:** 1024x500px
   - **App icon:** 512x512px (already at `public/icon-512.png`)

4. Upload the AAB file to **Production** or **Internal Testing**
5. Complete content rating questionnaire
6. Set pricing (Free)
7. Submit for review

**Review time:** 1-7 days

## Building for iOS (App Store)

### 1. Open iOS Project

```bash
npx cap open ios
```

This opens Xcode with the GUAP project.

### 2. Configure Signing & Capabilities

In Xcode:
1. Select the **App** target
2. Go to **Signing & Capabilities** tab
3. Select your **Team** (Apple Developer account)
4. Xcode will automatically manage signing

### 3. Update App Version

1. In Xcode, select the **App** target
2. Go to **General** tab
3. Update **Version** (e.g., 1.0.0) and **Build** number (e.g., 1)

### 4. Configure App Icons

Icons are already configured at:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Use `icon-512.png` and generate all required sizes using:
- [AppIcon.co](https://www.appicon.co/) - Upload icon-512.png
- Or use Xcode's built-in icon generator

### 5. Build for Release

1. In Xcode, select **Any iOS Device** as the build target
2. Go to **Product > Archive**
3. Wait for the archive to complete
4. Click **Distribute App**
5. Select **App Store Connect**
6. Follow the wizard to upload

### 6. Upload to App Store

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app or select existing
3. Fill in app information:
   - **Name:** GUAP
   - **Subtitle:** Predict the Future. Earn GUAP.
   - **Category:** Finance
   - **Screenshots:** Required for all device sizes
   - **Description:** Trade YES or NO on African events...
   - **Keywords:** prediction market, africa, trading, tzs, mobile money
   - **Support URL:** https://guap.gold
   - **Privacy Policy URL:** https://guap.gold/privacy (create this)

4. Select the uploaded build
5. Submit for review

**Review time:** 1-7 days (can be longer for first submission)

## App Store Assets Needed

### Screenshots
- **Android:** 
  - Phone: 1080x1920px (minimum 2, recommended 8)
  - Tablet: 1536x2048px (optional)
  
- **iOS:**
  - 6.7" (iPhone 14 Pro Max): 1290x2796px
  - 6.5" (iPhone 11 Pro Max): 1242x2688px
  - 5.5" (iPhone 8 Plus): 1242x2208px
  - iPad Pro: 2048x2732px

### Graphics
- **Feature Graphic (Android):** 1024x500px
- **App Icon:** 512x512px (already created)
- **Promotional images** (optional)

## Testing Before Release

### Android Testing

```bash
# Build debug APK
cd android
./gradlew assembleDebug

# Install on connected device
adb install app/build/outputs/apk/debug/app-debug.apk
```

### iOS Testing

1. In Xcode, select a connected device or simulator
2. Click **Run** (▶️) button
3. App will install and launch on the device

## Updating the App

Since the app loads https://guap.gold, most updates happen automatically. You only need to release a new app version when:

1. Changing app icon or branding
2. Adding new native features (camera, notifications, etc.)
3. Updating Capacitor or native dependencies
4. Fixing native bugs

### Update Process

1. Increment version numbers
2. Build new AAB/IPA
3. Upload to stores
4. Submit for review

## Important Files

- `capacitor.config.ts` - Capacitor configuration
- `android/app/build.gradle` - Android version and config
- `ios/App/App.xcodeproj` - iOS project
- `public/icon-512.png` - App icon source
- `public/manifest.json` - PWA manifest

## Troubleshooting

### Android Build Fails
- Ensure JDK 17+ is installed
- Clean build: `cd android && ./gradlew clean`
- Sync Capacitor: `npx cap sync android`

### iOS Build Fails
- Check signing certificates in Xcode
- Ensure Apple Developer account is active
- Clean build folder: **Product > Clean Build Folder**

### App Crashes on Launch
- Check `server.url` in `capacitor.config.ts`
- Verify https://guap.gold is accessible
- Check device logs in Android Studio or Xcode

## Privacy Policy & Terms

Before submitting to stores, create:
- **Privacy Policy:** https://guap.gold/privacy
- **Terms of Service:** https://guap.gold/terms (already created)

Both stores require these URLs.

## Support

For issues:
- Email: support@guap.gold
- Check Capacitor docs: https://capacitorjs.com/docs

## Next Steps

1. ✅ Capacitor installed and configured
2. ✅ Android and iOS platforms added
3. ⏳ Generate app screenshots
4. ⏳ Create feature graphic (1024x500)
5. ⏳ Build and test Android APK
6. ⏳ Build and test iOS app
7. ⏳ Create Play Store listing
8. ⏳ Create App Store listing
9. ⏳ Submit for review

**Estimated time to launch:** 1-2 weeks (including review time)
