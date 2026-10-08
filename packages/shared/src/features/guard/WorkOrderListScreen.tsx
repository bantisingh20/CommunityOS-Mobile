import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { LinkButton } from '../../ui/LinkButton';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { MaintenanceMasterDataKeys } from '../../models/maintenance';
import type { PagedData } from '../../models/envelope';
import type { WorkOrder } from '../../models/maintenance';
import type { ResourceClients } from '../../resources';
import { workOrderStatusTone, humanizeCode } from '../shared/status';
import { WorkOrderDetailScreen } from './WorkOrderDetailScreen';

export interface WorkOrderListScreenProps {
  resources: ResourceClients;
  /** Narrow the list to one asset's work orders (e.g. opened from the asset lookup). */
  assetId?: string;
  /** Optional heading override, e.g. when scoped to one asset. */
  title?: string;
  onBack?: () => void;
}

type WorkOrderView = { name: 'list' } | { name: 'detail'; workOrder: WorkOrder };

/**
 * Staff work-order list (Req 36.2, 36.3). Lists the maintenance work orders in the staff member's
 * authorized communities, newest-first and paginated, with a configurable-status filter (from the
 * `Work_Order_Status` master-data list — never a hardcoded list). Tapping one opens its detail
 * (status/assign/parts/labour) through a small internal view switch so the app navigator keeps a
 * single route. An optional `assetId` narrows the list to one asset's orders. The list is
 * tenant-scoped server-side. Mirrors {@link ParcelListScreen}.
 */
export function WorkOrderListScreen({ resources, assetId, title, onBack }: WorkOrderListScreenProps) {
  const [view, setView] = useState<WorkOrderView>({ name: 'list' });
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync<PagedData<WorkOrder>>(
    (signal) =>
      resources.maintenance.listWorkOrders(
        { page, pageSize: DEFAULT_PAGE_SIZE, sort: '-createdAtUtc' },
        { ...(status ? { status } : {}), ...(assetId ? { assetId } : {}) },
        { signal },
      ),
    [page, status, assetId],
  );

  if (view.name === 'detail') {
    return (
      <WorkOrderDetailScreen
        resources={resources}
        workOrderId={view.workOrder.id}
        initialWorkOrder={view.workOrder}
        onBack={() => {
          setView({ name: 'list' });
          reload();
        }}
      />
    );
  }

  const items = data?.items ?? [];

  return (
    <Screen accessibilityLabel="Work orders">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the maintenance menu" /> : null}
      <SectionHeading title={title ?? 'Work orders'} level={1} />

      <MasterDataDropdown
        label="Filter by status"
        listKey={MaintenanceMasterDataKeys.WorkOrderStatus}
        masterData={resources.masterData}
        value={status}
        onChange={(s) => {
          setPage(1);
          setStatus(s);
        }}
        placeholder="All statuses"
        allowClear
        clearLabel="All statuses"
      />

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="No work orders match."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((w) => (
            <ListRow
              key={w.id}
              title={w.title}
              subtitle={`${humanizeCode(w.workOrderType)} · ${humanizeCode(w.priority)} · raised ${formatDate(w.createdAtUtc)}`}
              trailing={<Badge label={humanizeCode(w.status)} tone={workOrderStatusTone(w.status)} />}
              onPress={() => setView({ name: 'detail', workOrder: w })}
              accessibilityHint={`Open work order ${w.title}`}
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
});
