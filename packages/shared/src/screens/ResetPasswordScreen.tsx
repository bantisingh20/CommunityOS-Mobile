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

export interface ResetPasswordScreenProps {
  auth: AuthService;
  /** Identifier carried over from the forgot screen (editable in case the user corrects it). */
  initialIdentifier?: string;
  /** Return to login after a successful reset — the host passes a success message to show there. */
  onResetComplete: (message: string) => void;
  /** Go back to the login screen without resetting. */
  onBackToLogin: () => void;
}

const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };
const SUCCESS_MESSAGE = 'Your password has been reset. Please sign in.';

/**
 * Reset-password screen (Req 2.3). Identifier + OTP code + new password → `AuthService.resetPassword`.
 * On success the host returns to login carrying a success message. On failure (expired/used OTP,
 * weak password) the envelope's safe message + per-field errors are shown. Accessible shared
 * primitives throughout (Req 65.6).
 */
export function ResetPasswordScreen({
  auth,
  initialIdentifier = '',
  onResetComplete,
  onBackToLogin,
}: ResetPasswordScreenProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormErrorView>(NO_ERROR);

  const submit = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(NO_ERROR);
    try {
      await auth.resetPassword({
        identifier: identifier.trim(),
        code: code.trim(),
        newPassword,
      });
      onResetComplete(SUCCESS_MESSAGE);
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen accessibilityLabel="Reset password">
      <Text style={styles.title} accessibilityRole="header">
        Reset password
      </Text>
      <Text style={styles.subtitle}>Enter the code we sent and choose a new password.</Text>

      <FormBanner message={error.message} tone="error" testID="reset-error" />

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
        returnKeyType="next"
        testID="reset-identifier"
      />
      <AppTextField
        label="One-time code"
        value={code}
        onChangeText={setCode}
        error={error.fieldErrors.code}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={!submitting}
        returnKeyType="next"
        testID="reset-code"
      />
      <AppTextField
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        error={error.fieldErrors.newPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password-new"
        textContentType="newPassword"
        editable={!submitting}
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="reset-new-password"
      />

      <AppButton
        title="Reset password"
        onPress={submit}
        loading={submitting}
        accessibilityHint="Sets your new password using the one-time code"
        testID="reset-submit"
      />
      <LinkButton
        title="Back to login"
        onPress={onBackToLogin}
        disabled={submitting}
        accessibilityHint="Returns to the sign in screen"
        testID="reset-back"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: theme.fontSize.title, fontWeight: '700', color: theme.color.text },
  subtitle: { fontSize: theme.fontSize.body, color: theme.color.mutedText },
});
