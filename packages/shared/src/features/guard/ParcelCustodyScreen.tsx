import React, { useState } from 'react';
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
import type { Parcel } from '../../models/parcel';
import { ParcelStatus } from '../../models/parcel';
import type { ResourceClients } from '../../resources';
import { parcelStatusTone, humanizeCode } from '../shared/status';

export interface ParcelCustodyScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/**
 * Guard assign-custody (Req 29.1, 29.4). Lists parcels waiting to be moved into custody (defaults to
 * the `received` state) and lets the guard hold a chosen parcel in a secure custody location. The
 * guard enters the location code; the screen creates the custody location in the parcel's community
 * (an existing code replays as a CONFLICT the backend surfaces) and then assigns it — matching the
 * backend's "create custody-location, then assign" shape. Only one parcel may actively hold a given
 * location: a racing duplicate assignment is rejected as a CONFLICT (Req 29.4), surfaced inline.
 *
 * <p>There is no custody-location LIST endpoint yet, so the guard types the location code rather than
 * picking from a dropdown (ponytail: don't invent a client call the backend doesn't expose; a picker
 * can replace the field when a list endpoint lands).</p>
 */
export function ParcelCustodyScreen({ resources, onBack }: ParcelCustodyScreenProps) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync<PagedData<Parcel>>(
    (signal) =>
      resources.parcels.listParcels(
        { page, pageSize: DEFAULT_PAGE_SIZE, sort: '-receivedAtUtc' },
        { status: ParcelStatus.Received },
        { signal },
      ),
    [page],
  );

  const assign = useAsyncAction(async () => {
    if (!selected || locationCode.trim().length === 0) {
      throw new Error('Missing fields');
    }
    // Create (or hit the existing) custody location in the parcel's community, then assign it.
    const code = locationCode.trim();
    const location = await resources.parcels.createCustodyLocation({
      communityId: selected.communityId,
      code,
    });
    await resources.parcels.assignCustodyLocation(selected.id, location.id);
    setNotice(`Moved ${selected.trackingNumber} into custody at ${code}.`);
    setSelected(null);
    setLocationCode('');
    reload();
  });

  const items = data?.items ?? [];

  if (selected) {
    return (
      <Screen accessibilityLabel="Assign custody">
        <LinkButton
          title="‹ Back"
          onPress={() => {
            setSelected(null);
            setLocationCode('');
            assign.reset();
          }}
          accessibilityHint="Return to the custody list"
        />
        <SectionHeading title="Assign custody" level={1} />
        <ListRow
          title={selected.trackingNumber}
          subtitle={`${selected.provider} · ${humanizeCode(selected.category)}`}
          trailing={<Badge label={humanizeCode(selected.status)} tone={parcelStatusTone(selected.status)} />}
        />
        {selected.isPriority ? <Badge label="Priority" tone="danger" /> : null}

        <AppTextField
          label="Custody location code"
          value={locationCode}
          onChangeText={setLocationCode}
          placeholder="e.g. SHELF-A3 or LOCKER-12"
          autoCapitalize="characters"
          returnKeyType="done"
          {...(assign.error?.fieldErrors.code ? { error: assign.error.fieldErrors.code } : {})}
        />

        {assign.error && !assign.error.fieldErrors.code ? (
          <FormBanner message={assign.error.message} tone="error" />
        ) : null}

        <AppButton
          title="Move into custody"
          loading={assign.running}
          disabled={locationCode.trim().length === 0}
          onPress={() => assign.run()}
          accessibilityHint="Hold this parcel in the entered custody location"
        />
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Parcels awaiting custody">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the parcels menu" /> : null}
      <SectionHeading title="Assign custody" level={1} />

      {notice ? <FormBanner message={notice} tone="success" /> : null}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="No parcels are waiting to be moved into custody."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((p) => (
            <ListRow
              key={p.id}
              title={p.trackingNumber}
              subtitle={`${p.provider} · ${humanizeCode(p.category)}${p.isPriority ? ' · Priority' : ''}`}
              trailing={<Badge label={humanizeCode(p.status)} tone={parcelStatusTone(p.status)} />}
              onPress={() => {
                setNotice(null);
                setSelected(p);
              }}
              accessibilityHint={`Assign custody for ${p.trackingNumber}`}
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

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
});
