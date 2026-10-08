import type { ExpoConfig } from 'expo/config';

/**
 * Security/Guard app config. iOS + Android. OneSignal via its config plugin (dev client / prebuild,
 * not Expo Go). The OneSignal app id is read from env at build time, never hardcoded here.
 */
const config: ExpoConfig = {
  name: 'CommunityOS Guard',
  slug: 'communityos-guard',
  scheme: 'communityos-guard',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.communityos.guard',
    supportsTablet: true,
  },
  android: {
    package: 'com.communityos.guard',
  },
  plugins: [
    'expo-secure-store',
    [
      'onesignal-expo-plugin',
      {
        mode: 'development',
      },
    ],
  ],
};

export default config;
