import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { FormBanner } from '../../ui/FormBanner';
import { LinkButton } from '../../ui/LinkButton';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { Select } from '../../ui/Select';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { HelpdeskMasterDataKeys } from '../../models/helpdesk';
import type { Ticket } from '../../models/helpdesk';
import type { Unit } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { ticketStatusTone, humanizeCode } from '../shared/status';
import { useMyResident } from './useMyResident';

export interface RaiseTicketScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/**
 * Resident raise-a-ticket (Req 32.1, 32.3). The resident picks the host unit (their own — resolved
 * from the self-scoped {@link useMyResident}, auto-selected when they have exactly one), enters a
 * title + description, and selects a configurable category / optional subcategory / optional
 * priority (from the `Ticket_Category` / `Ticket_Subcategory` / `Ticket_Priority` master-data lists —
 * never a hardcoded list; the priority defaults to the community default when left blank). Optional
 * File_Service attachment references round out the record (Req 32.3). On success the ticket starts
 * `new` and the success state surfaces it. Reuses the shared {@link MasterDataDropdown} / {@link Select}
 * rather than hand-rolling controls.
 *
 * <p>No camera dependency is added (steering/ponytail): attachments take File_Service reference ids
 * (one per line the resident adds) — a capture/upload flow can populate them later without changing
 * this screen, matching how the Phase 4 parcel evidence screen avoids a scanner/upload dependency.</p>
 */
export function RaiseTicketScreen({ resources, onBack }: RaiseTicketScreenProps) {
  const me = useMyResident(resources);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [attachmentDraft, setAttachmentDraft] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [raised, setRaised] = useState<Ticket | null>(null);

  const units = me.data?.units ?? [];
  // Auto-select the resident's only unit so the common single-unit case needs no extra tap.
  const effectiveUnitId = unitId ?? (units.length === 1 ? (units[0]?.id ?? null) : null);

  const unitOptions = useMemo(
    () => units.map((u: Unit) => ({ value: u.id, label: `Unit ${u.unitNumber}` })),
    [units],
  );

  const raise = useAsyncAction(() => {
    if (!effectiveUnitId || !category) {
      return Promise.reject(new Error('Missing fields'));
    }
    return resources.helpdesk
      .createTicket({
        hostUnitId: effectiveUnitId,
        title: title.trim(),
        description: description.trim(),
        category,
        ...(subcategory ? { subcategory } : {}),
        ...(priority ? { priority } : {}),
        ...(attachments.length ? { attachmentFileIds: attachments } : {}),
      })
      .then((t) => {
        setRaised(t);
        return t;
      });
  });

  const canSubmit =
    Boolean(effectiveUnitId) &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    Boolean(category);

  const addAttachment = () => {
    const ref = attachmentDraft.trim();
    if (ref.length > 0 && !attachments.includes(ref)) {
      setAttachments((prev) => [...prev, ref]);
    }
    setAttachmentDraft('');
  };

  const removeAttachment = (ref: string) => setAttachments((prev) => prev.filter((r) => r !== ref));

  const reset = () => {
    setRaised(null);
    setTitle('');
    setDescription('');
    setCategory(null);
    setSubcategory(null);
    setPriority(null);
    setAttachmentDraft('');
    setAttachments([]);
    raise.reset();
  };

  if (raised) {
    return (
      <FormScreen title="Ticket raised" {...(onBack ? { onBack } : {})}>
        <FormBanner message="Your request has been logged. You'll be notified as it's assigned and worked on." tone="success" />
        <ListRow
          title={raised.title}
          subtitle={`${humanizeCode(raised.category)} · ${humanizeCode(raised.priority)}`}
          trailing={<Badge label={humanizeCode(raised.status)} tone={ticketStatusTone(raised.status)} />}
        />
        <AppButton title="Raise another" onPress={reset} accessibilityHint="Raise another ticket" />
        {onBack ? (
          <AppButton title="Done" variant="secondary" onPress={onBack} accessibilityHint="Return to the helpdesk menu" />
        ) : null}
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Raise a ticket" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={me.loading}
        error={me.error}
        empty={!me.loading && units.length === 0}
        emptyMessage="No unit is linked to your account yet, so a ticket can't be raised."
        onRetry={me.reload}
      >
        <SectionHeading title="Unit" />
        {units.length > 1 ? (
          <Select
            label="Host unit"
            value={effectiveUnitId}
            options={unitOptions}
            onChange={setUnitId}
            placeholder="Select the unit this is for"
          />
        ) : (
          <ListRow
            title={`Unit ${units[0]?.unitNumber ?? ''}`}
            subtitle={units[0] ? humanizeCode(units[0].unitType) : undefined}
            trailing={<Badge label="Your unit" tone="positive" />}
          />
        )}

        <SectionHeading title="What's the issue?" />
        <AppTextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Short summary, e.g. Kitchen tap leaking"
          autoCapitalize="sentences"
          {...(raise.error?.fieldErrors.title ? { error: raise.error.fieldErrors.title } : {})}
        />
        <AppTextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the problem and where it is"
          autoCapitalize="sentences"
          {...(raise.error?.fieldErrors.description ? { error: raise.error.fieldErrors.description } : {})}
        />
        <MasterDataDropdown
          label="Category"
          listKey={HelpdeskMasterDataKeys.TicketCategory}
          masterData={resources.masterData}
          value={category}
          onChange={setCategory}
          placeholder="Select a category"
        />
        <MasterDataDropdown
          label="Subcategory (optional)"
          listKey={HelpdeskMasterDataKeys.TicketSubcategory}
          masterData={resources.masterData}
          value={subcategory}
          onChange={setSubcategory}
          placeholder="Refine the category"
          allowClear
          clearLabel="None"
        />
        <MasterDataDropdown
          label="Priority (optional)"
          listKey={HelpdeskMasterDataKeys.TicketPriority}
          masterData={resources.masterData}
          value={priority}
          onChange={setPriority}
          placeholder="Use the community default"
          allowClear
          clearLabel="Community default"
        />

        <SectionHeading title="Attachments (optional)" />
        <AppTextField
          label="Attachment reference"
          value={attachmentDraft}
          onChangeText={setAttachmentDraft}
          placeholder="File_Service reference id (photo / video / document)"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={addAttachment}
        />
        <AppButton
          title="Add attachment reference"
          variant="secondary"
          disabled={attachmentDraft.trim().length === 0}
          onPress={addAttachment}
          accessibilityHint="Add this file reference to the ticket"
        />
        {attachments.length ? (
          <View style={styles.list}>
            {attachments.map((ref) => (
              <ListRow
                key={ref}
                title={ref}
                trailing={
                  <LinkButton
                    title="Remove"
                    onPress={() => removeAttachment(ref)}
                    accessibilityHint={`Remove attachment ${ref}`}
                  />
                }
              />
            ))}
          </View>
        ) : null}

        {raise.error && !raise.error.fieldErrors.title && !raise.error.fieldErrors.description ? (
          <FormBanner message={raise.error.message} tone="error" />
        ) : null}

        <AppButton
          title="Raise ticket"
          loading={raise.running}
          disabled={!canSubmit}
          onPress={() => raise.run()}
          accessibilityHint="Submit this ticket to the helpdesk"
        />
      </AsyncBoundary>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
});
