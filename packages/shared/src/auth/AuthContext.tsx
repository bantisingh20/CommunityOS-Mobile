import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AuthService } from './authService';
import type { SecureTokenStore } from './tokenStore';
import type { LoginRequest, LoginResponse } from '../models/auth';

/**
 * Session lifecycle for the app shell (Req 1.1, 1.3). `restoring` is the launch state while we
 * decide whether a persisted session can be re-established; after that the app is either
 * `authenticated` (show the app) or `unauthenticated` (show the auth flow).
 */
export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

/** What `useAuth()` exposes to screens. */
export interface AuthContextValue {
  status: AuthStatus;
  /** Roles from the active session (empty when unauthenticated). */
  roles: readonly string[];
  /** The signed-in user's id (access-token `sub`), or null when unauthenticated. */
  userId: string | null;
  /** The signed-in identifier (email/phone) for display, or null when unauthenticated. */
  displayName: string | null;
  /** Log in, persist the session, run the post-login side effect (e.g. device registration). */
  login(request: LoginRequest): Promise<LoginResponse>;
  /** Log out: revoke server-side (best effort), clear local tokens, return to the auth flow. */
  logout(): Promise<void>;
}

/**
 * Side effect to run once right after a successful login — used by each app to register the device
 * with OneSignal (Req 11.1). Kept optional and failure-tolerant so a push-registration hiccup can
 * never block the user from entering the app.
 */
export type OnAuthenticated = (login: LoginResponse) => void | Promise<void>;

export interface AuthProviderProps {
  auth: AuthService;
  tokenStore: SecureTokenStore;
  /** Runs after a successful login (device registration etc.). Errors are swallowed + ignored. */
  onAuthenticated?: OnAuthenticated;
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the single source of truth for "am I signed in?" and drives the authenticated vs
 * unauthenticated switch. On mount it checks the secure store for a session token: with no token
 * (or no way to re-establish a session yet) it routes to login. The in-memory access token does
 * not survive a cold start, so today a cold launch always lands on login unless a session token
 * exists — which is the safe default (security first).
 */
export function AuthProvider({
  auth,
  tokenStore,
  onAuthenticated,
  children,
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [roles, setRoles] = useState<readonly string[]>(tokenStore.getRoles());
  const [userId, setUserId] = useState<string | null>(tokenStore.getUserId());
  const [displayName, setDisplayName] = useState<string | null>(tokenStore.getDisplayName());
  // Keep the latest side effect without making it a dependency of the restore effect.
  const onAuthenticatedRef = useRef<OnAuthenticated | undefined>(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

  useEffect(() => {
    let active = true;
    (async () => {
      // If the access token is already in memory (hot reload / fast refresh), stay signed in.
      if (tokenStore.isAuthenticated()) {
        if (active) {
          setRoles(tokenStore.getRoles());
          setUserId(tokenStore.getUserId());
          setDisplayName(tokenStore.getDisplayName());
          setStatus('authenticated');
        }
        return;
      }
      // Otherwise try to restore a persisted session from secure storage (survives a cold start or
      // a Metro reload). restore() loads a non-expired access token + roles + display name into
      // memory; an expired/absent one leaves us unauthenticated.
      const restored = await tokenStore.restore();
      if (!active) {
        return;
      }
      if (restored) {
        setRoles(tokenStore.getRoles());
        setUserId(tokenStore.getUserId());
        setDisplayName(tokenStore.getDisplayName());
        setStatus('authenticated');
        return;
      }
      setStatus('unauthenticated');
    })();
    return () => {
      active = false;
    };
  }, [tokenStore]);

  const login = useCallback(
    async (request: LoginRequest): Promise<LoginResponse> => {
      const result = await auth.login(request);
      tokenStore.setDisplayName(request.identifier);
      setRoles(tokenStore.getRoles());
      setUserId(tokenStore.getUserId());
      setDisplayName(tokenStore.getDisplayName());
      setStatus('authenticated');
      // Fire-and-forget: a device-registration failure must not block entry (Req 65.4 spirit).
      void Promise.resolve()
        .then(() => onAuthenticatedRef.current?.(result))
        .catch(() => undefined);
      return result;
    },
    [auth, tokenStore],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await auth.logout();
    } finally {
      // AuthService.logout already clears the store even if the network call fails.
      setRoles([]);
      setUserId(null);
      setDisplayName(null);
      setStatus('unauthenticated');
    }
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, roles, userId, displayName, login, logout }),
    [status, roles, userId, displayName, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an {@link AuthProvider}. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
