import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { PhoneField } from '@/components/ui/PhoneField';
import { FormBanner } from '@/components/ui/FormBanner';
import { theme } from '@/theme';
import { useSafeInsets } from '@/utils/safeInsets';
import { toFormError, type FormErrorView } from '@/utils/formError';
import type { ResourceClients } from '@/services/resources';

export interface RegisterSocietyScreenProps {
  resources: ResourceClients;
  onBack: () => void;
  onDone: (notice: string) => void;
  logo?: ImageSourcePropType;
}

type CommunityType = { value: string; label: string };

const COMMUNITY_TYPES: CommunityType[] = [
  { value: 'apartment_society', label: 'Apartment Society' },
  { value: 'gated_community', label: 'Gated Community' },
  { value: 'villa_bungalow', label: 'Villa / Bungalow Community' },
  { value: 'townhouse', label: 'Townhouse Development' },
  { value: 'mixed', label: 'Mixed Development' },
];

const NO_ERROR: FormErrorView = { message: '', fieldErrors: {} };

export function RegisterSocietyScreen({ resources, onBack, onDone, logo }: RegisterSocietyScreenProps) {
  const insets = useSafeInsets();

  const [organizationName, setOrganizationName] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [communityType, setCommunityType] = useState<string>('apartment_society');
  const [typeOpen, setTypeOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormErrorView>(NO_ERROR);

  const typeLabel = COMMUNITY_TYPES.find((c) => c.value === communityType)?.label ?? 'Select type';

  const validate = (): boolean => {
    const fieldErrors: Record<string, string> = {};
    if (!organizationName.trim()) fieldErrors.organizationName = 'Enter the organization name';
    if (!communityName.trim()) fieldErrors.communityName = 'Enter the society name';
    if (!adminName.trim()) fieldErrors.adminName = 'Enter the admin name';
    if (adminPassword.length < 6) fieldErrors.adminPassword = 'Min 6 characters';
    if (Object.keys(fieldErrors).length > 0) {
      setError({ message: '', fieldErrors });
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (busy) return;
    setError(NO_ERROR);
    if (!validate()) return;
    setBusy(true);
    try {
      const result = await resources.onboarding.registerSociety({
        organizationName: organizationName.trim(),
        communityName: communityName.trim(),
        communityType,
        adminName: adminName.trim(),
        adminPassword,
        ...(adminEmail.trim() ? { adminEmail: adminEmail.trim() } : {}),
        ...(adminPhone.trim() ? { adminPhone: adminPhone.trim() } : {}),
      });
      onDone(result.message);
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} accessibilityLabel="Register your society">
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.backRow, { paddingTop: insets.top + theme.spacing.xs }]}>
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to login" style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.color.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + theme.spacing.lg }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BrandLogo {...(logo ? { logo } : {})} size={76} nameSize={theme.fontSize.heading} taglineSize={theme.fontSize.caption} />
            <Text style={styles.title}>Register New Society</Text>
            <Text style={styles.subtitle}>Onboard your residential community. Our team reviews and activates it.</Text>

            <FormBanner message={error.message} tone="error" testID="society-error" />

            <Field label="Organization Name" error={error.fieldErrors.organizationName}>
              <InputRow icon="business-outline" error={!!error.fieldErrors.organizationName}>
                <TextInput
                  value={organizationName}
                  onChangeText={setOrganizationName}
                  placeholder="e.g. Sunrise Group"
                  placeholderTextColor={theme.color.mutedText}
                  editable={!busy}
                  style={styles.inputControl}
                  testID="society-org"
                />
              </InputRow>
            </Field>

            <Field label="Society / Community Name" error={error.fieldErrors.communityName}>
              <InputRow icon="home-outline" error={!!error.fieldErrors.communityName}>
                <TextInput
                  value={communityName}
                  onChangeText={setCommunityName}
                  placeholder="e.g. Green Valley"
                  placeholderTextColor={theme.color.mutedText}
                  editable={!busy}
                  style={styles.inputControl}
                  testID="society-name"
                />
              </InputRow>
            </Field>

            <Field label="Type">
              <Pressable
                onPress={() => setTypeOpen((v) => !v)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Community type: ${typeLabel}`}
                style={styles.inputRow}
              >
                <Ionicons name="grid-outline" size={20} color={theme.color.mutedText} style={styles.inputIcon} />
                <Text style={[styles.inputControl, styles.selectValue]}>{typeLabel}</Text>
                <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.color.mutedText} />
              </Pressable>
              {typeOpen ? (
                <View style={styles.dropdown}>
                  {COMMUNITY_TYPES.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => { setCommunityType(opt.value); setTypeOpen(false); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: opt.value === communityType }}
                      style={[styles.dropdownItem, opt.value === communityType ? styles.dropdownItemOn : null]}
                    >
                      <Text style={[styles.dropdownText, opt.value === communityType ? styles.dropdownTextOn : null]}>{opt.label}</Text>
                      {opt.value === communityType ? <Ionicons name="checkmark" size={18} color={theme.color.primary} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Field>

            <Field label="Admin Name" error={error.fieldErrors.adminName}>
              <InputRow icon="person-outline" error={!!error.fieldErrors.adminName}>
                <TextInput
                  value={adminName}
                  onChangeText={setAdminName}
                  placeholder="e.g. Asha Verma"
                  placeholderTextColor={theme.color.mutedText}
                  editable={!busy}
                  style={styles.inputControl}
                  testID="society-admin-name"
                />
              </InputRow>
            </Field>

            <Field label="Phone (used as admin login)" error={error.fieldErrors.adminPhone}>
              <PhoneField
                label=""
                value={adminPhone}
                onChangeText={setAdminPhone}
                {...(error.fieldErrors.adminPhone ? { error: error.fieldErrors.adminPhone } : {})}
                editable={!busy}
                placeholder="Enter phone number"
                testID="society-phone"
              />
            </Field>

            <Field label="Email (optional)" error={error.fieldErrors.adminEmail}>
              <InputRow icon="mail-outline" error={!!error.fieldErrors.adminEmail}>
                <TextInput
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholder="admin@example.com"
                  placeholderTextColor={theme.color.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!busy}
                  style={styles.inputControl}
                  testID="society-email"
                />
              </InputRow>
            </Field>

            <Field label="Admin Password" error={error.fieldErrors.adminPassword}>
              <InputRow icon="lock-closed-outline" error={!!error.fieldErrors.adminPassword}>
                <TextInput
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholder="Min 6 characters"
                  placeholderTextColor={theme.color.mutedText}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!busy}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={styles.inputControl}
                  testID="society-password"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.inputIconBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.color.mutedText} />
                </Pressable>
              </InputRow>
            </Field>

            <Pressable
              onPress={submit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Register society"
              accessibilityState={{ disabled: busy, busy }}
              testID="society-submit"
              style={({ pressed }) => [styles.primaryBtn, pressed && !busy ? styles.pressed : null, busy ? styles.primaryBtnDisabled : null]}
            >
              {busy ? (
                <ActivityIndicator color={theme.color.primaryText} />
              ) : (
                <>
                  <Text style={styles.primaryText}>Register Society</Text>
                  <View style={styles.primaryArrow}>
                    <Ionicons name="arrow-forward" size={18} color={theme.color.primaryText} />
                  </View>
                </>
              )}
            </Pressable>

            <View style={styles.secureRow}>
              <Ionicons name="shield-checkmark" size={16} color={theme.color.primary} />
              <Text style={styles.secureText}>After approval you can sign in to the admin portal with this phone and password.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error && error.trim() ? (
        <Text style={styles.fieldError} accessibilityRole="alert">{error}</Text>
      ) : null}
    </View>
  );
}

function InputRow({ icon, error, children }: { icon: keyof typeof Ionicons.glyphMap; error?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
      <Ionicons name={icon} size={20} color={theme.color.mutedText} style={styles.inputIcon} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  flex: { flex: 1 },

  backRow: { paddingHorizontal: theme.spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, alignItems: 'stretch', paddingTop: theme.spacing.sm },

  title: { fontSize: theme.fontSize.title, fontWeight: '800', color: theme.color.text, textAlign: 'center' },
  subtitle: { fontSize: theme.fontSize.label, color: theme.color.mutedText, textAlign: 'center', lineHeight: 20, marginBottom: theme.spacing.xs },

  field: { gap: theme.spacing.xs, alignSelf: 'stretch' },
  fieldLabel: { fontSize: theme.fontSize.label, color: theme.color.text, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: theme.minTouchTarget,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, backgroundColor: theme.color.surface,
  },
  inputRowError: { borderColor: theme.color.danger },
  inputIcon: { marginRight: theme.spacing.sm },
  inputControl: { flex: 1, fontSize: theme.fontSize.body, color: theme.color.text, paddingVertical: theme.spacing.sm },
  inputIconBtn: { paddingLeft: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' },
  selectValue: { paddingVertical: theme.spacing.sm },
  fieldError: { fontSize: theme.fontSize.label, color: theme.color.danger },

  dropdown: {
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface, overflow: 'hidden', ...theme.shadow.soft,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md },
  dropdownItemOn: { backgroundColor: theme.color.accentSoft },
  dropdownText: { fontSize: theme.fontSize.body, color: theme.color.text },
  dropdownTextOn: { color: theme.color.primary, fontWeight: '700' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch',
    minHeight: 54, borderRadius: theme.radius.lg, backgroundColor: theme.color.primary,
    paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.xs,
  },
  primaryBtnDisabled: { backgroundColor: theme.color.disabled },
  primaryText: { color: theme.color.primaryText, fontSize: theme.fontSize.body, fontWeight: '800' },
  primaryArrow: { position: 'absolute', right: theme.spacing.lg, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.xs, paddingHorizontal: theme.spacing.md },
  secureText: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, fontWeight: '600', flex: 1 },
});
