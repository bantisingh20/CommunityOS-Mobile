import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { FormBanner } from '../../ui/FormBanner';
import { LinkButton } from '../../ui/LinkButton';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import type { PagedData } from '../../models/envelope';
import type { Parcel, ParcelHandover } from '../../models/parcel';
import { ParcelStatus } from '../../models/parcel';
import type { ResourceClients, PerformHandoverBody } from '../../resources';
import { newIdempotencyKey } from '../../resources';
import { ApiRequestError } from '../../api/errors';
import { parcelStatusTone, humanizeCode } from '../shared/status';

export interface ParcelHandoverScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/** Which action the selected parcel is in. */
type DetailMode = 'handover' | 'lostDamaged' | 'returned';

/**
 * Guard verified handover + custody outcomes (Req 30.2–30.5, 31.3, 31.4). Lists parcels that can be
 * handed over (in custody / ready for pickup); for a chosen parcel the guard either performs a
 * verified handover (entering the resident's authorization id plus whatever the collector presents —
 * OTP, QR token and/or ID reference) or records the parcel as lost/damaged (raising a linked
 * incident, Req 31.3) or returned to the provider (Req 31.4). The backend verifies the collector
 * against the authorization's configured method; a failed verification leaves the parcel unchanged
 * (Req 30.3).
 *
 * <p><b>Connectivity-REQUIRED (Req 30.5).</b> Unlike the gate exit capture, a handover is NEVER
 * queued offline — a verified custody transfer must happen online. The screen makes that explicit
 * and, on a transport failure, tells the guard to retry when back online. It carries a STABLE
 * `Idempotency-Key` for the attempt (generated once when the parcel is selected and held in a ref),
 * so a retry after a flaky response performs the handover at most once and replays the first result
 * rather than handing the same parcel over twice.</p>
 */
export function ParcelHandoverScreen({ resources, onBack }: ParcelHandoverScreenProps) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [mode, setMode] = useState<DetailMode>('handover');
  const [authorizationId, setAuthorizationId] = useState('');
  const [otp, setOtp] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [idReference, setIdReference] = useState('');
  const [proofFileId, setProofFileId] = useState('');
  const [circumstances, setCircumstances] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [done, setDone] = useState<ParcelHandover | null>(null);
  const [outcomeNotice, setOutcomeNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  // Stable at-most-once key for the CURRENT handover attempt; reused across retries (Req 30.5).
  const keyRef = useRef<string>(newIdempotencyKey());

  const { data, loading, error, reload } = useAsync<PagedData<Parcel>>(
    (signal) =>
      resources.parcels.listParcels({ page, pageSize: DEFAULT_PAGE_SIZE, sort: '-receivedAtUtc' }, {}, { signal }),
    [page],
  );

  const handover = useAsyncAction(async () => {
    if (!selected || authorizationId.trim().length === 0) {
      throw new Error('Missing fields');
    }
    const body: PerformHandoverBody = {
      parcelAuthorizationId: authorizationId.trim(),
      ...(otp.trim() ? { otp: otp.trim() } : {}),
      ...(qrToken.trim() ? { qrToken: qrToken.trim() } : {}),
      ...(idReference.trim() ? { presentedIdReference: idReference.trim() } : {}),
      ...(proofFileId.trim() ? { proofFileId: proofFileId.trim() } : {}),
    };
    setOffline(false);
    try {
      const result = await resources.parcels.performHandover(selected.id, body, keyRef.current);
      setDone(result);
      reload();
      return result;
    } catch (err) {
      // Connectivity-required: flag a transport failure so the UI says "reconnect and retry". The
      // SAME stable key is kept, so the retry performs the handover at most once (Req 30.5).
      if (isTransport(err)) {
        setOffline(true);
      }
      throw err;
    }
  });

  const lostDamaged = useAsyncAction(async () => {
    if (!selected || circumstances.trim().length === 0) {
      throw new Error('Missing fields');
    }
    await resources.parcels.recordLostDamaged(selected.id, {
      circumstances: circumstances.trim(),
      ...(evidenceFileId.trim() ? { evidenceFileId: evidenceFileId.trim() } : {}),
    });
    setOutcomeNotice(`Recorded ${selected.trackingNumber} as lost / damaged and raised a linked incident.`);
    reload();
  });

  const returned = useAsyncAction(async () => {
    if (!selected) {
      throw new Error('No parcel');
    }
    await resources.parcels.recordReturned(selected.id, {
      ...(returnReason.trim() ? { reason: returnReason.trim() } : {}),
    });
    setOutcomeNotice(`Recorded ${selected.trackingNumber} as returned to the provider.`);
    reload();
  });

  const items = (data?.items ?? []).filter(canHandOver);

  const openParcel = (p: Parcel) => {
    setSelected(p);
    setMode('handover');
    setAuthorizationId('');
    setOtp('');
    setQrToken('');
    setIdReference('');
    setProofFileId('');
    setCircumstances('');
    setEvidenceFileId('');
    setReturnReason('');
    setDone(null);
    setOutcomeNotice(null);
    setOffline(false);
    keyRef.current = newIdempotencyKey(); // fresh stable key per new handover intent
    handover.reset();
    lostDamaged.reset();
    returned.reset();
  };

  const closeParcel = () => {
    setSelected(null);
    handover.reset();
    lostDamaged.reset();
    returned.reset();
  };

  const switchMode = (m: DetailMode) => {
    setMode(m);
    setOutcomeNotice(null);
    handover.reset();
    lostDamaged.reset();
    returned.reset();
  };

  if (selected) {
    const finished = done || outcomeNotice;
    return (
      <Screen accessibilityLabel="Perform handover">
        <LinkButton title="‹ Back" onPress={closeParcel} accessibilityHint="Return to the handover list" />
        <SectionHeading title="Verified handover" level={1} />

        <ListRow
          title={selected.trackingNumber}
          subtitle={`${selected.provider} · ${humanizeCode(selected.category)}`}
          trailing={<Badge label={humanizeCode(selected.status)} tone={parcelStatusTone(selected.status)} />}
        />

        {finished ? (
          <>
            <FormBanner
              message={
                done
                  ? `Handed over to ${done.collectorName} at ${formatDateTime(done.handedOverAtUtc)} (verified by ${humanizeCode(done.verificationMethod)}).`
                  : outcomeNotice ?? ''
              }
              tone="success"
            />
            <AppButton title="Back to list" onPress={closeParcel} accessibilityHint="Return to the handover list" />
          </>
        ) : (
          <>
            <View style={styles.segment} accessibilityRole="tablist">
              <View style={styles.flex}>
                <AppButton
                  title="Hand over"
                  variant={mode === 'handover' ? 'primary' : 'secondary'}
                  onPress={() => switchMode('handover')}
                  accessibilityHint="Perform a verified handover"
                />
              </View>
              <View style={styles.flex}>
                <AppButton
                  title="Lost / damaged"
                  variant={mode === 'lostDamaged' ? 'primary' : 'secondary'}
                  onPress={() => switchMode('lostDamaged')}
                  accessibilityHint="Record this parcel as lost or damaged"
                />
              </View>
              <View style={styles.flex}>
                <AppButton
                  title="Returned"
                  variant={mode === 'returned' ? 'primary' : 'secondary'}
                  onPress={() => switchMode('returned')}
                  accessibilityHint="Record this parcel as returned to the provider"
                />
              </View>
            </View>

            {mode === 'handover' ? (
              <>
                <FormBanner
                  message="A handover must be done online — it is never saved offline. Verify the collector in person before confirming."
                  tone="success"
                />
                <AppTextField
                  label="Authorization id"
                  value={authorizationId}
                  onChangeText={setAuthorizationId}
                  placeholder="The resident's authorization id"
                  autoCapitalize="none"
                  {...(handover.error?.fieldErrors.parcelAuthorizationId
                    ? { error: handover.error.fieldErrors.parcelAuthorizationId }
                    : {})}
                />

                <SectionHeading title="Collector verification" />
                <AppTextField
                  label="OTP"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="One-time code the collector presents"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  {...(handover.error?.fieldErrors.otp ? { error: handover.error.fieldErrors.otp } : {})}
                />
                <AppTextField
                  label="QR token"
                  value={qrToken}
                  onChangeText={setQrToken}
                  placeholder="Scan or paste the collector's QR token"
                  autoCapitalize="none"
                  {...(handover.error?.fieldErrors.qrToken ? { error: handover.error.fieldErrors.qrToken } : {})}
                />
                <AppTextField
                  label="ID reference"
                  value={idReference}
                  onChangeText={setIdReference}
                  placeholder="Government / photo-ID reference"
                  autoCapitalize="characters"
                  {...(handover.error?.fieldErrors.presentedIdReference
                    ? { error: handover.error.fieldErrors.presentedIdReference }
                    : {})}
                />
                <AppTextField
                  label="Proof reference (optional)"
                  value={proofFileId}
                  onChangeText={setProofFileId}
                  placeholder="Captured handover proof file id"
                  autoCapitalize="none"
                />

                {handover.error ? (
                  <FormBanner
                    message={
                      offline
                        ? 'Can\u2019t reach the server. A handover must be online — reconnect and try again (this won\u2019t hand the parcel over twice).'
                        : handover.error.message || 'Verification failed. The parcel was not handed over.'
                    }
                    tone="error"
                  />
                ) : null}

                <AppButton
                  title="Confirm handover"
                  loading={handover.running}
                  disabled={authorizationId.trim().length === 0}
                  onPress={() => handover.run()}
                  accessibilityHint="Verify the collector and hand over the parcel"
                />
              </>
            ) : mode === 'lostDamaged' ? (
              <>
                <AppTextField
                  label="Circumstances"
                  value={circumstances}
                  onChangeText={setCircumstances}
                  placeholder="What happened to the parcel?"
                  {...(lostDamaged.error?.fieldErrors.circumstances
                    ? { error: lostDamaged.error.fieldErrors.circumstances }
                    : {})}
                />
                <AppTextField
                  label="Evidence reference (optional)"
                  value={evidenceFileId}
                  onChangeText={setEvidenceFileId}
                  placeholder="Captured loss / damage evidence file id"
                  autoCapitalize="none"
                />
                {lostDamaged.error && !lostDamaged.error.fieldErrors.circumstances ? (
                  <FormBanner message={lostDamaged.error.message} tone="error" />
                ) : null}
                <AppButton
                  title="Record lost / damaged"
                  loading={lostDamaged.running}
                  disabled={circumstances.trim().length === 0}
                  onPress={() => lostDamaged.run()}
                  accessibilityHint="Record this parcel as lost or damaged and raise a linked incident"
                />
              </>
            ) : (
              <>
                <AppTextField
                  label="Reason (optional)"
                  value={returnReason}
                  onChangeText={setReturnReason}
                  placeholder="Why is the parcel being returned?"
                />
                {returned.error ? <FormBanner message={returned.error.message} tone="error" /> : null}
                <AppButton
                  title="Record returned"
                  loading={returned.running}
                  onPress={() => returned.run()}
                  accessibilityHint="Record this parcel as returned to the delivery provider"
                />
              </>
            )}
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Parcels for handover">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the parcels menu" /> : null}
      <SectionHeading title="Verified handover" level={1} />

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="No parcels are ready to hand over."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((p) => (
            <ListRow
              key={p.id}
              title={p.trackingNumber}
              subtitle={`${p.provider} · ${humanizeCode(p.category)}${p.isPriority ? ' · Priority' : ''}`}
              trailing={<Badge label={humanizeCode(p.status)} tone={parcelStatusTone(p.status)} />}
              onPress={() => openParcel(p)}
              accessibilityHint={`Hand over ${p.trackingNumber}`}
            />
          ))}
        </View>
        {data ? (
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            onPageChange={setPage}
            disabled={loading}
          />
        ) : null}
      </AsyncBoundary>
    </Screen>
  );
}

/** A parcel can be handed over once it is held in custody or marked ready for pickup (Req 30.2). */
function canHandOver(p: Parcel): boolean {
  return p.status === ParcelStatus.InCustody || p.status === ParcelStatus.ReadyForPickup;
}

/** True when the failure is a transport/connectivity error (so the UI can say "reconnect and retry"). */
function isTransport(err: unknown): boolean {
  return err instanceof ApiRequestError && (err.httpStatus === 0 || err.code === 'INTEGRATION_FAILURE');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  segment: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
});
