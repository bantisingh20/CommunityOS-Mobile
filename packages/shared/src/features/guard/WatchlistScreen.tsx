import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
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
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { GateMasterDataKeys, WatchlistStatus } from '../../models/gate';
import type { PagedData } from '../../models/envelope';
import type { WatchlistEntry } from '../../models/gate';
import type { Community } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { watchlistTone, humanizeCode } from '../shared/status';

export interface WatchlistScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/**
 * Guard watchlist (Req 26.1, 26.3, 26.5). Surfaces the community's flagged subjects (View-gated) and
 * lets an authorized guard add an entry or clear an active one. A flagged subject is what the gate
 * matches at entry; admitting one then needs an Approve override (enforced server-side). Subject
 * type and severity options come from the configurable master-data lists (`Watchlist_Subject_Type`,
 * `Watchlist_Severity`), never hardcoded. The target community is chosen from the guard's authorized
 * communities so the correct `CommunityId` is stamped on an added entry (Req 26.1).
 */
export function WatchlistScreen({ resources, onBack }: WatchlistScreenProps) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const list = useAsync<PagedData<WatchlistEntry>>(
    (signal) =>
      resources.securityOps.listWatchlist(
        { page, pageSize: DEFAULT_PAGE_SIZE },
        { status: WatchlistStatus.Active },
        { signal },
      ),
    [page],
  );

  const clear = useAsyncAction((id: string) => resources.securityOps.clearWatchlistEntry(id));

  const items = list.data?.items ?? [];

  return (
    <Screen accessibilityLabel="Watchlist">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the gate menu" /> : null}
      <SectionHeading
        title="Watchlist"
        level={1}
        trailing={
          <AppButton title="Add" onPress={() => setAdding(true)} accessibilityHint="Add a watchlist entry" />
        }
      />

      {clear.error ? <FormBanner message={clear.error.message} tone="error" /> : null}

      <AsyncBoundary
        loading={list.loading}
        error={list.error}
        empty={!list.loading && items.length === 0}
        emptyMessage="No active watchlist entries."
        onRetry={list.reload}
      >
        <View style={styles.list}>
          {items.map((e) => (
            <View key={e.id} style={styles.card}>
              <ListRow
                title={e.subjectIdentifier}
                subtitle={`${humanizeCode(e.subjectType)} · ${e.reason}`}
                trailing={<Badge label={humanizeCode(e.severity)} tone={watchlistTone(e.status)} />}
              />
              <AppButton
                title="Clear"
                variant="secondary"
                loading={clear.running}
                onPress={async () => {
                  if (await clear.run(e.id)) {
                    list.reload();
                  }
                }}
                accessibilityHint={`Clear the watchlist entry for ${e.subjectIdentifier}`}
              />
            </View>
          ))}
        </View>
        {list.data ? (
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            totalCount={list.data.totalCount}
            onPageChange={setPage}
            disabled={list.loading}
          />
        ) : null}
      </AsyncBoundary>

      <AddWatchlistModal
        visible={adding}
        resources={resources}
        community={community}
        onPickCommunity={setCommunity}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          setPage(1);
          list.reload();
        }}
      />
    </Screen>
  );
}

function AddWatchlistModal({
  visible,
  resources,
  community,
  onPickCommunity,
  onClose,
  onAdded,
}: {
  visible: boolean;
  resources: ResourceClients;
  community: Community | null;
  onPickCommunity: (c: Community) => void;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [subjectType, setSubjectType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [reason, setReason] = useState('');

  const communities = useAsync<PagedData<Community>>(
    (signal) => resources.communities.list({ pageSize: 50 }, {}, { signal }),
    [],
  );

  const add = useAsyncAction(() => {
    if (!community || !subjectType || !severity) {
      return Promise.reject(new Error('Missing fields'));
    }
    return resources.securityOps.addWatchlistEntry({
      communityId: community.id,
      subjectType,
      severity,
      subjectIdentifier: identifier.trim(),
      reason: reason.trim(),
    });
  });

  const canSubmit =
    Boolean(community) && Boolean(subjectType) && Boolean(severity) && identifier.trim().length > 0 && reason.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={onClose}>
        <Pressable style={styles.sheet} accessibilityViewIsModal>
          <SectionHeading title="Add watchlist entry" />

          {communities.data && communities.data.items.length > 1 ? (
            <View style={styles.communityRow}>
              {communities.data.items.map((c) => (
                <AppButton
                  key={c.id}
                  title={c.name}
                  variant={community?.id === c.id ? 'primary' : 'secondary'}
                  onPress={() => onPickCommunity(c)}
                  accessibilityHint={`Target community ${c.name}`}
                />
              ))}
            </View>
          ) : null}
          {communities.data && communities.data.items.length === 1 && !community ? (
            <SelectSoleCommunity items={communities.data.items} onPick={onPickCommunity} />
          ) : null}

          <MasterDataDropdown
            label="Subject type"
            listKey={GateMasterDataKeys.WatchlistSubjectType}
            masterData={resources.masterData}
            value={subjectType}
            onChange={setSubjectType}
            placeholder="Person or vehicle"
            {...(community ? { communityId: community.id } : {})}
          />
          <AppTextField
            label="Subject identifier"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Name / phone / vehicle number"
            autoCapitalize="characters"
            {...(add.error?.fieldErrors.subjectIdentifier ? { error: add.error.fieldErrors.subjectIdentifier } : {})}
          />
          <MasterDataDropdown
            label="Severity"
            listKey={GateMasterDataKeys.WatchlistSeverity}
            masterData={resources.masterData}
            value={severity}
            onChange={setSeverity}
            placeholder="Select severity"
            {...(community ? { communityId: community.id } : {})}
          />
          <AppTextField
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Why is this subject watchlisted?"
            {...(add.error?.fieldErrors.reason ? { error: add.error.fieldErrors.reason } : {})}
          />

          {add.error && !add.error.fieldErrors.subjectIdentifier && !add.error.fieldErrors.reason ? (
            <FormBanner message={add.error.message} tone="error" />
          ) : null}

          <View style={styles.row}>
            <View style={styles.flex}>
              <AppButton title="Cancel" variant="secondary" disabled={add.running} onPress={onClose} />
            </View>
            <View style={styles.flex}>
              <AppButton
                title="Add"
                loading={add.running}
                disabled={!canSubmit}
                onPress={async () => {
                  if (await add.run()) {
                    onAdded();
                  }
                }}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** When the guard is scoped to a single community, select it automatically so the form is ready. */
function SelectSoleCommunity({ items, onPick }: { items: Community[]; onPick: (c: Community) => void }) {
  const sole = items[0];
  React.useEffect(() => {
    if (sole) {
      onPick(sole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sole?.id]);
  return null;
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: { gap: theme.spacing.xs },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  communityRow: { gap: theme.spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: theme.spacing.lg },
  sheet: {
    backgroundColor: theme.color.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    maxHeight: '90%',
  },
});
