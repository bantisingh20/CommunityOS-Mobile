import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '@/components/ui/FormScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FormBanner } from '@/components/ui/FormBanner';
import { MasterDataDropdown } from '@/components/ui/MasterDataDropdown';
import { useAsyncAction } from '@/hooks';
import { useMyResident } from '@/features/profile/hooks/useMyResident';
import { showSuccessAlert, showErrorAlert } from '@/utils/errorAlert';
import { toFormError, type FormErrorView } from '@/utils/formError';
import { theme } from '@/theme';
import { useAsync } from '@/hooks';
import type { PagedData } from '@/types/envelope';
import type { MaintenanceBill } from '@/types/myTasks';
import type { MaintenanceDefaulter } from '@/services/resources/maintenanceBillsClient';
import type { ResourceClients } from '@/services/resources';

export interface MaintenanceBillsScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

const PAGE_SIZE = 10;

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type BillState = {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly payable: boolean;
};

function billState(bill: MaintenanceBill): BillState {
  if (bill.pendingApproval) {
    return { label: 'Pending approval', tone: 'warning', payable: false };
  }
  switch (bill.status) {
    case 'paid':
      return { label: 'Paid', tone: 'positive', payable: false };
    case 'waived':
      return { label: 'Waived', tone: 'neutral', payable: false };
    case 'partially_paid':
      return { label: 'Partially paid', tone: 'warning', payable: true };
    default:
      return { label: 'Unpaid', tone: 'danger', payable: true };
  }
}

function typeLabel(billType: string): string {
  return billType
    ? billType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Maintenance';
}

function periodLabel(bill: MaintenanceBill): string {
  const period = bill.periodMonth >= 1 && bill.periodMonth <= 12
    ? `${MONTHS[bill.periodMonth]} ${bill.periodYear}`
    : 'One-time';
  const title = bill.label || typeLabel(bill.billType);
  return `${title} · ${period}`;
}

export function MaintenanceBillsScreen({ resources, onBack }: MaintenanceBillsScreenProps) {
  const [mode, setMode] = useState<'mine' | 'defaulters'>('mine');
  const [rows, setRows] = useState<MaintenanceBill[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<FormErrorView | null>(null);
  const [payBill, setPayBill] = useState<MaintenanceBill | null>(null);

  const defaulters = useAsync<MaintenanceDefaulter[]>(
    (signal) => resources.maintenanceBills.defaulters({ signal }),
    [resources],
    { cacheKey: 'maintenance:defaulters' },
  );

  const inFlightRef = useRef(false);
  const hasMore = rows.length < totalCount;

  const loadPage = useCallback(
    async (p: number) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        if (p === 1) { setInitialLoading(true); setError(null); }
        else setLoadingMore(true);
        const list: PagedData<MaintenanceBill> = await resources.maintenanceBills.myBills({ page: p, pageSize: PAGE_SIZE });
        setTotalCount(list.totalCount);
        setPage(p);
        setRows((prev) => (p === 1 ? list.items : [...prev, ...list.items]));
      } catch (e) {
        if (p === 1) setError(toFormError(e));
        else showErrorAlert(e, 'Could not load more');
      } finally {
        inFlightRef.current = false;
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [resources],
  );

  const reload = useCallback(() => { void loadPage(1); }, [loadPage]);
  useEffect(() => { void loadPage(1); }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!inFlightRef.current && !loadingMore && !initialLoading && hasMore) {
      void loadPage(page + 1);
    }
  }, [loadingMore, initialLoading, hasMore, page, loadPage]);

  const renderItem = useCallback(
    ({ item }: { item: MaintenanceBill }) => {
      const state = billState(item);
      return (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle} numberOfLines={1}>{periodLabel(item)}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {state.payable ? `Due ${item.amountDue.toFixed(2)} of ${item.amount.toFixed(2)}` : `Amount ${item.amount.toFixed(2)}`}
              </Text>
              {item.dueDateUtc ? (
                <Text style={styles.cardMeta} numberOfLines={1}>Due {item.dueDateUtc.slice(0, 10)}</Text>
              ) : null}
            </View>
            <Badge label={state.label} tone={state.tone} />
          </View>
          {state.payable ? (
            <AppButton title="Pay now" onPress={() => setPayBill(item)} />
          ) : null}
        </View>
      );
    },
    [],
  );

  return (
    <FormScreen
      title="Maintenance"
      subtitle={totalCount ? `${rows.length} of ${totalCount} bills` : 'Your maintenance bills'}
      noScroll
      {...(onBack ? { onBack } : {})}
    >
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setMode('mine')}
          style={[styles.tab, mode === 'mine' ? styles.tabActive : null]}
        >
          <Text style={[styles.tabText, mode === 'mine' ? styles.tabTextActive : null]}>My bills</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('defaulters')}
          style={[styles.tab, mode === 'defaulters' ? styles.tabActive : null]}
        >
          <Text style={[styles.tabText, mode === 'defaulters' ? styles.tabTextActive : null]}>Unpaid members</Text>
        </Pressable>
      </View>

      {mode === 'defaulters' ? (
        <AsyncBoundary
          loading={defaulters.loading}
          error={defaulters.error}
          empty={!defaulters.loading && (defaulters.data?.length ?? 0) === 0}
          emptyMessage="Everyone is up to date."
          onRetry={defaulters.reload}
        >
          <FlatList
            data={defaulters.data ?? []}
            keyExtractor={(d) => d.unitId}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle} numberOfLines={1}>Unit {item.unitNumber}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>{item.residentName || 'Resident'}</Text>
                  </View>
                  <Badge label={`${item.unpaidCount} unpaid`} tone="warning" />
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            showsVerticalScrollIndicator={false}
          />
        </AsyncBoundary>
      ) : (
      <AsyncBoundary
        loading={initialLoading}
        error={error}
        empty={!initialLoading && rows.length === 0}
        emptyMessage="No maintenance bills yet."
        onRetry={reload}
      >
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <Text style={styles.footer}>Loading more…</Text>
              : hasMore ? <Text style={styles.footer}>Scroll for more</Text>
                : null
          }
          showsVerticalScrollIndicator={false}
        />
      </AsyncBoundary>
      )}

      {payBill ? (
        <PaySheet
          resources={resources}
          bill={payBill}
          onClose={() => setPayBill(null)}
          onDone={() => { setPayBill(null); reload(); }}
        />
      ) : null}
    </FormScreen>
  );
}

function PaySheet({
  resources,
  bill,
  onClose,
  onDone,
}: {
  resources: ResourceClients;
  bill: MaintenanceBill;
  onClose: () => void;
  onDone: () => void;
}) {
  const myResident = useMyResident(resources);
  const communityId = myResident.data?.resident?.communityId ?? bill.communityId;

  const [method, setMethod] = useState<string | null>(null);
  const [reference, setReference] = useState('');

  const pay = useAsyncAction(async () => {
    if (!method) {
      throw new Error('Choose a payment method.');
    }
    await resources.maintenanceBills.submitPayment({
      maintenanceBillId: bill.id,
      amount: bill.amountDue,
      method,
      reference: reference.trim() || undefined,
    });
    showSuccessAlert('Payment sent for approval.', 'Submitted');
  });

  const submit = async () => {
    if (await pay.run()) onDone();
  };

  return (
    <BottomSheet
      visible
      title={`Pay ${bill.amountDue.toFixed(2)}`}
      onClose={onClose}
      footer={<AppButton title="Submit for approval" loading={pay.running} onPress={submit} />}
    >
      {pay.error ? <FormBanner message={pay.error.message} tone="error" /> : null}
      <Text style={styles.payHint}>Your payment is sent to the admin for approval. The bill is marked paid once approved.</Text>
      <MasterDataDropdown
        label="Payment method"
        required
        listKey="Maintenance_Payment_Method"
        masterData={resources.masterData}
        value={method}
        onChange={setMethod}
        communityId={communityId}
      />
      <AppTextField label="Reference (optional)" value={reference} onChangeText={setReference} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.color.accentSoft,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: theme.color.primary },
  tabText: { fontSize: theme.fontSize.label, color: theme.color.text },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { paddingBottom: theme.spacing.xl, paddingTop: theme.spacing.md },
  sep: { height: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadow.soft,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  flex: { flex: 1 },
  cardTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  cardSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },
  cardMeta: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },
  footer: { textAlign: 'center', color: theme.color.mutedText, fontSize: theme.fontSize.caption, paddingVertical: theme.spacing.md },
  payHint: { fontSize: theme.fontSize.label, color: theme.color.mutedText, marginBottom: theme.spacing.sm },
});
