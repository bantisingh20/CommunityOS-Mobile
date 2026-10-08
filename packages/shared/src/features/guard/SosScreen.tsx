import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { FormBanner } from '../../ui/FormBanner';
import { LinkButton } from '../../ui/LinkButton';
import { Select } from '../../ui/Select';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { useAuth } from '../../auth/AuthContext';
import { theme } from '../../ui/theme';
import { SosAlertStatus } from '../../models/gate';
import type { PagedData } from '../../models/envelope';
import type { SosAlert } from '../../models/gate';
import type { Community } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { gateStatusTone, humanizeCode } from '../shared/status';

export interface SosScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/**
 * Guard SOS (Req 27.3, 27.4). Raise an emergency alert for a community — it notifies the responder
 * audience immediately — and acknowledge/resolve active alerts. The raising user is the signed-in
 * guard (the access token's `sub`, read from {@link useAuth}); no user id is hardcoded or typed in.
 * The target community is picked from the guard's authorized communities so the alert carries the
 * right `CommunityId`. An active alert stays active until someone acknowledges/resolves it (Req 27.4).
 */
export function SosScreen({ resources, onBack }: SosScreenProps) {
  const { userId } = useAuth();
  const [community, setCommunity] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const communities = useAsync<PagedData<Community>>(
    (signal) => resources.communities.list({ pageSize: 50 }, {}, { signal }),
    [],
  );

  // Default to the sole community when the guard is scoped to one.
  useEffect(() => {
    const items = communities.data?.items ?? [];
    if (!community && items.length === 1 && items[0]) {
      setCommunity(items[0].id);
    }
  }, [communities.data, community]);

  const active = useAsync<PagedData<SosAlert>>(
    (signal) => resources.securityOps.listSos({ pageSize: 25, sort: '-raisedAtUtc' }, { status: SosAlertStatus.Active }, { signal }),
    [],
  );

  const raise = useAsyncAction(() => {
    if (!community || !userId) {
      return Promise.reject(new Error('Missing community or user'));
    }
    return resources.securityOps.raiseSos({
      communityId: community,
      raisedByUserId: userId,
      ...(location.trim() ? { location: location.trim() } : {}),
    });
  });

  const acknowledge = useAsyncAction((id: string) => {
    if (!userId) {
      return Promise.reject(new Error('No user'));
    }
    return resources.securityOps.acknowledgeSos(id, userId);
  });

  const resolve = useAsyncAction((id: string) => {
    if (!userId) {
      return Promise.reject(new Error('No user'));
    }
    return resources.securityOps.resolveSos(id, userId);
  });

  const communityOptions = (communities.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
  const activeItems = active.data?.items ?? [];

  return (
    <Screen accessibilityLabel="SOS">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the gate menu" /> : null}
      <SectionHeading title="SOS" level={1} />

      {!userId ? (
        <FormBanner message="Your session is missing a user id; please sign in again to raise an SOS." tone="error" />
      ) : null}

      <SectionHeading title="Raise an alert" />
      {communityOptions.length > 1 ? (
        <Select
          label="Community"
          value={community}
          options={communityOptions}
          onChange={setCommunity}
          placeholder="Select the community"
        />
      ) : null}
      <AppTextField
        label="Location (optional)"
        value={location}
        onChangeText={setLocation}
        placeholder="e.g. Main gate, Tower B lobby"
      />

      {raise.error ? <FormBanner message={raise.error.message} tone="error" /> : null}
      {notice ? <FormBanner message={notice} tone="success" /> : null}

      <AppButton
        title="Raise SOS"
        loading={raise.running}
        disabled={!community || !userId}
        onPress={async () => {
          setNotice(null);
          if (await raise.run()) {
            setNotice('SOS raised. Responders have been notified.');
            setLocation('');
            active.reload();
          }
        }}
        accessibilityHint="Raise an emergency SOS alert for this community"
      />

      <SectionHeading title="Active alerts" />
      {acknowledge.error ? <FormBanner message={acknowledge.error.message} tone="error" /> : null}
      {resolve.error ? <FormBanner message={resolve.error.message} tone="error" /> : null}
      <AsyncBoundary
        loading={active.loading}
        error={active.error}
        empty={!active.loading && activeItems.length === 0}
        emptyMessage="No active SOS alerts."
        onRetry={active.reload}
      >
        <View style={styles.list}>
          {activeItems.map((a) => (
            <View key={a.id} style={styles.card}>
              <ListRow
                title={a.location ?? 'SOS alert'}
                subtitle={`Raised ${formatTime(a.raisedAtUtc)}`}
                trailing={<Badge label={humanizeCode(a.status)} tone={gateStatusTone(a.status)} />}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppButton
                    title="Acknowledge"
                    variant="secondary"
                    disabled={!userId || a.status !== SosAlertStatus.Active}
                    loading={acknowledge.running}
                    onPress={async () => {
                      if (await acknowledge.run(a.id)) {
                        active.reload();
                      }
                    }}
                    accessibilityHint="Acknowledge this SOS alert"
                  />
                </View>
                <View style={styles.flex}>
                  <AppButton
                    title="Resolve"
                    disabled={!userId}
                    loading={resolve.running}
                    onPress={async () => {
                      if (await resolve.run(a.id)) {
                        active.reload();
                      }
                    }}
                    accessibilityHint="Resolve this SOS alert"
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      </AsyncBoundary>
    </Screen>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: { gap: theme.spacing.xs },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
});
