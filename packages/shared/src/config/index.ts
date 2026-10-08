/**
 * App configuration resolved from the environment â€” never hardcoded in source (steering).
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` into the bundle at build time, so each app reads its
 * own `.env`. The shared package stays env-agnostic: an app constructs an {@link AppConfig} (from
 * `resolveConfigFromEnv()` or its own source) and passes it into the API client / OneSignal setup.
 */
export interface AppConfig {
  /** Backend REST API base, e.g. `https://api.example.com`. HTTPS in production. */
  readonly apiBaseUrl: string;
  /** OneSignal public application id (not the server REST key). Optional in dev builds. */
  readonly oneSignalAppId?: string;
  /** Backend path that stores a device's OneSignal player/subscription id. */
  readonly deviceRegisterPath: string;
}

// Minimal ambient declaration so the shared package needn't depend on @types/node just to read
// `process.env.EXPO_PUBLIC_*`. Expo inlines these at build time in the apps.
declare const process: { env: Record<string, string | undefined> };

const DEFAULT_DEVICE_REGISTER_PATH = '/api/v1/devices';

/** Thrown when a required env var is missing, so misconfiguration fails loudly at startup. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Build an {@link AppConfig} from `EXPO_PUBLIC_*` env vars. Call this from an app's entry point.
 * Throws {@link ConfigError} if the API base URL or OneSignal app id is absent â€” we never fall
 * back to a baked-in URL or secret.
 */
export function resolveConfigFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AppConfig {
  const apiBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const oneSignalAppId = env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim();
  const deviceRegisterPath = env.EXPO_PUBLIC_DEVICE_REGISTER_PATH?.trim() || DEFAULT_DEVICE_REGISTER_PATH;

  if (!apiBaseUrl) {
    throw new ConfigError('EXPO_PUBLIC_API_BASE_URL is not set.');
  }
  return { apiBaseUrl, oneSignalAppId, deviceRegisterPath };
}

