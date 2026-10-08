import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { AppTextField } from '../../ui/AppTextField';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { EntityCard, type MetaChip } from '../../ui/EntityCard';
import { FilterCard } from '../../ui/FilterCard';
import { Pager } from '../../ui/Pager';
import { AppButton } from '../../ui/AppButton';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import type { BadgeTone } from '../../ui/Badge';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { MasterDataKeys } from '../../models/masterData';
import type { PagedData } from '../../models/envelope';
import type { Community, Unit } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { humanizeCode } from '../shared/status';

export interface UnitListScreenProps {
  resources: ResourceClients;
  /** The community whose units are shown — scopes the master-data filter + heading context. */
  community?: Community;
  onOpenUnit?: (unit: Unit) => void;
  /** Start adding a unit (shown when a community context is present). */
  onAddUnit?: () => void;
  onBack?: () => void;
}

/** Unit status → badge tone (configurable codes, so unknown falls back to neutral). */
function unitStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'available': return 'positive';
    case 'occupied': return 'neutral';
    case 'vacant': return 'warning';
    case 'under_maintenance': return 'warning';
    case 'blocked': return 'danger';
    default: return 'neutral';
  }
}

/**
 * Unit list for a community (Req 14.5) — a modern, card-based surface. A collapsible
 * {@link FilterCard} holds search + the configurable `Unit_Status` / `Unit_Type` filters; each unit
 * renders as an {@link EntityCard} with a home icon, the unit number, meta chips (type, floor,
 * bedrooms) and a status badge. Scoped server-side to the caller's authorized communities.
 *
 * ponytail: the units list endpoint has no `communityId` filter param (it is tenant-scoped by the
 * token's authorized communities), so when a specific `community` is given we narrow the current
 * page client-side. Upgrade path: add a `communityId` filter to the backend list allow-list.
 */
export function UnitListScreen({ resources, community, onOpenUnit, onAddUnit, onBack }: UnitListScreenProps) {
  const [search, setSearch] = useState('');
  const [unitStatus, setUnitStatus] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync<PagedData<Unit>>(
    (signal) =>
      resources.units.list(
        { search: search.trim() || undefined, page, pageSize: DEFAULT_PAGE_SIZE },
        { ...(unitStatus ? { unitStatus } : {}), ...(unitType ? { unitType } : {}) },
        { signal },
      ),
    [search, unitStatus, unitType, page],
  );

  const items = (data?.items ?? []).filter((u) => !community || u.communityId === community.id);
  const activeCount = (search.trim() ? 1 : 0) + (unitStatus ? 1 : 0) + (unitType ? 1 : 0);
  const clearAll = () => { setPage(1); setSearch(''); setUnitStatus(null); setUnitType(null); };

  return (
    <FormScreen
      title={community ? `Units — ${community.name}` : 'Units'}
      subtitle={`${items.length} shown`}
      {...(onBack ? { onBack } : {})}
    >
      {onAddUnit ? (
        <AppButton title="+ Add unit" onPress={onAddUnit} accessibilityHint="Create a unit in this community" />
      ) : null}

      <FilterCard activeCount={activeCount} onClear={clearAll}>
        <AppTextField
          label="Search"
          value={search}
          onChangeText={(t) => { setPage(1); setSearch(t); }}
          placeholder="Search by unit number"
          autoCapitalize="characters"
          returnKeyType="search"
        />
        <MasterDataDropdown
          label="Status"
          listKey={MasterDataKeys.UnitStatus}
          masterData={resources.masterData}
          value={unitStatus}
          onChange={(v) => { setPage(1); setUnitStatus(v); }}
          {...(community ? { communityId: community.id } : {})}
          allowClear
          clearLabel="Any status"
        />
        <MasterDataDropdown
          label="Type"
          listKey={MasterDataKeys.UnitType}
          masterData={resources.masterData}
          value={unitType}
          onChange={(v) => { setPage(1); setUnitType(v); }}
          {...(community ? { communityId: community.id } : {})}
          allowClear
          clearLabel="Any type"
        />
      </FilterCard>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="No units match your filters."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((u) => {
            const meta: MetaChip[] = [{ icon: 'pricetag-outline', label: humanizeCode(u.unitType) }];
            if (u.floor) meta.push({ icon: 'layers-outline', label: `Floor ${u.floor}` });
            if (u.bedrooms != null) meta.push({ icon: 'bed-outline', label: `${u.bedrooms} BHK` });
            return (
              <EntityCard
                key={u.id}
                title={`Unit ${u.unitNumber}`}
                icon="home"
                tint={theme.color.info}
                badge={{ label: humanizeCode(u.unitStatus), tone: unitStatusTone(u.unitStatus) }}
                meta={meta}
                {...(onOpenUnit ? { onPress: () => onOpenUnit(u), accessibilityHint: 'View unit details' } : {})}
              />
            );
          })}
        </View>
        {data ? (
          <Pager page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} onPageChange={setPage} disabled={loading} />
        ) : null}
      </AsyncBoundary>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
});
