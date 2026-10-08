import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthGate, AuthProvider, HomeNavigator, ToastProvider } from '@communityos/shared';
import { createAppCore } from './src/core';
import type { AppCore } from './src/core';

/**
 * Security/Guard app shell. Builds the shared core once, wraps the app in the shared
 * {@link AuthProvider} (session state), and uses {@link AuthGate} to switch between the shared auth
 * flow (login/forgot/reset) and this app's authenticated home. Device registration (OneSignal)
 * runs via `onAuthenticated` after a successful login.
 */
export default function App() {
  const core = useMemo(() => createAppCore(), []);
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider
          auth={core.auth}
          tokenStore={core.tokenStore}
          onAuthenticated={core.onAuthenticated}
        >
          <StatusBar style="auto" />
          <AuthGate appTitle="Guard" auth={core.auth}>
            <GuardHome core={core} />
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

/**
 * The authenticated guard home: the shared {@link HomeNavigator} in guard mode. Its menu is the
 * Phase 3 gate workflow (verify pass, register walk-in, entry/exit, watchlist, SOS — Task 17.1) plus
 * the Phase 2 unit/resident lookup. The offline queue is passed through for offline-aware exit
 * capture. Full admin management lives in the resident/admin app.
 */
function GuardHome({ core }: { core: AppCore }) {
  return (
    <HomeNavigator
      resources={core.resources}
      app="guard"
      appTitle="Guard"
      offlineQueue={core.offlineQueue}
    />
  );
}
