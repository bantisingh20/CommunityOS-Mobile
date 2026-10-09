import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { FormBanner } from '../../ui/FormBanner';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import type { PagedData } from '../../models/envelope';
import type { EntryExitEvent } from '../../models/gate';
import type { ResourceClients, GateOfflineQueue, QueuedGateCapture, RecordExitBody } from '../../resources';
import { ApiRequestError } from '../../api/errors';
import { humanizeCode } from '../shared/status';

export interface EntryExitLogScreenProps {
  resources: ResourceClients;
  /**
   * Optional offline queue (Task 17.1 offline-aware). When supplied, an exit that fails as a
   * transport error is queued and re-sent on the next flush with its stable idempotency key
   * (at-most-once). When absent the screen still works online — it just won't buffer.
   */
  offlineQueue?: GateOfflineQueue;
  onBack?: () => void;
}

type Filter = 'onsite' | 'all';

/**
 * Guard entry/exit log + exit capture (Req 25.3, 25.4, 25.5) — redesigned to the shared card style.
 * Defaults to the "on-site" view (visitors with an open entry, no exit yet) so a guard can close out
 * a leaving visitor in one tap. The record-exit write is offline-aware: a transport failure queues it
 * (stable idempotency key) and flushes on reconnect, so a dropped signal never loses or double-records
 * an exit (Req 63.3). A segmented control switches to the full chronological log.
 */
export function EntryExitLogScreen({ resources, offlineQueue, onBack }: EntryExitLogScreenProps) {
  const [filter, setFilter] = useState<Filter>('onsite');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueuedGateCapture[]>([]);

  const { data, loading, error, reload } = useAsync<PagedData<EntryExitEvent>>(
    (signal) =>
      resources.gate.listEntryExitEvents(
        { page, pageSize: DEFAULT_PAGE_SIZE, sort: '-entryTsUtc' },
        filter === 'onsite' ? { open: true } : {},
        { signal },
      ),
    [filter, page],
  );

  // Load any buffered exits awaiting sync, and try to flush them on mount.
  useEffect(() => {
    let active = true;
    if (!offlineQueue) {
      return;
    }
    (async () => {
      await offlineQueue.flush().catch(() => undefined);
      const pending = await offlineQueue.list();
      if (active) {
        setQueued(pending);
      }
    })();
    return () => {
      active = false;
    };
  }, [offlineQueue]);

  const exit = useAsyncAction((body: RecordExitBody) => recordExit(body));

  async function recordExit(body: RecordExitBody): Promise<unknown> {
    try {
      const event = await resources.gate.recordExit(body);
      setNotice('Exit recorded.');
      reload();
      return event;
    } catch (err) {
      // Transport failure + a queue available → buffer it and surface that it will sync.
      if (offlineQueue && isTransient(err)) {
        await offlineQueue.enqueue('exit', body);
        setQueued(await offlineQueue.list());
        setNotice('Offline — exit saved and will sync when back online.');
        return undefined;
      }
      throw err;
    }
  }

  const flushNow = useAsyncAction(async () => {
    if (!offlineQueue) {
      return;
    }
    const result = await offlineQueue.flush();
    setQueued(await offlineQueue.list());
    setNotice(result.synced > 0 ? `Synced ${result.synced} buffered exit(s).` : 'Nothing new to sync.');
    reload();
  });

  const items = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  const switchFilter = (f: Filter) => {
    setPage(1);
    setFilter(f);
    setNotice(null);
  };

  return (
    <FormScreen
      title="Entry / exit"
      subtitle={filter === 'onsite' ? (total ? `${total} on-site now` : 'Who is on-site') : 'Full gate log'}
      {...(onBack ? { onBack } : {})}
    >
      <View style={styles.segment} accessibilityRole="tablist">
        <SegTab label="On-site" active={filter === 'onsite'} onPress={() => switchFilter('onsite')} />
        <SegTab label="All" active={filter === 'all'} onPress={() => switchFilter('all')} />
      </View>

      {notice ? <FormBanner message={notice} tone="success" /> : null}
      {exit.error ? <FormBanner message={exit.error.message} tone="error" /> : null}

      {offlineQueue && queued.length > 0 ? (
        <View style={styles.pending}>
          <FormBanner message={`${queued.length} exit(s) waiting to sync.`} tone="error" />
          <AppButton
            title="Sync now"
            variant="secondary"
            loading={flushNow.running}
            onPress={() => flushNow.run()}
            accessibilityHint="Try to send buffered exits now"
          />
        </View>
      ) : null}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage={filter === 'onsite' ? 'No visitors are currently on-site.' : 'No entry or exit events yet.'}
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((e) => {
            const onSite = e.exitTsUtc === null;
            return (
              <View key={e.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconTile, { backgroundColor: onSite ? `${theme.color.warning}1f` : '#eef1f5' }]}>
                    <Ionicons
                      name={onSite ? 'walk' : 'exit-outline'}
                      size={22}
                      color={onSite ? theme.color.warning : theme.color.mutedText}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{e.visitorName}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {humanizeCode(e.category)} · in {formatTime(e.entryTsUtc)}
                      {e.exitTsUtc ? ` · out ${formatTime(e.exitTsUtc)}` : ''}
                    </Text>
                  </View>
                  <Badge label={onSite ? 'On-site' : 'Left'} tone={onSite ? 'warning' : 'neutral'} />
                </View>
                {onSite ? (
                  <AppButton
                    title="Record exit"
                    variant="secondary"
                    loading={exit.running}
                    onPress={() => {
                      setNotice(null);
                      exit.run(exitBodyFor(e));
                    }}
                    accessibilityHint={`Record ${e.visitorName}'s exit`}
                  />
                ) : null}
              </View>
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

/** A pill tab in the segmented filter. */
function SegTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.segTab, active ? styles.segTabActive : null]}
    >
      <Text style={[styles.segText, active ? styles.segTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

/** Build the exit body carrying the SAME authorization the open entry used (Req 25.3). */
function exitBodyFor(e: EntryExitEvent): RecordExitBody {
  return {
    ...(e.visitorId ? { visitorId: e.visitorId } : {}),
    ...(e.visitPassId ? { visitPassId: e.visitPassId } : {}),
    ...(e.recurringVisitorId ? { recurringVisitorId: e.recurringVisitorId } : {}),
    ...(e.gateId ? { gateId: e.gateId } : {}),
    ...(e.gateLabel ? { gateLabel: e.gateLabel } : {}),
  };
}

function isTransient(err: unknown): boolean {
  return err instanceof ApiRequestError ? err.httpStatus === 0 || err.code === 'INTEGRATION_FAILURE' : true;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.pill,
    padding: 4,
    ...theme.shadow.soft,
  },
  segTab: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  segTabActive: { backgroundColor: theme.color.primary },
  segText: { fontSize: theme.fontSize.label, fontWeight: '700', color: theme.color.mutedText },
  segTextActive: { color: theme.color.primaryText },
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadow.soft,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconTile: { width: 48, height: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  cardSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },
  pending: { gap: theme.spacing.sm },
});
