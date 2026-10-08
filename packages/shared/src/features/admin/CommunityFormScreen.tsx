import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsyncAction } from '../../ui/hooks';
import { showSuccessAlert } from '../../ui/errorAlert';
import { emitToast } from '../../ui/toastBus';
import { theme } from '../../ui/theme';
import { MasterDataKeys } from '../../models/masterData';
import type { Community } from '../../models/community';
import type { ResourceClients } from '../../resources';

export interface CommunityFormScreenProps {
  resources: ResourceClients;
  /** When editing, the community to edit; omit to create a new one. */
  community?: Community;
  /**
   * Organization the new community belongs to. Required for create (the backend needs an owning
   * org). The list screen passes it from any existing community so no organizations endpoint is
   * needed in the MVP.
   */
  organizationId?: string;
  /** Called after a successful save so the caller can refresh + navigate back. */
  onSaved?: (community: Community) => void;
  onBack?: () => void;
}

/**
 * Create or edit a community (society) — the super-admin management form (Req 12.1, 12.2). On create
 * it posts name + type under the given organization; on edit it PUTs the changed name/type. The type
 * dropdown resolves from the configurable `Community_Type` master-data list (never hardcoded).
 * Friendly errors + a native popup come from {@link useAsyncAction}; the save button disables while
 * in flight. Uses the shared {@link FormScreen} scaffold so safe-area/keyboard handling matches the
 * rest of the app.
 */
export function CommunityFormScreen({ resources, community, organizationId, onSaved, onBack }: CommunityFormScreenProps) {
  const isEdit = Boolean(community);
  const [name, setName] = useState(community?.name ?? '');
  const [communityType, setCommunityType] = useState<string | null>(community?.communityType ?? null);
  const [validation, setValidation] = useState<string | null>(null);

  const save = useAsyncAction(async () => {
    if (isEdit && community) {
      const updated = await resources.communities.update(community.id, {
        name: name.trim(),
        communityType: communityType!,
      });
      showSuccessAlert('Community updated.');
      onSaved?.(updated);
      return;
    }
    const created = await resources.communities.create({
      organizationId: organizationId!,
      name: name.trim(),
      communityType: communityType!,
    });
    showSuccessAlert('Community created.');
    onSaved?.(created);
  });

  const fail = (msg: string) => { setValidation(msg); emitToast({ tone: 'error', title: 'Check the form', message: msg }); };

  const onSubmit = () => {
    // Client-side checks surface the real message as a toast (useAsyncAction maps server errors).
    if (!name.trim()) { fail('Please enter a community name.'); return; }
    if (!communityType) { fail('Please choose a community type.'); return; }
    if (!isEdit && !organizationId) { fail('No organization available to create under.'); return; }
    setValidation(null);
    void save.run();
  };

  return (
    <FormScreen
      title={isEdit ? 'Edit community' : 'New community'}
      subtitle={isEdit ? 'Update the society name or type' : 'Add a new society / community'}
      {...(onBack ? { onBack } : {})}
    >
      <FormSection title="Community details" icon="business" tint={theme.color.primary}>
        <AppTextField
          label="Name"
          required
          value={name}
          onChangeText={setName}
          placeholder="e.g. Shree Krishna Residency"
          {...(save.error?.fieldErrors?.name ? { error: save.error.fieldErrors.name } : {})}
        />
        <MasterDataDropdown
          label="Community type"
          required
          listKey={MasterDataKeys.CommunityType}
          masterData={resources.masterData}
          value={communityType}
          onChange={setCommunityType}
          placeholder="Choose a type"
        />
      </FormSection>

      {validation ?? save.error?.message ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{validation ?? save.error?.message}</Text>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          title={isEdit ? 'Save changes' : 'Create community'}
          onPress={onSubmit}
          loading={save.running}
          accessibilityHint={isEdit ? 'Saves the community' : 'Creates the community'}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: theme.fontSize.label, color: theme.color.danger },
  actions: { marginTop: theme.spacing.md },
});
