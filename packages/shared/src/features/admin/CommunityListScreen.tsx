import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { AppTextField } from '../../ui/AppTextField';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { EntityCard } from '../../ui/EntityCard';
import { FilterCard } from '../../ui/FilterCard';
import { Pager } from '../../ui/Pager';
import { AppButton } from '../../ui/AppButton';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { MasterDataKeys } from '../../models/masterData';
import type { PagedData } from '../../models/envelope';
import type { Community } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { humanizeCode } from '../shared/status';

export interface CommunityListScreenProps {
  resources: ResourceClients;
  /** Open a community to manage it (edit / wings / units). */
  onOpenCommunity?: (community: Community) => void;
  /** Start creating a new community. The caller passes the organizationId derived from the list. */
  onCreate?: (organizationId: string | null) => void;
  /** Optional back affordance for the home navigator. */
  onBack?: () => void;
}

/** A per-community-type icon so the cards read at a glance (configurable code → sensible default). */
function typeIcon(code: string): keyof typeof Ionicons.glyphMap {
  switch (code) {
    case 'apartment_society': return 'business';
    case 'gated_community': return 'shield-checkmark';
    case 'villa_bungalow': return 'home';
    case 'townhouse': return 'grid';
    case 'mixed': return 'layers';
    default: return 'business';
  }
}

/**
 * Community list — a modern, card-based admin surface (Req 12.4). A collapsible {@link FilterCard}
 * holds search + the configurable `Community_Type` filter; results render as rich {@link EntityCard}s
 * (type icon, name, type chip, archived badge) with a results count. Scoped server-side to the
 * caller's authorized communities. Uses the shared {@link FormScreen} scaffold for safe-area/header.
 */
export function CommunityListScreen({ resources, onOpenCommunity, onCreate, onBack }: CommunityListScreenProps) {
  const [search, setSearch] = useState('');
  const [communityType, setCommunityType] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync<PagedData<Community>>(
    (signal) =>
      resources.communities.list(
        { search: search.trim() || undefined, page, pageSize: DEFAULT_PAGE_SIZE },
        communityType ? { communityType } : {},
        { signal },
      ),
    [search, communityType, page],
  );

  const items = data?.items ?? [];
  const activeCount = (search.trim() ? 1 : 0) + (communityType ? 1 : 0);
  const clearAll = () => { setPage(1); setSearch(''); setCommunityType(null); };

  return (
    <FormScreen
      title="Communities"
      subtitle={data ? `${data.totalCount} ${data.totalCount === 1 ? 'society' : 'societies'}` : 'Societies you manage'}
      {...(onBack ? { onBack } : {})}
    >
      {onCreate ? (
        <AppButton
          title="+ New community"
          onPress={() => onCreate(items[0]?.organizationId ?? null)}
          accessibilityHint="Create a new community"
        />
      ) : null}

      <FilterCard activeCount={activeCount} onClear={clearAll}>
        <AppTextField
          label="Search"
          value={search}
          onChangeText={(t) => { setPage(1); setSearch(t); }}
          placeholder="Search by name"
          autoCapitalize="none"
          returnKeyType="search"
        />
        <MasterDataDropdown
          label="Community type"
          listKey={MasterDataKeys.CommunityType}
          masterData={resources.masterData}
          value={communityType}
          onChange={(v) => { setPage(1); setCommunityType(v); }}
          allowClear
          clearLabel="All types"
        />
      </FilterCard>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="No communities match your filters."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((c) => (
            <EntityCard
              key={c.id}
              title={c.name}
              subtitle={humanizeCode(c.communityType)}
              icon={typeIcon(c.communityType)}
              tint={theme.color.primary}
              meta={[{ icon: 'pricetag-outline', label: humanizeCode(c.communityType) }]}
              {...(c.isArchived ? { badge: { label: 'Archived', tone: 'neutral' as const } } : {})}
              {...(onOpenCommunity ? { onPress: () => onOpenCommunity(c), accessibilityHint: 'Manage this community' } : {})}
            />
          ))}
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
