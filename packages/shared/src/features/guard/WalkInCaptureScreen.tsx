import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { EntityCard } from '../../ui/EntityCard';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsyncAction } from '../../ui/hooks';
import { emitToast } from '../../ui/toastBus';
import { theme } from '../../ui/theme';
import { GateMasterDataKeys } from '../../models/gate';
import type { Unit } from '../../models/community';
import type { Visitor } from '../../models/gate';
import type { ResourceClients } from '../../resources';
import { gateStatusTone, humanizeCode } from '../shared/status';
import { UnitPicker } from './UnitPicker';

export interface WalkInCaptureScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/** Raise a client-side validation toast (native-app style — no inline error UI). */
function warn(message: string): void {
  emitToast({ tone: 'error', title: 'Check the form', message });
}

/**
 * Guard walk-in capture (Req 24.1, 24.3, 24.5). The guard picks the host unit and captures the
 * visitor's details for the record — identity (name/phone/category), ID proof (type + number),
 * why they're here (purpose, whom to meet, expected duration) and vehicle — then registers the
 * walk-in. It starts PENDING and the host residents are notified to approve; entry stays withheld
 * until then (Req 24.5), which the success state makes explicit.
 *
 * All option lists (category, ID-proof type) are data-driven via {@link MasterDataDropdown}
 * (steering: no hardcoding). Validation surfaces as toasts, not inline banners.
 */
export function WalkInCaptureScreen({ resources, onBack }: WalkInCaptureScreenProps) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [idProofType, setIdProofType] = useState<string | null>(null);
  const [idProofNumber, setIdProofNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [whomToMeet, setWhomToMeet] = useState('');
  const [duration, setDuration] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [registered, setRegistered] = useState<Visitor | null>(null);

  const register = useAsyncAction(() => {
    const durationMinutes = duration.trim() ? Number(duration.trim()) : undefined;
    return resources.gate
      .registerWalkIn({
        hostUnitId: unit!.id,
        name: name.trim(),
        category: category!,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(idProofType ? { idProofType } : {}),
        ...(idProofNumber.trim() ? { idProofNumber: idProofNumber.trim() } : {}),
        ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
        ...(whomToMeet.trim() ? { whomToMeet: whomToMeet.trim() } : {}),
        ...(durationMinutes !== undefined ? { expectedDurationMinutes: durationMinutes } : {}),
        ...(vehicle.trim() ? { vehicleNumber: vehicle.trim() } : {}),
      })
      .then((v) => {
        setRegistered(v);
        return v;
      });
  });

  const reset = () => {
    setRegistered(null);
    setName('');
    setPhone('');
    setCategory(null);
    setIdProofType(null);
    setIdProofNumber('');
    setPurpose('');
    setWhomToMeet('');
    setDuration('');
    setVehicle('');
    register.reset();
  };

  const onSubmit = () => {
    if (!unit) { warn('Pick the host unit the visitor is here for.'); return; }
    if (!name.trim()) { warn('Enter the visitor\u2019s name.'); return; }
    if (!category) { warn('Select a visitor category.'); return; }
    const trimmed = duration.trim();
    if (trimmed) {
      const minutes = Number(trimmed);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        warn('Expected duration must be a whole number of minutes greater than zero.');
        return;
      }
    }
    void register.run();
  };

  if (registered) {
    return (
      <FormScreen title="Walk-in registered" subtitle="Sent to the resident for approval" {...(onBack ? { onBack } : {})}>
        <FormSection title="Status" icon="checkmark-circle" tint={theme.color.success}>
          <Text style={styles.note}>
            Registered and sent to the resident for approval. Hold the visitor at the gate until it&apos;s approved.
          </Text>
          <EntityCard
            icon="person"
            title={registered.name}
            meta={[
              { icon: 'pricetag', label: humanizeCode(registered.category) },
              ...(registered.whomToMeet ? [{ icon: 'people' as const, label: `To meet: ${registered.whomToMeet}` }] : []),
              ...(registered.vehicleNumber ? [{ icon: 'car' as const, label: registered.vehicleNumber }] : []),
            ]}
            badge={{ label: humanizeCode(registered.status), tone: gateStatusTone(registered.status) }}
          />
        </FormSection>
        <View style={styles.actions}>
          <AppButton title="Register another" onPress={reset} accessibilityHint="Capture another walk-in" />
        </View>
      </FormScreen>
    );
  }

  const busy = register.running;

  return (
    <FormScreen title="Register walk-in" subtitle="Capture the visitor's details" {...(onBack ? { onBack } : {})}>
      <FormSection title="Host unit" icon="home" tint={theme.color.info}>
        <UnitPicker resources={resources} value={unit} onSelect={setUnit} />
      </FormSection>

      <FormSection title="Visitor" icon="person" tint={theme.color.primary}>
        <AppTextField
          label="Name"
          required
          value={name}
          onChangeText={setName}
          placeholder="Visitor's name"
          autoCapitalize="words"
          editable={!busy}
        />
        <AppTextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="Contact number"
          keyboardType="phone-pad"
          editable={!busy}
        />
        <MasterDataDropdown
          label="Category"
          required
          listKey={GateMasterDataKeys.VisitorCategory}
          masterData={resources.masterData}
          {...(unit ? { communityId: unit.communityId } : {})}
          value={category}
          onChange={setCategory}
          placeholder="Select a visitor category"
        />
      </FormSection>

      <FormSection title="ID proof" subtitle="Captured for the record" icon="card" tint={theme.color.warning}>
        <MasterDataDropdown
          label="ID type"
          listKey={GateMasterDataKeys.IdProofType}
          masterData={resources.masterData}
          {...(unit ? { communityId: unit.communityId } : {})}
          value={idProofType}
          onChange={setIdProofType}
          placeholder="Select an ID type"
          allowClear
        />
        <AppTextField
          label="ID number"
          value={idProofNumber}
          onChangeText={setIdProofNumber}
          placeholder="e.g. last 4 digits"
          autoCapitalize="characters"
          editable={!busy}
        />
      </FormSection>

      <FormSection title="Visit details" subtitle="For future reference" icon="clipboard" tint={theme.color.info}>
        <AppTextField
          label="Purpose"
          value={purpose}
          onChangeText={setPurpose}
          placeholder="e.g. parcel delivery, AC repair"
          editable={!busy}
        />
        <AppTextField
          label="Whom to meet"
          value={whomToMeet}
          onChangeText={setWhomToMeet}
          placeholder="Person they're here to meet"
          autoCapitalize="words"
          editable={!busy}
        />
        <AppTextField
          label="Expected duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          placeholder="e.g. 30"
          keyboardType="number-pad"
          editable={!busy}
        />
        <AppTextField
          label="Vehicle number"
          value={vehicle}
          onChangeText={setVehicle}
          placeholder="e.g. MH12AB1234"
          autoCapitalize="characters"
          editable={!busy}
        />
      </FormSection>

      <View style={styles.actions}>
        <AppButton
          title="Register walk-in"
          loading={busy}
          onPress={onSubmit}
          accessibilityHint="Register this walk-in and request resident approval"
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, lineHeight: 18 },
  actions: { marginTop: theme.spacing.sm },
});
