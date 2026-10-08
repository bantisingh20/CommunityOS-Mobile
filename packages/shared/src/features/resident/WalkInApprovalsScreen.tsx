import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { FormBanner } from '../../ui/FormBanner';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { VisitorStatus } from '../../models/gate';
import type { PagedData } from '../../models/envelope';
import type { Visitor } from '../../models/gate';
import type { Resident } from '../../models/resident';
import type { ResourceClients } from '../../resources';
import { gateStatusTone, humanizeCode } from '../shared/status';
import { useMyResident } from './useMyResident';

export interface WalkInApprovalsScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/**
 * Resident walk-in approvals (Req 24.3, 24.4). Lists the pending walk-ins requesting the resident's
 * unit (the visitor list is self-scoped, so a resident sees only their own unit's requests) and lets
 * them approve or reject each. The approving/rejecting resident id is the signed-in resident, derived
 * from the self-scoped list (no `/me`). Approve admits the visitor (gate can then record entry);
 * reject takes an optional reason. On either action the queue reloads so the decided request leaves
 * the pending view.
 */
export function WalkInApprovalsScreen({ resources, onBack }: WalkInApprovalsScreenProps) {
  const me = useMyResident(resources);
  const resident = me.data?.resident ?? null;

  return (
    <FormScreen title="Visitor approvals" subtitle="Walk-ins at your gate" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={me.loading}
        error={me.error}
        empty={!me.loading && resident === null}
        emptyMessage="We couldn't find a resident profile linked to your account."
        onRetry={me.reload}
      >
        {resident ? <PendingList resources={resources} resident={resident} /> : null}
      </AsyncBoundary>
    </FormScreen>
  );
}

function PendingList({ resources, resident }: { resources: ResourceClients; resident: Resident }) {
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Visitor | null>(null);
  const [reason, setReason] = useState('');

  const list = useAsync<PagedData<Visitor>>(
    (signal) =>
      resources.gate.listVisitors({ page, pageSize: DEFAULT_PAGE_SIZE }, { status: VisitorStatus.Pending }, { signal }),
    [page],
  );

  const approve = useAsyncAction((id: string) => resources.gate.approveWalkIn(id, resident.id));
  const reject = useAsyncAction((id: string, r: string) => resources.gate.rejectWalkIn(id, resident.id, r || undefined));

  const items = list.data?.items ?? [];

  const submitReject = async () => {
    if (!rejecting) {
      return;
    }
    if (await reject.run(rejecting.id, reason.trim())) {
      setRejecting(null);
      setReason('');
      list.reload();
    }
  };

  return (
    <>
      {approve.error ? <FormBanner message={approve.error.message} tone="error" /> : null}
      <AsyncBoundary
        loading={list.loading}
        error={list.error}
        empty={!list.loading && items.length === 0}
        emptyMessage="No visitors are waiting for your approval."
        onRetry={list.reload}
      >
        <View style={styles.list}>
          {items.map((v) => (
            <View key={v.id} style={styles.card}>
              <ListRow
                title={v.name}
                subtitle={`${humanizeCode(v.category)}${v.vehicleNumber ? ` · ${v.vehicleNumber}` : ''}${v.gateLocation ? ` · ${v.gateLocation}` : ''}`}
                trailing={<Badge label={humanizeCode(v.status)} tone={gateStatusTone(v.status)} />}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppButton
                    title="Approve"
                    loading={approve.running}
                    disabled={reject.running}
                    onPress={async () => {
                      if (await approve.run(v.id)) {
                        list.reload();
                      }
                    }}
                    accessibilityHint={`Approve ${v.name}`}
                  />
                </View>
                <View style={styles.flex}>
                  <AppButton
                    title="Reject"
                    variant="secondary"
                    disabled={approve.running}
                    onPress={() => {
                      reject.reset();
                      setReason('');
                      setRejecting(v);
                    }}
                    accessibilityHint={`Reject ${v.name}`}
                  />
                </View>
              </View>
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

      <Modal visible={rejecting !== null} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={() => setRejecting(null)}>
          <Pressable style={styles.sheet} accessibilityViewIsModal>
            <SectionHeading title={rejecting ? `Reject ${rejecting.name}` : 'Reject visitor'} />
            <AppTextField
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you rejecting this visitor?"
            />
            {reject.error ? <FormBanner message={reject.error.message} tone="error" /> : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppButton title="Cancel" variant="secondary" disabled={reject.running} onPress={() => setRejecting(null)} />
              </View>
              <View style={styles.flex}>
                <AppButton title="Confirm reject" loading={reject.running} onPress={submitReject} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: { gap: theme.spacing.xs },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: theme.spacing.lg },
  sheet: { backgroundColor: theme.color.background, borderRadius: theme.radius.md, padding: theme.spacing.lg, gap: theme.spacing.md },
});
