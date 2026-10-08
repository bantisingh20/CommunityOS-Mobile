import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { FormBanner } from '../../ui/FormBanner';
import { LinkButton } from '../../ui/LinkButton';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import type { ResourceClients } from '../../resources';
import type { VerifyVisitPassResult, EntryExitEvent } from '../../models/gate';
import { gateStatusTone, humanizeCode } from '../shared/status';

export interface VisitPassVerifyScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

type Mode = 'qr' | 'otp';

/**
 * Guard visit-pass verification (Req 23.3, 23.4, 25.3). The guard scans a QR token or enters the
 * visitor's OTP, verifies the pass, and — when the pass is accepted — records a gate ENTRY against
 * that pass in one tap. Rejections (expired/used/revoked/invalid) show the server's reason and never
 * create an entry (Req 23.4, 24.5).
 *
 * <p>No camera dependency is added: the QR token is entered/pasted into a field (a scanner can feed
 * it later without changing this screen) — ponytail: don't pull in a camera lib the task doesn't
 * require. Verify + record-entry both go through the shared {@link ResourceClients.gate} client, so
 * each write already carries an idempotency key.</p>
 */
export function VisitPassVerifyScreen({ resources, onBack }: VisitPassVerifyScreenProps) {
  const [mode, setMode] = useState<Mode>('qr');
  const [qrToken, setQrToken] = useState('');
  const [otp, setOtp] = useState('');
  const [result, setResult] = useState<VerifyVisitPassResult | null>(null);
  const [entry, setEntry] = useState<EntryExitEvent | null>(null);

  const verify = useAsyncAction(() =>
    resources.gate
      .verifyVisitPass(mode === 'qr' ? { qrToken: qrToken.trim() } : { otp: otp.trim() })
      .then((r) => {
        setResult(r);
        setEntry(null);
        return r;
      }),
  );

  const admit = useAsyncAction((visitPassId: string) =>
    resources.gate.recordEntry({ visitPassId }).then((e) => {
      setEntry(e);
      return e;
    }),
  );

  const canVerify = (mode === 'qr' ? qrToken.trim() : otp.trim()).length > 0;

  const switchMode = (m: Mode) => {
    setMode(m);
    setResult(null);
    setEntry(null);
    verify.reset();
  };

  return (
    <Screen accessibilityLabel="Verify visit pass">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the gate menu" /> : null}
      <SectionHeading title="Verify visit pass" level={1} />

      <View style={styles.segment} accessibilityRole="tablist">
        <View style={styles.flex}>
          <AppButton
            title="Scan QR"
            variant={mode === 'qr' ? 'primary' : 'secondary'}
            onPress={() => switchMode('qr')}
            accessibilityHint="Verify by QR token"
          />
        </View>
        <View style={styles.flex}>
          <AppButton
            title="Enter OTP"
            variant={mode === 'otp' ? 'primary' : 'secondary'}
            onPress={() => switchMode('otp')}
            accessibilityHint="Verify by one-time code"
          />
        </View>
      </View>

      {mode === 'qr' ? (
        <AppTextField
          label="QR token"
          value={qrToken}
          onChangeText={(t) => {
            setResult(null);
            setQrToken(t);
          }}
          placeholder="Scan or paste the pass QR token"
          autoCapitalize="none"
          returnKeyType="done"
        />
      ) : (
        <AppTextField
          label="OTP"
          value={otp}
          onChangeText={(t) => {
            setResult(null);
            setOtp(t);
          }}
          placeholder="Enter the visitor's code"
          keyboardType="number-pad"
          autoCapitalize="none"
          returnKeyType="done"
        />
      )}

      {verify.error ? <FormBanner message={verify.error.message} tone="error" /> : null}

      <AppButton
        title="Verify"
        loading={verify.running}
        disabled={!canVerify}
        onPress={() => verify.run()}
        accessibilityHint="Verify this visit pass"
      />

      {result ? (
        <View style={styles.result}>
          {result.accepted && result.pass ? (
            <>
              <FormBanner message="Pass accepted. The visitor may be admitted." tone="success" />
              <ListRow
                title={result.pass.visitorName}
                subtitle={`Uses ${result.pass.useCount} of ${result.pass.maxUses}`}
                trailing={<Badge label={humanizeCode(result.pass.status)} tone={gateStatusTone(result.pass.status)} />}
              />
              {entry ? (
                <FormBanner message={`Entry recorded at ${formatTime(entry.entryTsUtc)}.`} tone="success" />
              ) : (
                <>
                  {admit.error ? <FormBanner message={admit.error.message} tone="error" /> : null}
                  <AppButton
                    title="Record entry"
                    loading={admit.running}
                    onPress={() => admit.run(result.pass!.id)}
                    accessibilityHint="Record this visitor's entry at the gate"
                  />
                </>
              )}
            </>
          ) : (
            <FormBanner
              message={result.rejectionReason ?? 'The visit pass is not valid for entry.'}
              tone="error"
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

/** Local HH:MM for a captured timestamp — a gate guard wants the time, not an ISO string. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  result: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
});
