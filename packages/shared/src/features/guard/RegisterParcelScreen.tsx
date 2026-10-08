import React, { useState } from 'react';
import { Screen } from '../../ui/Screen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { FormBanner } from '../../ui/FormBanner';
import { LinkButton } from '../../ui/LinkButton';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsyncAction } from '../../ui/hooks';
import { ParcelMasterDataKeys } from '../../models/parcel';
import type { Unit } from '../../models/community';
import type { Parcel } from '../../models/parcel';
import type { ResourceClients } from '../../resources';
import { parcelStatusTone, humanizeCode } from '../shared/status';
import { UnitPicker } from './UnitPicker';

export interface RegisterParcelScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/**
 * Guard parcel registration (Req 28.1, 28.4, 29.3). The guard picks the recipient unit, enters the
 * tracking number + provider, and selects a configurable category and recorded condition (from the
 * `Parcel_Category` / `Parcel_Condition` master-data lists — never a hardcoded list). An optional
 * receiver/location and optional photo / condition-evidence File_Service references round out the
 * record (Req 28.4). On success the parcel starts `received` and is flagged priority when its
 * category is a configurable priority category (Req 29.3), which the success state surfaces. Reuses
 * the shared {@link UnitPicker} and {@link MasterDataDropdown} rather than hand-rolling controls.
 *
 * <p>No camera dependency is added (steering/ponytail): the photo + condition-evidence inputs take a
 * File_Service reference id — a capture/upload flow can populate it later without changing this
 * screen, matching how the gate screens avoid a scanner dependency.</p>
 */
export function RegisterParcelScreen({ resources, onBack }: RegisterParcelScreenProps) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [condition, setCondition] = useState<string | null>(null);
  const [receiver, setReceiver] = useState('');
  const [receivedLocation, setReceivedLocation] = useState('');
  const [photoFileId, setPhotoFileId] = useState('');
  const [conditionEvidenceFileId, setConditionEvidenceFileId] = useState('');
  const [registered, setRegistered] = useState<Parcel | null>(null);

  const register = useAsyncAction(() => {
    if (!unit || !category || !condition) {
      return Promise.reject(new Error('Missing fields'));
    }
    return resources.parcels
      .registerParcel({
        recipientUnitId: unit.id,
        trackingNumber: trackingNumber.trim(),
        provider: provider.trim(),
        category,
        condition,
        ...(receiver.trim() ? { receiver: receiver.trim() } : {}),
        ...(receivedLocation.trim() ? { receivedLocation: receivedLocation.trim() } : {}),
        ...(photoFileId.trim() ? { photoFileId: photoFileId.trim() } : {}),
        ...(conditionEvidenceFileId.trim() ? { conditionEvidenceFileId: conditionEvidenceFileId.trim() } : {}),
      })
      .then((p) => {
        setRegistered(p);
        return p;
      });
  });

  const canSubmit =
    Boolean(unit) &&
    trackingNumber.trim().length > 0 &&
    provider.trim().length > 0 &&
    Boolean(category) &&
    Boolean(condition);

  const reset = () => {
    setRegistered(null);
    setTrackingNumber('');
    setProvider('');
    setCategory(null);
    setCondition(null);
    setReceiver('');
    setReceivedLocation('');
    setPhotoFileId('');
    setConditionEvidenceFileId('');
    register.reset();
  };

  if (registered) {
    return (
      <Screen accessibilityLabel="Parcel registered">
        {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the parcels menu" /> : null}
        <SectionHeading title="Parcel registered" level={1} />
        <FormBanner
          message={
            registered.isPriority
              ? 'Registered and flagged priority — the recipient has been notified. Move it into custody next.'
              : 'Registered. The recipient has been notified. Move it into custody next.'
          }
          tone="success"
        />
        <ListRow
          title={registered.trackingNumber}
          subtitle={`${registered.provider} · ${humanizeCode(registered.category)} · ${humanizeCode(registered.condition)}`}
          trailing={<Badge label={humanizeCode(registered.status)} tone={parcelStatusTone(registered.status)} />}
        />
        {registered.isPriority ? <Badge label="Priority" tone="danger" /> : null}
        <AppButton title="Register another" onPress={reset} accessibilityHint="Register another parcel" />
      </Screen>
    );
  }

  return (
    <Screen accessibilityLabel="Register a parcel">
      {onBack ? <LinkButton title="‹ Back" onPress={onBack} accessibilityHint="Return to the parcels menu" /> : null}
      <SectionHeading title="Register a parcel" level={1} />

      <SectionHeading title="Recipient unit" />
      <UnitPicker resources={resources} value={unit} onSelect={setUnit} />

      <SectionHeading title="Parcel" />
      <AppTextField
        label="Tracking number"
        value={trackingNumber}
        onChangeText={setTrackingNumber}
        placeholder="Courier tracking / reference"
        autoCapitalize="characters"
        {...(register.error?.fieldErrors.trackingNumber ? { error: register.error.fieldErrors.trackingNumber } : {})}
      />
      <AppTextField
        label="Provider"
        value={provider}
        onChangeText={setProvider}
        placeholder="Courier / delivery provider"
        autoCapitalize="words"
        {...(register.error?.fieldErrors.provider ? { error: register.error.fieldErrors.provider } : {})}
      />
      <MasterDataDropdown
        label="Category"
        listKey={ParcelMasterDataKeys.ParcelCategory}
        masterData={resources.masterData}
        value={category}
        onChange={setCategory}
        placeholder="Select a parcel category"
      />
      <MasterDataDropdown
        label="Condition"
        listKey={ParcelMasterDataKeys.ParcelCondition}
        masterData={resources.masterData}
        value={condition}
        onChange={setCondition}
        placeholder="Select the recorded condition"
      />

      <SectionHeading title="Receipt (optional)" />
      <AppTextField
        label="Received by (optional)"
        value={receiver}
        onChangeText={setReceiver}
        placeholder="Who received it at the gate"
        autoCapitalize="words"
      />
      <AppTextField
        label="Received location (optional)"
        value={receivedLocation}
        onChangeText={setReceivedLocation}
        placeholder="Gate / reception location"
        autoCapitalize="words"
      />
      <AppTextField
        label="Photo reference (optional)"
        value={photoFileId}
        onChangeText={setPhotoFileId}
        placeholder="Captured parcel photo file id"
        autoCapitalize="none"
        {...(register.error?.fieldErrors.photoFileId ? { error: register.error.fieldErrors.photoFileId } : {})}
      />
      <AppTextField
        label="Condition evidence reference (optional)"
        value={conditionEvidenceFileId}
        onChangeText={setConditionEvidenceFileId}
        placeholder="Captured condition evidence file id"
        autoCapitalize="none"
        {...(register.error?.fieldErrors.conditionEvidenceFileId
          ? { error: register.error.fieldErrors.conditionEvidenceFileId }
          : {})}
      />

      {register.error && !hasFieldError(register.error.fieldErrors) ? (
        <FormBanner message={register.error.message} tone="error" />
      ) : null}

      <AppButton
        title="Register parcel"
        loading={register.running}
        disabled={!canSubmit}
        onPress={() => register.run()}
        accessibilityHint="Register this parcel and notify the recipient"
      />
    </Screen>
  );
}

/** Whether any field-level error is present (so the generic banner isn't shown on top of them). */
function hasFieldError(fieldErrors: Readonly<Record<string, string>>): boolean {
  return Object.keys(fieldErrors).length > 0;
}
