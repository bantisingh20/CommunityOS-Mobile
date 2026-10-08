import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { LinkButton } from '../../ui/LinkButton';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import type { PagedData } from '../../models/envelope';
import type { Asset } from '../../models/maintenance';
import type { ResourceClients } from '../../resources';
import { humanizeCode } from '../shared/status';

export interface AssetLookupScreenProps {
  resources: ResourceClients;
  /** Open the work orders for the picked asset (filtered by assetId). */
  onOpenWorkOrders?: (asset: Asset) => void;
  onBack?: () => void;
}

/**
 * Staff asset QR-token lookup (Req 35.2). The staff member types (or pastes) the token printed on
 * the asset's QR label — or the asset serial — and looks it up. This mirrors the gate/parcel "scan"
 * flow: a plain text field + lookup, NO camera dependency (steering/ponytail — the operational apps
 * never add a scanner lib; a token/serial text field covers the same intent). The entered text drives
 * the tenant-scoped asset `search` (name / serial / location). Because the backend asset list is not
 * searchable by QR token, an exact `qrToken` match in the returned page is surfaced first as the
 * resolved asset; otherwise the search matches are listed to pick from.
 *
 * <p>ponytail: naive client-side token match over one search page — fine for the bounded per-community
 * asset register; a server-side `qrToken` filter would be the upgrade path if registers grow large.</p>
 */
export function AssetLookupScreen({ resources, onOpenWorkOrders, onBack }: AssetLookupScreenProps) {
  const [token, setToken] = useState('');
  const [query, setQuery] = useState('');

  const { data, loading, error, reload } = useAsync<PagedData<Asset>>(
    (signal) =>
      query.trim().length === 0
        ? Promise.resolve(emptyPage())
        : resources.maintenance.listAssets({ search: query.trim(), page: 1, pageSize: DEFAULT_PAGE_SIZE }, {}, { signal }),
    [query],
  );

  const items = data?.items ?? [];
  const trimmed = query.trim();
  // Exact QR-token match takes precedence over a plain name/serial search hit.
  const exact = trimmed.length ? items.find((a) => a.qrToken === trimmed) ?? null : null;
  const rest = exact ? items.filter((a) => a.id !== exact.id) : items;

  return (
    <Screen accessibilityLabel="Asset lookup">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the maintenance menu" /> : null}
      <SectionHeading title="Find an asset" level={1} />

      <AppTextField
        label="QR token or serial"
        value={token}
        onChangeText={setToken}
        placeholder="Type / paste the asset QR token or serial"
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={() => setQuery(token)}
      />
      <AppButton
        title="Look up asset"
        disabled={token.trim().length === 0}
        onPress={() => setQuery(token)}
        accessibilityHint="Look up the asset by its QR token or serial"
      />

      {trimmed.length ? (
        <AsyncBoundary
          loading={loading}
          error={error}
          empty={!loading && items.length === 0}
          emptyMessage="No asset matches that token or serial."
          onRetry={reload}
        >
          {exact ? (
            <View style={styles.section}>
              <SectionHeading title="Matched asset" />
              <AssetCard asset={exact} matched onOpenWorkOrders={onOpenWorkOrders} />
            </View>
          ) : null}
          {rest.length ? (
            <View style={styles.section}>
              <SectionHeading title={exact ? 'Other matches' : 'Matches'} />
              <View style={styles.list}>
                {rest.map((a) => (
                  <AssetCard key={a.id} asset={a} onOpenWorkOrders={onOpenWorkOrders} />
                ))}
              </View>
            </View>
          ) : null}
        </AsyncBoundary>
      ) : null}
    </Screen>
  );
}

function AssetCard({
  asset,
  matched = false,
  onOpenWorkOrders,
}: {
  asset: Asset;
  matched?: boolean;
  onOpenWorkOrders?: (asset: Asset) => void;
}) {
  return (
    <View style={styles.card}>
      <ListRow
        title={asset.name}
        subtitle={`${asset.serialNumber} · ${humanizeCode(asset.assetType)} · ${asset.location}`}
        trailing={
          <Badge
            label={matched ? 'Matched' : humanizeCode(asset.status)}
            tone={matched ? 'positive' : 'neutral'}
          />
        }
      />
      {onOpenWorkOrders ? (
        <AppButton
          title="Work orders"
          variant="secondary"
          onPress={() => onOpenWorkOrders(asset)}
          accessibilityHint={`View work orders for ${asset.name}`}
        />
      ) : null}
    </View>
  );
}

function emptyPage(): PagedData<Asset> {
  return { items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0 };
}

const styles = StyleSheet.create({
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  list: { gap: theme.spacing.md },
  card: { gap: theme.spacing.xs },
});
