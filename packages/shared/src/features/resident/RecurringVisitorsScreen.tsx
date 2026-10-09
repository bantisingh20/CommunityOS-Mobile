import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { FormBanner } from '../../ui/FormBanner';
import { Select } from '../../ui/Select';
import { Toggle } from '../../ui/Toggle';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import { GateMasterDataKeys, RecurringVisitorStatus } from '../../models/gate';
import type { PagedData } from '../../models/envelope';
import type { RecurringVisitor } from '../../models/gate';
import type { Resident, ResidentHouseholdUnit } from '../../models/resident';
import type { ResourceClients } from '../../resources';
import { gateStatusTone, humanizeCode } from '../shared/status';
import { useMyResident } from './useMyResident';

export interface RecurringVisitorsScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/** Days of the week with their bit value in the 7-bit mask (Sun=1 … Sat=64), matching the backend. */
const DAYS: readonly { label: string; bit: number }[] = [
  { label: 'Sun', bit: 1 },
  { label: 'Mon', bit: 2 },
  { label: 'Tue', bit: 4 },
  { label: 'Wed', bit: 8 },
  { label: 'Thu', bit: 16 },
  { label: 'Fri', bit: 32 },
  { label: 'Sat', bit: 64 },
];

/**
 * Resident recurring visitors (Req 25.2). Lists the resident's active recurring authorizations and
 * lets them create a new one (name, category, host unit, a day-of-week mask and a valid date range)
 * or revoke an existing one. The host unit comes from the resident's own units and the defining
 * resident id from the self-scoped list. Category options are the configurable `Visitor_Category`
 * list (not hardcoded). The day mask mirrors the backend's 7-bit value (Sun=1 … Sat=64).
 */
export function RecurringVisitorsScreen({ resources, onBack }: RecurringVisitorsScreenProps) {
  const me = useMyResident(resources);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const list = useAsync<PagedData<RecurringVisitor>>(
    (signal) =>
      resources.gate.listRecurringVisitors(
        { page, pageSize: DEFAULT_PAGE_SIZE },
        { status: RecurringVisitorStatus.Active },
        { signal },
      ),
    [page],
  );

  const revoke = useAsyncAction((id: string) => resources.gate.revokeRecurringVisitor(id));

  const items = list.data?.items ?? [];

  const headerRight = (
    <Pressable
      onPress={() => setAdding(true)}
      disabled={!resident || units.length === 0}
      accessibilityRole="button"
      accessibilityLabel="Add a recurring visitor"
      hitSlop={8}
    >
      <Text style={styles.headerAdd}>+ Add</Text>
    </Pressable>
  );

  return (
    <FormScreen title="Recurring visitors" {...(onBack ? { onBack } : {})} headerRight={headerRight}>
      {revoke.error ? <FormBanner message={revoke.error.message} tone="error" /> : null}

      <AsyncBoundary
        loading={list.loading || me.loading}
        error={list.error ?? me.error}
        empty={!list.loading && items.length === 0}
        emptyMessage="No active recurring visitors."
        onRetry={() => {
          list.reload();
          me.reload();
        }}
      >
        <View style={styles.list}>
          {items.map((r) => (
            <View key={r.id} style={styles.card}>
              <ListRow
                title={r.name}
                subtitle={`${humanizeCode(r.category)} · ${describeDays(r.daysOfWeek)}`}
                trailing={<Badge label={humanizeCode(r.status)} tone={gateStatusTone(r.status)} />}
              />
              <AppButton
                title="Revoke"
                variant="secondary"
                loading={revoke.running}
                onPress={async () => {
                  if (await revoke.run(r.id)) {
                    list.reload();
                  }
                }}
                accessibilityHint={`Revoke the recurring authorization for ${r.name}`}
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

      {resident ? (
        <AddRecurringModal
          visible={adding}
          resources={resources}
          resident={resident}
          units={units}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setPage(1);
            list.reload();
          }}
        />
      ) : null}
    </FormScreen>
  );
}

function AddRecurringModal({
  visible,
  resources,
  resident,
  units,
  onClose,
  onAdded,
}: {
  visible: boolean;
  resources: ResourceClients;
  resident: Resident;
  units: ResidentHouseholdUnit[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [unitId, setUnitId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [dayMask, setDayMask] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!unitId && units.length === 1 && units[0]) {
      setUnitId(units[0].unitId);
    }
  }, [units, unitId]);

  const add = useAsyncAction(() => {
    if (!unitId || !category) {
      return Promise.reject(new Error('Missing fields'));
    }
    return resources.gate.createRecurringVisitor({
      hostUnitId: unitId,
      hostResidentId: resident.id,
      name: name.trim(),
      category,
      daysOfWeek: dayMask,
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
    });
  });

  const canSubmit =
    Boolean(unitId) && name.trim().length > 0 && Boolean(category) && dayMask > 0 && isDate(startDate) && isDate(endDate);

  const unitOptions = units.map((u) => ({ value: u.unitId, label: `Unit ${u.unitNumber}` }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={onClose}>
        <Pressable style={styles.sheet} accessibilityViewIsModal>
          <SectionHeading title="Add recurring visitor" />

          {unitOptions.length > 1 ? (
            <Select label="Host unit" value={unitId} options={unitOptions} onChange={setUnitId} placeholder="Select your unit" />
          ) : null}

          <AppTextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Recurring visitor's name"
            autoCapitalize="words"
            {...(add.error?.fieldErrors.name ? { error: add.error.fieldErrors.name } : {})}
          />
          <MasterDataDropdown
            label="Category"
            listKey={GateMasterDataKeys.VisitorCategory}
            masterData={resources.masterData}
            value={category}
            onChange={setCategory}
            placeholder="Select a visitor category"
          />

          <SectionHeading title="Days" />
          <View style={styles.days}>
            {DAYS.map((d) => (
              <Toggle
                key={d.bit}
                label={d.label}
                value={(dayMask & d.bit) !== 0}
                onValueChange={(on) => setDayMask((m) => (on ? m | d.bit : m & ~d.bit))}
                testID={`day-${d.label}`}
              />
            ))}
          </View>

          <AppTextField
            label="Start date (YYYY-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-01-01"
            autoCapitalize="none"
            {...(add.error?.fieldErrors.startDate ? { error: add.error.fieldErrors.startDate } : {})}
          />
          <AppTextField
            label="End date (YYYY-MM-DD)"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-12-31"
            autoCapitalize="none"
            {...(add.error?.fieldErrors.endDate ? { error: add.error.fieldErrors.endDate } : {})}
          />

          {add.error && !hasFieldError(add.error.fieldErrors) ? (
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

/** Human description of a day mask, e.g. 42 → "Mon, Wed, Fri". */
function describeDays(mask: number): string {
  const names = DAYS.filter((d) => (mask & d.bit) !== 0).map((d) => d.label);
  return names.length ? names.join(', ') : 'No days';
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Normalize a `YYYY-MM-DD` input to an ISO-8601 UTC midnight the backend `DateTime` accepts. */
function toIsoDate(value: string): string {
  return `${value.trim()}T00:00:00Z`;
}

function hasFieldError(map: Readonly<Record<string, string>>): boolean {
  return ['name', 'startDate', 'endDate'].some((k) => Boolean(map[k]));
}

const styles = StyleSheet.create({
  headerAdd: { color: theme.color.primaryText, fontSize: theme.fontSize.label, fontWeight: '800' },
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: { gap: theme.spacing.xs },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  flex: { flex: 1 },
  days: { gap: theme.spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: theme.spacing.lg },
  sheet: {
    backgroundColor: theme.color.background,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    maxHeight: '90%',
  },
});
