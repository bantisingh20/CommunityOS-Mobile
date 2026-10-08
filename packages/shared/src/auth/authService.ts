import type { ApiClient } from '../api/client';
import type { SecureTokenStore } from './tokenStore';
import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
} from '../models/auth';

/**
 * Thin auth facade over the API client + token store, wired to `/api/v1/auth/*` (Req 1, 2).
 * Login stores the token in the secure store; logout revokes server-side and clears local state.
 * Pre-auth calls (login/forgot/reset) are made anonymous (no bearer). Tokens are never logged.
 */
export class AuthService {
  constructor(
    private readonly api: ApiClient,
    private readonly tokenStore: SecureTokenStore,
  ) {}

  async login(request: LoginRequest): Promise<LoginResponse> {
    const login = await this.api.post<LoginResponse>('/api/v1/auth/login', {
      body: request,
      anonymous: true,
    });
    await this.tokenStore.setFromLogin(login);
    return login;
  }

  async logout(): Promise<void> {
    try {
      // Authenticated call; the server derives the session from the bearer token's jti.
      await this.api.post<{ loggedOut: boolean }>('/api/v1/auth/logout');
    } finally {
      // Always clear locally even if the network call fails — the user intends to be logged out.
      await this.tokenStore.clear();
    }
  }

  forgotPassword(request: ForgotPasswordRequest): Promise<{ message: string }> {
    return this.api.post<{ message: string }>('/api/v1/auth/password/forgot', {
      body: request,
      anonymous: true,
    });
  }

  resetPassword(request: ResetPasswordRequest): Promise<{ passwordReset: boolean }> {
    return this.api.post<{ passwordReset: boolean }>('/api/v1/auth/password/reset', {
      body: request,
      anonymous: true,
    });
  }
}
