import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { OneSignal } from 'react-native-onesignal';
import {
  ApiClient,
  AuthService,
  GateOfflineQueue,
  SecureTokenStore,
  createResourceClients,
  expoSecureStorage,
  registerDevice,
  resolveConfigFromEnv,
  type AppConfig,
  type LoginResponse,
  type ResourceClients,
} from '@communityos/shared';

/**
 * Guard app composition root: resolve config from env, build the secure token store on top of
 * expo-secure-store (Keychain/Keystore), and wire the envelope-aware API client + auth service +
 * the resource clients. This is the single place the app assembles the shared core; screens
 * consume `core`.
 */
export interface AppCore {
  readonly config: AppConfig;
  readonly tokenStore: SecureTokenStore;
  readonly api: ApiClient;
  readonly auth: AuthService;
  /** Typed resource clients (communities/units/residents/master-data/gate/security-ops). */
  readonly resources: ResourceClients;
  /**
   * Persisted offline queue for gate entry/exit captures (Task 17.1): buffers an exit when the gate
   * is offline and re-sends it with its idempotency key on reconnect. Guard-only.
   */
  readonly offlineQueue: GateOfflineQueue;
  /** Post-login side effect: register this device with OneSignal (Req 11.1). Failure-tolerant. */
  readonly onAuthenticated: (login: LoginResponse) => Promise<void>;
}

export function createAppCore(): AppCore {
  const config = resolveConfigFromEnv();
  const storage = expoSecureStorage(SecureStore);
  const tokenStore = new SecureTokenStore(storage);
  const api = new ApiClient({
    config,
    tokenStore,
    // 9.1 ships login/logout; a token-refresh endpoint arrives with later session work. Until
    // then a 401 clears the session and the AuthGate routes the user back to login.
  });
  const auth = new AuthService(api, tokenStore);
  const resources = createResourceClients(api);
  const offlineQueue = new GateOfflineQueue(storage, resources.gate);

  const onAuthenticated = async (): Promise<void> => {
    // Associate this device so the backend can target it. Errors are swallowed by the caller.
    await registerDevice({
      oneSignal: OneSignal,
      config,
      api,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appKind: 'guard',
    });
  };

  return { config, tokenStore, api, auth, resources, offlineQueue, onAuthenticated };
}
