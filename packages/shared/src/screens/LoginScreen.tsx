import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppTextField } from '../ui/AppTextField';
import { PhoneField } from '../ui/PhoneField';
import { AppButton } from '../ui/AppButton';
import { FormBanner } from '../ui/FormBanner';
import { LinkButton } from '../ui/LinkButton';
import { theme } from '../ui/theme';
import { useSafeInsets } from '../ui/safeInsets';
import { toFormError, type FormErrorView } from '../api/formError';
import { useAuth } from '../auth/AuthContext';

export interface LoginScreenProps {
  /** App name shown in the header, e.g. "Resident" / "Guard". */
  appTitle: string;
  /** Navigate to the forgot-password screen. */
  onForgotPassword: () => void;
  /** Optional content rendered above the form (e.g. a one-time "password reset" success notice). */
  headerSlot?: React.ReactNode;
}

const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };

// ============================================================================================
// DEV ONLY — default login credentials, prefilled to speed up local testing.
// REMOVE this block (and the two useState initializers below that reference it) before production.
// ============================================================================================
const DEV_DEFAULT_IDENTIFIER = '+910000000000';
const DEV_DEFAULT_PASSWORD = '123';

// Online logo (per request: use an online logo). A neutral community/building glyph on a soft badge.
const LOGO_URI = 'https://cdn-icons-png.flaticon.com/512/619/619153.png';

/**
 * Login screen (Req 1.1, 1.2). Identifier + password → `AuthService.login` via the auth context,
 * which stores the token + roles and flips the app to authenticated. On failure the envelope's
 * safe message is shown in the banner (invalid credentials → the UNAUTHENTICATED message) and any
 * per-field `fieldErrors` under their inputs.
 *
 * UI: a branded header band with a circular logo badge over an elevated white card holding the
 * form, keyboard-avoiding and scrollable so it stays usable on small screens. Styled purely with
 * React Native `StyleSheet` + shared theme tokens (no CSS/Tailwind — those don't apply to native
 * views without extra tooling). All inputs/buttons are the accessible shared primitives (Req 65.6).
 */
export function LoginScreen({ appTitle, onForgotPassword, headerSlot }: LoginScreenProps) {
  const { login } = useAuth();
  // DEV ONLY: prefilled credentials for faster local testing. REMOVE before production.
  const [identifier, setIdentifier] = useState(DEV_DEFAULT_IDENTIFIER);
  const [password, setPassword] = useState(DEV_DEFAULT_PASSWORD);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormErrorView>(NO_ERROR);

  const submit = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(NO_ERROR);
    try {
      await login({ identifier: identifier.trim(), password, platform: Platform.OS });
      // On success the AuthProvider switches the shell to the authenticated app — nothing to do.
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const insets = useSafeInsets();
  return (
    <SafeAreaView style={styles.safe} accessibilityLabel={`${appTitle} sign in`}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: styles.scroll.padding + insets.top, paddingBottom: styles.scroll.padding + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branded header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Image
                source={{ uri: LOGO_URI }}
                style={styles.logo}
                resizeMode="contain"
                accessible={false}
              />
            </View>
            <Text style={styles.brand} accessibilityRole="header">
              CommunityOS
            </Text>
            <Text style={styles.brandSub}>{appTitle}</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to continue to your account</Text>

            {headerSlot}
            <FormBanner message={error.message} tone="error" testID="login-error" />

            <PhoneField
              label="Phone number"
              value={identifier}
              onChangeText={setIdentifier}
              {...(error.fieldErrors.identifier ? { error: error.fieldErrors.identifier } : {})}
              editable={!submitting}
              placeholder="Your phone number"
              testID="login-identifier"
            />
            <AppTextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={error.fieldErrors.password}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              editable={!submitting}
              returnKeyType="go"
              onSubmitEditing={submit}
              testID="login-password"
            />

            <View style={styles.forgotRow}>
              <LinkButton
                title="Forgot password?"
                onPress={onForgotPassword}
                disabled={submitting}
                accessibilityHint="Opens the password reset screen"
                testID="login-forgot"
              />
            </View>

            <AppButton
              title="Sign in"
              onPress={submit}
              loading={submitting}
              accessibilityHint="Signs in with your email or phone and password"
              testID="login-submit"
            />
          </View>

          <Text style={styles.footer}>Secure community management</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  header: { alignItems: 'center', gap: theme.spacing.sm },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  logo: { width: 56, height: 56, tintColor: theme.color.primary },
  brand: { fontSize: theme.fontSize.display, fontWeight: '800', color: theme.color.text, letterSpacing: 0.3 },
  brandSub: {
    fontSize: theme.fontSize.label,
    color: theme.color.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadow.card,
  },
  cardTitle: { fontSize: theme.fontSize.title, fontWeight: '700', color: theme.color.text },
  cardSubtitle: { fontSize: theme.fontSize.body, color: theme.color.mutedText, marginBottom: theme.spacing.sm },
  forgotRow: { alignItems: 'flex-end', marginTop: -theme.spacing.xs, marginBottom: theme.spacing.xs },
  footer: { textAlign: 'center', color: theme.color.mutedText, fontSize: theme.fontSize.label },
});
