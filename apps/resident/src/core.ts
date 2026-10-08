import * as SecureStore from 'expo-secure-store';
import {
  ApiClient,
  AuthService,
  SecureTokenStore,
  createResourceClients,
  expoSecureStorage,
  resolveConfigFromEnv,
  type AppConfig,
  type LoginResponse,
  type ResourceClients,
} from '@communityos/shared';

/**
 * Resident/Owner app composition root: resolve config from env, build the secure token store on
 * top of expo-secure-store (Keychain/Keystore), and wire the envelope-aware API client + auth
 * service + the Phase 2 resource clients. This is the single place the app assembles the shared
 * core; screens consume `core`.
 *
 * ponytail: push-notification device registration (OneSignal) is intentionally NOT wired in this
 * build — it needs a real OneSignal app id + the native plugin, which pulls in the Expo dev-client
 * launcher. The user-facing app ships without it; `onAuthenticated` is a safe no-op. Re-add behind
 * a real OneSignal app id when push is needed.
 */
export interface AppCore {
  readonly config: AppConfig;
  readonly tokenStore: SecureTokenStore;
  readonly api: ApiClient;
  readonly auth: AuthService;
  readonly resources: ResourceClients;
  readonly onAuthenticated: (login: LoginResponse) => Promise<void>;
}

export function createAppCore(): AppCore {
  const config = resolveConfigFromEnv();
  const tokenStore = new SecureTokenStore(expoSecureStorage(SecureStore));
  const api = new ApiClient({ config, tokenStore });
  const auth = new AuthService(api, tokenStore);
  const resources = createResourceClients(api);

  const onAuthenticated = async (): Promise<void> => {
    // No-op in this build (push not wired). Kept so the AuthProvider contract is satisfied.
  };

  return { config, tokenStore, api, auth, resources, onAuthenticated };
}
