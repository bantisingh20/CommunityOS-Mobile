import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../ui/Screen';
import { AppTextField } from '../ui/AppTextField';
import { AppButton } from '../ui/AppButton';
import { FormBanner } from '../ui/FormBanner';
import { LinkButton } from '../ui/LinkButton';
import { theme } from '../ui/theme';
import { toFormError, type FormErrorView } from '../api/formError';
import type { AuthService } from '../auth/authService';

export interface ForgotPasswordScreenProps {
  auth: AuthService;
  /** Go to the reset screen, pre-filling the identifier the user just entered. */
  onCodeRequested: (identifier: string) => void;
  /** Go back to the login screen. */
  onBackToLogin: () => void;
}

const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };

/**
 * Forgot-password screen (Req 2.1). Submits the identifier to request an OTP, then shows a NEUTRAL
 * "if registered, a code was sent" message — the UI never reveals whether the account exists
 * (security first), regardless of the backend response. From here the user proceeds to enter the
 * code on the reset screen. Accessible shared primitives throughout (Req 65.6).
 */
export function ForgotPasswordScreen({
  auth,
  onCodeRequested,
  onBackToLogin,
}: ForgotPasswordScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormErrorView>(NO_ERROR);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(NO_ERROR);
    try {
      await auth.forgotPassword({ identifier: identifier.trim() });
      // Neutral regardless of outcome — don't leak account existence.
      setSent(true);
    } catch (err) {
      const view = toFormError(err);
      // Keep field-level validation (e.g. "identifier is required") but suppress a server message
      // that could hint at existence; for anything non-field we still show the neutral notice.
      if (Object.keys(view.fieldErrors).length > 0) {
        setError(view);
      } else {
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen accessibilityLabel="Forgot password">
      <Text style={styles.title} accessibilityRole="header">
        Forgot password
      </Text>
      <Text style={styles.subtitle}>
        Enter your email or phone and we&apos;ll send a one-time code if it&apos;s registered.
      </Text>

      <FormBanner message={error.message} tone="error" testID="forgot-error" />
      {sent ? (
        <FormBanner
          message="If that account is registered, a code has been sent."
          tone="success"
          testID="forgot-sent"
        />
      ) : null}

      <AppTextField
        label="Email or phone"
        value={identifier}
        onChangeText={setIdentifier}
        error={error.fieldErrors.identifier}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
        editable={!submitting}
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="forgot-identifier"
      />

      <AppButton
        title="Send code"
        onPress={submit}
        loading={submitting}
        accessibilityHint="Requests a one-time reset code"
        testID="forgot-submit"
      />
      {sent ? (
        <AppButton
          title="Enter code"
          variant="secondary"
          onPress={() => onCodeRequested(identifier.trim())}
          accessibilityHint="Opens the reset screen to enter your code and new password"
          testID="forgot-continue"
        />
      ) : null}
      <LinkButton
        title="Back to login"
        onPress={onBackToLogin}
        disabled={submitting}
        accessibilityHint="Returns to the sign in screen"
        testID="forgot-back"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: theme.fontSize.title, fontWeight: '700', color: theme.color.text },
  subtitle: { fontSize: theme.fontSize.body, color: theme.color.mutedText },
});
