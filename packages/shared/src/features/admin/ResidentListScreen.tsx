import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { EntityCard, type MetaChip } from '../../ui/EntityCard';
import { FilterCard } from '../../ui/FilterCard';
import { Pager } from '../../ui/Pager';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { MasterDataKeys } from '../../models/masterData';
import { ResidentVerificationStatus } from '../../models/resident';
import type { PagedData } from '../../models/envelope';
import type { Resident } from '../../models/resident';
import type { ResourceClients } from '../../resources';
import { verificationTone, humanizeCode } from '../shared/status';
import { VerificationActions } from './VerificationActions';

export interface ResidentListScreenProps {
  resources: ResourceClients;
  /** Start in the verification queue (verificationStatus=pending) with approve/reject (Req 17.2). */
  queueOnly?: boolean;
  /** Start adding a new resident (owner) for an available unit. */
  onAddResident?: () => void;
  onBack?: () => void;
}

/** Two-letter initials for the avatar. */
function initialsOf(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** A tint per verification status so the avatar colour reinforces the state. */
function residentTint(status: string): string {
  switch (status) {
    case ResidentVerificationStatus.Verified: return theme.color.success;
    case ResidentVerificationStatus.Rejected: return theme.color.danger;
    default: return theme.color.warning;
  }
}

/**
 * Resident list + verification queue (Req 15.4, 17.2, 17.3) — a modern, card-based surface. A
 * segmented control switches All / Pending; a collapsible {@link FilterCard} holds search + the
 * configurable `Resident_Type` filter. Each resident is an {@link EntityCard} with an initials
 * avatar (tinted by status), meta chips (type, phone/email), and a verification badge; in the queue,
 * inline approve/reject {@link VerificationActions} render inside the card.
 */
export function ResidentListScreen({ resources, queueOnly = false, onAddResident, onBack }: ResidentListScreenProps) {
  const [queue, setQueue] = useState(queueOnly);
  const [search, setSearch] = useState('');
  const [residentType, setResidentType] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const verificationStatus = queue ? ResidentVerificationStatus.Pending : undefined;

  const { data, loading, error, reload } = useAsync<PagedData<Resident>>(
    (signal) =>
      resources.residents.list(
        { search: search.trim() || undefined, page, pageSize: DEFAULT_PAGE_SIZE },
        { ...(verificationStatus ? { verificationStatus } : {}), ...(residentType ? { residentType } : {}) },
        { signal },
      ),
    [queue, search, residentType, page],
  );

  const items = data?.items ?? [];
  const activeCount = (search.trim() ? 1 : 0) + (residentType ? 1 : 0);
  const clearAll = () => { setPage(1); setSearch(''); setResidentType(null); };
  const switchMode = (toQueue: boolean) => { setPage(1); setQueue(toQueue); };

  return (
    <FormScreen
      title={queue ? 'Verification queue' : 'Residents'}
      subtitle={data ? `${data.totalCount} ${data.totalCount === 1 ? 'resident' : 'residents'}` : undefined}
      {...(onBack ? { onBack } : {})}
    >
      {/* Segmented control */}
      <View style={styles.segment} accessibilityRole="tablist">
        <SegmentTab label="All" active={!queue} onPress={() => switchMode(false)} />
        <SegmentTab label="Pending" active={queue} onPress={() => switchMode(true)} />
      </View>

      {onAddResident && !queue ? (
        <AppButton title="+ Add resident" onPress={onAddResident} accessibilityHint="Add a new resident and owner for a unit" />
      ) : null}

      <FilterCard activeCount={activeCount} onClear={clearAll}>
        <AppTextField
          label="Search"
          value={search}
          onChangeText={(t) => { setPage(1); setSearch(t); }}
          placeholder="Search by name"
          autoCapitalize="words"
          returnKeyType="search"
        />
        <MasterDataDropdown
          label="Resident type"
          listKey={MasterDataKeys.ResidentType}
          masterData={resources.masterData}
          value={residentType}
          onChange={(v) => { setPage(1); setResidentType(v); }}
          allowClear
          clearLabel="Any type"
        />
      </FilterCard>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage={queue ? 'No residents awaiting verification.' : 'No residents match your filters.'}
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((r) => {
            const meta: MetaChip[] = [{ icon: 'person-outline', label: humanizeCode(r.residentType) }];
            if (r.phone) meta.push({ icon: 'call-outline', label: r.phone });
            else if (r.email) meta.push({ icon: 'mail-outline', label: r.email });
            return (
              <EntityCard
                key={r.id}
                title={r.name}
                initials={initialsOf(r.name)}
                tint={residentTint(r.verificationStatus)}
                badge={{ label: humanizeCode(r.verificationStatus), tone: verificationTone(r.verificationStatus) }}
                meta={meta}
              >
                {r.verificationStatus === ResidentVerificationStatus.Rejected && r.rejectionReason ? (
                  <View style={styles.reason}>
                    <Text style={styles.reasonLabel}>Rejection reason</Text>
                    <Text style={styles.reasonText}>{r.rejectionReason}</Text>
                  </View>
                ) : null}
                <VerificationActions resources={resources} resident={r} onChanged={reload} />
              </EntityCard>
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

/** One pill in the segmented All/Pending control. */
function SegmentTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.tab, active ? styles.tabActive : null]}
    >
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.pill,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
    ...theme.shadow.soft,
  },
  tab: { flex: 1, minHeight: theme.minTouchTarget - 8, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.color.primary },
  tabText: { fontSize: theme.fontSize.label, fontWeight: '700', color: theme.color.mutedText },
  tabTextActive: { color: theme.color.primaryText },
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  reason: {
    backgroundColor: '#fdecec',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 2,
  },
  reasonLabel: { fontSize: theme.fontSize.caption, fontWeight: '800', color: theme.color.danger, textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: theme.fontSize.label, color: theme.color.text },
});
