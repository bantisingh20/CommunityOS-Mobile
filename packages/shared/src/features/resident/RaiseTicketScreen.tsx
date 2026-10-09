import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { FormBanner } from '../../ui/FormBanner';
import { Badge } from '../../ui/Badge';
import { Select } from '../../ui/Select';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { PhotoPicker } from '../../ui/PhotoPicker';
import { useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { HelpdeskMasterDataKeys } from '../../models/helpdesk';
import type { Ticket } from '../../models/helpdesk';
import type { ResourceClients } from '../../resources';
import { ticketStatusTone, humanizeCode } from '../shared/status';
import { useMyResident } from './useMyResident';

export interface RaiseTicketScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/** How many photo attachments a resident may add to a ticket. */
const MAX_ATTACHMENTS = 4;

/**
 * Resident raise-a-ticket (Req 32.1, 32.3) — a modern, card-based form. The resident's host unit is
 * resolved from the self-scoped {@link useMyResident} (auto-used when they have exactly one; a chooser
 * only appears with several; a clear empty state when none). Title + a multiline description, a
 * configurable category / optional subcategory / optional priority (from the master-data lists —
 * never hardcoded; priority defaults to the community default when blank), and optional **photo**
 * attachments captured via {@link PhotoPicker} (uploaded to File_Service, their references sent as
 * `attachmentFileIds`). On success a confirmation card surfaces the new ticket.
 */
export function RaiseTicketScreen({ resources, onBack }: RaiseTicketScreenProps) {
  const me = useMyResident(resources);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  // Remount key for the PhotoPicker so it clears after each successful add (lets the resident add more).
  const [pickerKey, setPickerKey] = useState(0);
  const [raised, setRaised] = useState<Ticket | null>(null);

  const units = me.data?.units ?? [];
  // Use the resident's unit only when there's exactly one (their only real unit); never guess "the
  // first of many" — a chooser appears when there are several.
  const soleUnitId = units.length === 1 ? (units[0]?.unitId ?? null) : null;
  const effectiveUnitId = unitId ?? soleUnitId;
  const selectedUnit = units.find((u) => u.unitId === effectiveUnitId) ?? null;
  // Community to upload a photo under: the chosen unit's, else the resident's own, else the first
  // unit's. Photos don't depend on a chosen unit, so this keeps the picker available regardless.
  const uploadCommunityId =
    selectedUnit?.communityId ?? me.data?.resident?.communityId ?? units[0]?.communityId ?? null;

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.unitId, label: `Unit ${u.unitNumber}` })),
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

  const onPhotoAdded = (ref: string | null) => {
    if (ref && !attachments.includes(ref)) {
      setAttachments((prev) => [...prev, ref]);
      setPickerKey((k) => k + 1); // reset the picker so another can be added
    }
  };
  const removeAttachment = (ref: string) => setAttachments((prev) => prev.filter((r) => r !== ref));

  const reset = () => {
    setRaised(null);
    setTitle('');
    setDescription('');
    setCategory(null);
    setSubcategory(null);
    setPriority(null);
    setAttachments([]);
    setPickerKey((k) => k + 1);
    raise.reset();
  };

  if (raised) {
    return (
      <FormScreen title="Ticket raised" {...(onBack ? { onBack } : {})}>
        <View style={styles.successHero}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={40} color={theme.color.success} />
          </View>
          <Text style={styles.successTitle}>Your request has been logged</Text>
          <Text style={styles.successSub}>You'll be notified as it's assigned and worked on.</Text>
        </View>
        <View style={styles.card}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.color.primary}1f` }]}>
            <Ionicons name="construct" size={20} color={theme.color.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{raised.title}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{humanizeCode(raised.category)} · {humanizeCode(raised.priority)}</Text>
          </View>
          <Badge label={humanizeCode(raised.status)} tone={ticketStatusTone(raised.status)} />
        </View>
        <View style={styles.actions}>
          <AppButton title="Raise another" onPress={reset} accessibilityHint="Raise another ticket" />
          {onBack ? (
            <AppButton title="Done" variant="secondary" onPress={onBack} accessibilityHint="Return to the helpdesk menu" />
          ) : null}
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Raise a ticket" subtitle="Report an issue or request" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={me.loading}
        error={me.error}
        empty={!me.loading && units.length === 0}
        emptyMessage="No unit is linked to your account yet, so a ticket can't be raised."
        onRetry={me.reload}
      >
        {/* Unit — only a chooser when there are several; a single unit is shown as a read-only chip. */}
        <FormSection title="Unit" icon="home" tint={theme.color.info}>
          {units.length > 1 ? (
            <Select
              label="Host unit"
              required
              value={effectiveUnitId}
              options={unitOptions}
              onChange={setUnitId}
              placeholder="Select the unit this is for"
            />
          ) : (
            <View style={styles.unitRow}>
              <Ionicons name="home" size={18} color={theme.color.info} />
              <Text style={styles.unitText}>Unit {units[0]?.unitNumber ?? ''}</Text>
              <Badge label="Your unit" tone="positive" />
            </View>
          )}
        </FormSection>

        {/* Issue details */}
        <FormSection title="What's the issue?" icon="create" tint={theme.color.primary}>
          <AppTextField
            label="Title"
            required
            value={title}
            onChangeText={setTitle}
            placeholder="Short summary, e.g. Kitchen tap leaking"
            autoCapitalize="sentences"
            {...(raise.error?.fieldErrors.title ? { error: raise.error.fieldErrors.title } : {})}
          />
          <AppTextField
            label="Description"
            required
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the problem and where it is"
            autoCapitalize="sentences"
            multiline
            numberOfLines={5}
            {...(raise.error?.fieldErrors.description ? { error: raise.error.fieldErrors.description } : {})}
          />
          <MasterDataDropdown
            label="Category"
            required
            listKey={HelpdeskMasterDataKeys.TicketCategory}
            masterData={resources.masterData}
            value={category}
            onChange={setCategory}
            {...(uploadCommunityId ? { communityId: uploadCommunityId } : {})}
            placeholder="Select a category"
          />
          <MasterDataDropdown
            label="Subcategory (optional)"
            listKey={HelpdeskMasterDataKeys.TicketSubcategory}
            masterData={resources.masterData}
            value={subcategory}
            onChange={setSubcategory}
            {...(uploadCommunityId ? { communityId: uploadCommunityId } : {})}
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
            {...(uploadCommunityId ? { communityId: uploadCommunityId } : {})}
            placeholder="Use the community default"
            allowClear
            clearLabel="Community default"
          />
        </FormSection>

        {/* Photo attachments (optional) */}
        <FormSection title="Photos (optional)" subtitle="Add a photo of the issue" icon="camera" tint={theme.color.warning}>
          {attachments.length > 0 ? (
            <View style={styles.attachList}>
              {attachments.map((ref, i) => (
                <View key={ref} style={styles.attachRow}>
                  <Ionicons name="image" size={18} color={theme.color.success} />
                  <Text style={styles.attachText} numberOfLines={1}>Photo {i + 1}</Text>
                  <Pressable onPress={() => removeAttachment(ref)} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={theme.color.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {attachments.length < MAX_ATTACHMENTS && uploadCommunityId ? (
            <PhotoPicker
              key={pickerKey}
              label={attachments.length === 0 ? 'Add a photo' : 'Add another photo'}
              files={resources.files}
              upload={{ owningResourceType: 'Ticket', communityId: uploadCommunityId }}
              value={null}
              onChange={onPhotoAdded}
              disabled={raise.running}
            />
          ) : null}
        </FormSection>

        {raise.error && !raise.error.fieldErrors.title && !raise.error.fieldErrors.description ? (
          <FormBanner message={raise.error.message} tone="error" />
        ) : null}

        <View style={styles.actions}>
          <AppButton
            title="Raise ticket"
            loading={raise.running}
            disabled={!canSubmit}
            onPress={() => raise.run()}
            accessibilityHint="Submit this ticket to the helpdesk"
          />
        </View>
      </AsyncBoundary>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: theme.spacing.sm, gap: theme.spacing.sm },

  unitRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  unitText: { flex: 1, fontSize: theme.fontSize.body, fontWeight: '700', color: theme.color.text },

  attachList: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  attachRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.color.background, borderRadius: theme.radius.md, padding: theme.spacing.sm,
  },
  attachText: { flex: 1, fontSize: theme.fontSize.label, color: theme.color.text, fontWeight: '600' },

  // Success state.
  successHero: { alignItems: 'center', gap: theme.spacing.xs, paddingVertical: theme.spacing.lg },
  successIcon: {
    width: 72, height: 72, borderRadius: theme.radius.pill,
    backgroundColor: '#e6f4ea', alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xs,
  },
  successTitle: { fontSize: theme.fontSize.title, fontWeight: '800', color: theme.color.text, textAlign: 'center' },
  successSub: { fontSize: theme.fontSize.label, color: theme.color.mutedText, textAlign: 'center' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.color.surface, borderRadius: theme.radius.lg,
    padding: theme.spacing.md, ...theme.shadow.soft,
  },
  cardIcon: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  cardSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },
});
