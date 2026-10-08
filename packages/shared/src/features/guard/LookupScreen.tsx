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
import { LinkButton } from '../../ui/LinkButton';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import type { PagedData } from '../../models/envelope';
import type { Unit } from '../../models/community';
import type { Resident } from '../../models/resident';
import type { ResourceClients } from '../../resources';
import { verificationTone, humanizeCode } from '../shared/status';

export interface GuardLookupScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

type Mode = 'units' | 'residents';

/**
 * Guard read-only lookup (Phase 2 minimal guard need): search units or residents, scoped
 * server-side to the guard's authorized communities. Read-only — no verification or edit actions
 * (those live in the resident/admin app). Reuses the same shared list primitives as the admin
 * screens so the two apps stay consistent (steering: reuse, don't hand-roll).
 */
export function GuardLookupScreen({ resources, onBack }: GuardLookupScreenProps) {
  const [mode, setMode] = useState<Mode>('units');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPage(1);
    setSearch('');
  };

  return (
    <Screen accessibilityLabel="Lookup">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to home" /> : null}
      <SectionHeading title="Lookup" level={1} />

      <View style={styles.segment} accessibilityRole="tablist">
        <View style={styles.flex}>
          <AppButton
            title="Units"
            variant={mode === 'units' ? 'primary' : 'secondary'}
            onPress={() => switchMode('units')}
            accessibilityHint="Look up units"
          />
        </View>
        <View style={styles.flex}>
          <AppButton
            title="Residents"
            variant={mode === 'residents' ? 'primary' : 'secondary'}
            onPress={() => switchMode('residents')}
            accessibilityHint="Look up residents"
          />
        </View>
      </View>

      <AppTextField
        label="Search"
        value={search}
        onChangeText={(t) => {
          setPage(1);
          setSearch(t);
        }}
        placeholder={mode === 'units' ? 'Search by unit number' : 'Search by name'}
        autoCapitalize={mode === 'units' ? 'characters' : 'words'}
        returnKeyType="search"
      />

      {mode === 'units' ? (
        <UnitResults resources={resources} search={search} page={page} onPageChange={setPage} />
      ) : (
        <ResidentResults resources={resources} search={search} page={page} onPageChange={setPage} />
      )}
    </Screen>
  );
}

function UnitResults({
  resources,
  search,
  page,
  onPageChange,
}: {
  resources: ResourceClients;
  search: string;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const { data, loading, error, reload } = useAsync<PagedData<Unit>>(
    (signal) => resources.units.list({ search: search.trim() || undefined, page, pageSize: DEFAULT_PAGE_SIZE }, {}, { signal }),
    [search, page],
  );
  const items = data?.items ?? [];
  return (
    <AsyncBoundary
      loading={loading}
      error={error}
      empty={!loading && items.length === 0}
      emptyMessage="No units found."
      onRetry={reload}
    >
      <View style={styles.list}>
        {items.map((u) => (
          <ListRow
            key={u.id}
            title={`Unit ${u.unitNumber}`}
            subtitle={`${humanizeCode(u.unitType)} · ${humanizeCode(u.unitStatus)}`}
            trailing={<Badge label={humanizeCode(u.unitStatus)} tone="neutral" />}
          />
        ))}
      </View>
      {data ? (
        <Pager page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} onPageChange={onPageChange} disabled={loading} />
      ) : null}
    </AsyncBoundary>
  );
}

function ResidentResults({
  resources,
  search,
  page,
  onPageChange,
}: {
  resources: ResourceClients;
  search: string;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const { data, loading, error, reload } = useAsync<PagedData<Resident>>(
    (signal) => resources.residents.list({ search: search.trim() || undefined, page, pageSize: DEFAULT_PAGE_SIZE }, {}, { signal }),
    [search, page],
  );
  const items = data?.items ?? [];
  return (
    <AsyncBoundary
      loading={loading}
      error={error}
      empty={!loading && items.length === 0}
      emptyMessage="No residents found."
      onRetry={reload}
    >
      <View style={styles.list}>
        {items.map((r) => (
          <ListRow
            key={r.id}
            title={r.name}
            subtitle={`${humanizeCode(r.residentType)}${r.phone ? ` · ${r.phone}` : ''}`}
            trailing={<Badge label={humanizeCode(r.verificationStatus)} tone={verificationTone(r.verificationStatus)} />}
          />
        ))}
      </View>
      {data ? (
        <Pager page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} onPageChange={onPageChange} disabled={loading} />
      ) : null}
    </AsyncBoundary>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
});
