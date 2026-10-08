import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { Select, type SelectOption } from '../../ui/Select';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { showSuccessAlert } from '../../ui/errorAlert';
import { emitToast } from '../../ui/toastBus';
import { theme } from '../../ui/theme';
import { MasterDataKeys } from '../../models/masterData';
import type { Community, HierarchyNode, Unit } from '../../models/community';
import type { ResourceClients } from '../../resources';

export interface UnitFormScreenProps {
  resources: ResourceClients;
  community: Community;
  /** Called after a successful create so the caller can refresh + navigate back. */
  onSaved?: (unit: Unit) => void;
  onBack?: () => void;
}

/**
 * Add a unit (flat) to a community (Req 14.1). The admin picks the wing/building it sits under
 * (from the community's hierarchy), the unit number, type and status. Type/status come from the
 * configurable `Unit_Type` / `Unit_Status` lists (never hardcoded); the wing list is loaded from the
 * community's hierarchy. A duplicate unit number in the community surfaces as a friendly conflict
 * popup via {@link useAsyncAction}. Uses the shared {@link FormScreen} scaffold.
 */
export function UnitFormScreen({ resources, community, onSaved, onBack }: UnitFormScreenProps) {
  const wingsQuery = useAsync<HierarchyNode[]>(
    (signal) => resources.hierarchy.listForCommunity(community.id, { signal }),
    [community.id],
  );
  const wingOptions: SelectOption[] = useMemo(
    () => (wingsQuery.data ?? []).map((n) => ({ value: n.id, label: n.name })),
    [wingsQuery.data],
  );

  const [hierarchyNodeId, setHierarchyNodeId] = useState<string | null>(null);
  const [unitNumber, setUnitNumber] = useState('');
  const [unitType, setUnitType] = useState<string | null>('apartment');
  const [unitStatus, setUnitStatus] = useState<string | null>('available');
  const [floor, setFloor] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  const save = useAsyncAction(async () => {
    const beds = bedrooms.trim() ? Number(bedrooms.trim()) : undefined;
    const created = await resources.units.create({
      communityId: community.id,
      ...(hierarchyNodeId ? { hierarchyNodeId } : {}),
      unitNumber: unitNumber.trim(),
      unitType: unitType!,
      unitStatus: unitStatus!,
      ...(floor.trim() ? { floor: floor.trim() } : {}),
      ...(beds !== undefined && !Number.isNaN(beds) ? { bedrooms: beds } : {}),
    });
    showSuccessAlert('Unit added.');
    onSaved?.(created);
  });

  const fail = (msg: string) => { setValidation(msg); emitToast({ tone: 'error', title: 'Check the form', message: msg }); };

  const onSubmit = () => {
    if (!unitNumber.trim()) { fail('Please enter a unit number (e.g. C-409).'); return; }
    if (!unitType) { fail('Please choose a unit type.'); return; }
    if (!unitStatus) { fail('Please choose a unit status.'); return; }
    if (bedrooms.trim() && Number.isNaN(Number(bedrooms.trim()))) { fail('Bedrooms must be a number.'); return; }
    setValidation(null);
    void save.run();
  };

  return (
    <FormScreen title="Add unit" subtitle={community.name} {...(onBack ? { onBack } : {})}>
      <FormSection title="Location" icon="git-branch" tint="#8250df">
        <Select
          label="Wing / building"
          value={hierarchyNodeId}
          options={wingOptions}
          onChange={setHierarchyNodeId}
          placeholder={wingsQuery.loading ? 'Loading…' : 'Choose a wing (optional)'}
          allowClear
          clearLabel="None"
        />
        <AppTextField
          label="Floor"
          value={floor}
          onChangeText={setFloor}
          placeholder="e.g. 4"
        />
      </FormSection>

      <FormSection title="Unit details" icon="home" tint={theme.color.info}>
        <AppTextField
          label="Unit number"
          required
          value={unitNumber}
          onChangeText={setUnitNumber}
          placeholder="e.g. C-409"
          autoCapitalize="characters"
        />
        <MasterDataDropdown
          label="Unit type"
          required
          listKey={MasterDataKeys.UnitType}
          masterData={resources.masterData}
          value={unitType}
          onChange={setUnitType}
          communityId={community.id}
        />
        <MasterDataDropdown
          label="Status"
          required
          listKey={MasterDataKeys.UnitStatus}
          masterData={resources.masterData}
          value={unitStatus}
          onChange={setUnitStatus}
          communityId={community.id}
        />
        <AppTextField
          label="Bedrooms"
          value={bedrooms}
          onChangeText={setBedrooms}
          placeholder="e.g. 3"
          keyboardType="number-pad"
        />
      </FormSection>

      {validation ? <Text style={styles.error} accessibilityLiveRegion="polite">{validation}</Text> : null}

      <View style={styles.actions}>
        <AppButton title="Add unit" onPress={onSubmit} loading={save.running} accessibilityHint="Creates the unit" />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: theme.fontSize.label, color: theme.color.danger },
  actions: { marginTop: theme.spacing.md },
});
