import React, { useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { FormBanner } from '../ui/FormBanner';
import type { AuthService } from '../auth/authService';

export interface AuthNavigatorProps {
  /** App name shown in headers, e.g. "Resident" / "Guard". */
  appTitle: string;
  /** The shared auth service (forgot/reset are called directly; login goes through the context). */
  auth: AuthService;
}

/** Which anonymous auth screen is showing. */
type AuthRoute = 'login' | 'forgot' | 'reset';

/**
 * Minimal state-based navigator for the pre-auth flow (login ↔ forgot ↔ reset). We deliberately
 * avoid a navigation library here (ponytail: keep it simple) — the flow is three screens with no
 * deep-linking or back-stack needs, so a single `useState` route switch is the smallest correct
 * thing. The authenticated app lives behind {@link AuthGate}; this component only renders while
 * unauthenticated. A one-time success banner (e.g. after a reset) is surfaced on the login screen.
 */
export function AuthNavigator({ appTitle, auth }: AuthNavigatorProps) {
  const [route, setRoute] = useState<AuthRoute>('login');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [loginNotice, setLoginNotice] = useState('');

  const goLogin = (notice = '') => {
    setLoginNotice(notice);
    setRoute('login');
  };

  switch (route) {
    case 'forgot':
      return (
        <ForgotPasswordScreen
          auth={auth}
          onCodeRequested={(identifier) => {
            setResetIdentifier(identifier);
            setRoute('reset');
          }}
          onBackToLogin={() => goLogin()}
        />
      );
    case 'reset':
      return (
        <ResetPasswordScreen
          auth={auth}
          initialIdentifier={resetIdentifier}
          onResetComplete={(message) => goLogin(message)}
          onBackToLogin={() => goLogin()}
        />
      );
    case 'login':
    default:
      return (
        <LoginScreen
          appTitle={appTitle}
          onForgotPassword={() => {
            setLoginNotice('');
            setRoute('forgot');
          }}
          // The login screen owns its own error banner; the success notice (e.g. post-reset) is
          // rendered above it via a small wrapper so the two don't collide.
          {...(loginNotice
            ? { headerSlot: <FormBanner message={loginNotice} tone="success" testID="login-notice" /> }
            : {})}
        />
      );
  }
}
