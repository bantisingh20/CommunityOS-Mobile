import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { FormBanner } from '../../ui/FormBanner';
import { LinkButton } from '../../ui/LinkButton';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { MaintenanceMasterDataKeys, WorkOrderStatus } from '../../models/maintenance';
import type { WorkOrder, WorkOrderPart, WorkOrderLabour } from '../../models/maintenance';
import type { ResourceClients } from '../../resources';
import { workOrderStatusTone, humanizeCode } from '../shared/status';

export interface WorkOrderDetailScreenProps {
  resources: ResourceClients;
  workOrderId: string;
  /** The row the staff tapped, shown immediately while the fresh copy loads. */
  initialWorkOrder?: WorkOrder;
  onBack?: () => void;
}

/**
 * Staff work-order detail (Req 36.3, 36.4). The assigned maintenance staff see the work order's
 * current status/priority/assignment, then: change its status through the configurable
 * `Work_Order_Status` transition (an illegal transition is rejected server-side), assign/re-assign it
 * to a staff user, and record parts + labour against it (Req 36.4 — line/labour totals are computed
 * server-side). Parts and labour re-fetch after each add so the running list + totals stay current.
 * Reuses the shared accessible primitives + {@link MasterDataDropdown} (no hardcoded status list).
 *
 * <p>Assignment takes the assignee's user id directly: there is no staff-user search client in the
 * shared package yet (ponytail: YAGNI — don't build a user-directory screen for one field; the
 * server validates the id names a valid staff assignee and returns a field error otherwise).</p>
 */
export function WorkOrderDetailScreen({ resources, workOrderId, initialWorkOrder, onBack }: WorkOrderDetailScreenProps) {
  const { data, loading, error, reload } = useAsync<WorkOrder>(
    (signal) => resources.maintenance.getWorkOrder(workOrderId, { signal }),
    [workOrderId],
  );
  const partsState = useAsync<WorkOrderPart[]>(
    (signal) => resources.maintenance.getWorkOrderParts(workOrderId, { signal }),
    [workOrderId],
  );
  const labourState = useAsync<WorkOrderLabour[]>(
    (signal) => resources.maintenance.getWorkOrderLabour(workOrderId, { signal }),
    [workOrderId],
  );

  const workOrder = data ?? initialWorkOrder ?? null;

  // --- Status change ---
  const [toStatus, setToStatus] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const changeStatus = useAsyncAction(() => {
    if (!toStatus) {
      return Promise.reject(new Error('Select a status'));
    }
    return resources.maintenance
      .changeWorkOrderStatus(workOrderId, {
        toStatus,
        ...(toStatus === WorkOrderStatus.Completed && completionNotes.trim()
          ? { completionNotes: completionNotes.trim() }
          : {}),
      })
      .then((w) => {
        setToStatus(null);
        setCompletionNotes('');
        reload();
        return w;
      });
  });

  // --- Assignment ---
  const [assignee, setAssignee] = useState('');
  const assign = useAsyncAction(() => {
    if (!assignee.trim()) {
      return Promise.reject(new Error('Enter an assignee'));
    }
    return resources.maintenance.assignWorkOrder(workOrderId, { assignedToUserId: assignee.trim() }).then((w) => {
      setAssignee('');
      reload();
      return w;
    });
  });

  // --- Add part ---
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partQty, setPartQty] = useState('');
  const [partUnitCost, setPartUnitCost] = useState('');
  const addPart = useAsyncAction(() => {
    const quantity = Number(partQty);
    const unitCost = Number(partUnitCost);
    if (!partName.trim() || Number.isNaN(quantity) || Number.isNaN(unitCost)) {
      return Promise.reject(new Error('Enter a part name, quantity and unit cost'));
    }
    return resources.maintenance
      .addWorkOrderPart(workOrderId, {
        partName: partName.trim(),
        ...(partNumber.trim() ? { partNumber: partNumber.trim() } : {}),
        quantity,
        unitCost,
      })
      .then((p) => {
        setPartName('');
        setPartNumber('');
        setPartQty('');
        setPartUnitCost('');
        partsState.reload();
        return p;
      });
  });

  // --- Add labour ---
  const [workerName, setWorkerName] = useState('');
  const [hours, setHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [labourNotes, setLabourNotes] = useState('');
  const addLabour = useAsyncAction(() => {
    const h = Number(hours);
    const rate = Number(hourlyRate);
    if (!workerName.trim() || Number.isNaN(h) || Number.isNaN(rate)) {
      return Promise.reject(new Error('Enter a worker name, hours and hourly rate'));
    }
    return resources.maintenance
      .addWorkOrderLabour(workOrderId, {
        workerName: workerName.trim(),
        hours: h,
        hourlyRate: rate,
        ...(labourNotes.trim() ? { notes: labourNotes.trim() } : {}),
      })
      .then((l) => {
        setWorkerName('');
        setHours('');
        setHourlyRate('');
        setLabourNotes('');
        labourState.reload();
        return l;
      });
  });

  const parts = partsState.data ?? [];
  const labour = labourState.data ?? [];

  return (
    <Screen accessibilityLabel="Work order detail">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the work order list" /> : null}

      <AsyncBoundary
        loading={loading && !workOrder}
        error={workOrder ? null : error}
        empty={!loading && !workOrder}
        emptyMessage="This work order could not be loaded."
        onRetry={reload}
      >
        {workOrder ? (
          <>
            <SectionHeading title={workOrder.title} level={1} />
            <ListRow
              title={humanizeCode(workOrder.workOrderType)}
              subtitle={`${humanizeCode(workOrder.priority)} priority`}
              trailing={<Badge label={humanizeCode(workOrder.status)} tone={workOrderStatusTone(workOrder.status)} />}
            />
            <ListRow title="Description" subtitle={workOrder.description} />
            {workOrder.assignedToUserId ? (
              <ListRow title="Assigned to" subtitle={workOrder.assignedToUserId} />
            ) : null}
            {workOrder.completedAtUtc ? (
              <ListRow title="Completed" subtitle={formatDateTime(workOrder.completedAtUtc)} />
            ) : null}
            {workOrder.completionNotes ? (
              <ListRow title="Completion notes" subtitle={workOrder.completionNotes} />
            ) : null}

            {/* Status change */}
            <SectionHeading title="Change status" />
            <MasterDataDropdown
              label="New status"
              listKey={MaintenanceMasterDataKeys.WorkOrderStatus}
              masterData={resources.masterData}
              value={toStatus}
              onChange={setToStatus}
              placeholder="Select the next status"
            />
            {toStatus === WorkOrderStatus.Completed ? (
              <AppTextField
                label="Completion notes (optional)"
                value={completionNotes}
                onChangeText={setCompletionNotes}
                placeholder="What was done"
                autoCapitalize="sentences"
              />
            ) : null}
            {changeStatus.error ? <FormBanner message={changeStatus.error.message} tone="error" /> : null}
            <AppButton
              title="Update status"
              loading={changeStatus.running}
              disabled={!toStatus}
              onPress={() => changeStatus.run()}
              accessibilityHint="Change this work order's status"
            />

            {/* Assignment */}
            <SectionHeading title="Assign" />
            <AppTextField
              label="Assignee user id"
              value={assignee}
              onChangeText={setAssignee}
              placeholder="Maintenance staff user id"
              autoCapitalize="none"
              {...(assign.error?.fieldErrors.assignedToUserId ? { error: assign.error.fieldErrors.assignedToUserId } : {})}
            />
            {assign.error && !assign.error.fieldErrors.assignedToUserId ? (
              <FormBanner message={assign.error.message} tone="error" />
            ) : null}
            <AppButton
              title="Assign work order"
              variant="secondary"
              loading={assign.running}
              disabled={assignee.trim().length === 0}
              onPress={() => assign.run()}
              accessibilityHint="Assign or re-assign this work order"
            />

            {/* Parts */}
            <SectionHeading title="Parts" />
            <AsyncBoundary
              loading={partsState.loading}
              error={partsState.error}
              empty={!partsState.loading && parts.length === 0}
              emptyMessage="No parts recorded yet."
              onRetry={partsState.reload}
            >
              <View style={styles.list}>
                {parts.map((p) => (
                  <ListRow
                    key={p.id}
                    title={p.partName}
                    subtitle={`${p.quantity} × ${p.unitCost}${p.partNumber ? ` · ${p.partNumber}` : ''}`}
                    trailing={<Badge label={String(p.lineTotal)} tone="neutral" />}
                  />
                ))}
              </View>
            </AsyncBoundary>
            <AppTextField label="Part name" value={partName} onChangeText={setPartName} placeholder="e.g. Pump seal" autoCapitalize="sentences" />
            <AppTextField label="Part number (optional)" value={partNumber} onChangeText={setPartNumber} placeholder="SKU / reference" autoCapitalize="characters" />
            <AppTextField label="Quantity" value={partQty} onChangeText={setPartQty} placeholder="0" keyboardType="numeric" />
            <AppTextField label="Unit cost" value={partUnitCost} onChangeText={setPartUnitCost} placeholder="0.00" keyboardType="numeric" />
            {addPart.error ? <FormBanner message={addPart.error.message} tone="error" /> : null}
            <AppButton
              title="Add part"
              variant="secondary"
              loading={addPart.running}
              onPress={() => addPart.run()}
              accessibilityHint="Record a part used on this work order"
            />

            {/* Labour */}
            <SectionHeading title="Labour" />
            <AsyncBoundary
              loading={labourState.loading}
              error={labourState.error}
              empty={!labourState.loading && labour.length === 0}
              emptyMessage="No labour recorded yet."
              onRetry={labourState.reload}
            >
              <View style={styles.list}>
                {labour.map((l) => (
                  <ListRow
                    key={l.id}
                    title={l.workerName}
                    subtitle={`${l.hours}h × ${l.hourlyRate}${l.notes ? ` · ${l.notes}` : ''}`}
                    trailing={<Badge label={String(l.labourCost)} tone="neutral" />}
                  />
                ))}
              </View>
            </AsyncBoundary>
            <AppTextField label="Worker name" value={workerName} onChangeText={setWorkerName} placeholder="Technician name" autoCapitalize="words" />
            <AppTextField label="Hours" value={hours} onChangeText={setHours} placeholder="0" keyboardType="numeric" />
            <AppTextField label="Hourly rate" value={hourlyRate} onChangeText={setHourlyRate} placeholder="0.00" keyboardType="numeric" />
            <AppTextField label="Notes (optional)" value={labourNotes} onChangeText={setLabourNotes} placeholder="What was done" autoCapitalize="sentences" />
            {addLabour.error ? <FormBanner message={addLabour.error.message} tone="error" /> : null}
            <AppButton
              title="Add labour"
              variant="secondary"
              loading={addLabour.running}
              onPress={() => addLabour.run()}
              accessibilityHint="Record a labour entry on this work order"
            />
          </>
        ) : null}
      </AsyncBoundary>
    </Screen>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
});
