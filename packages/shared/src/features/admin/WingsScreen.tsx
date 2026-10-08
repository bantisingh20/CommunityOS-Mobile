import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { EntityCard } from '../../ui/EntityCard';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { showSuccessAlert } from '../../ui/errorAlert';
import { emitToast } from '../../ui/toastBus';
import { theme } from '../../ui/theme';
import { MasterDataKeys } from '../../models/masterData';
import type { Community, HierarchyNode } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { humanizeCode } from '../shared/status';

export interface WingsScreenProps {
  resources: ResourceClients;
  community: Community;
  onBack?: () => void;
}

/** A per-level icon so each structure node reads at a glance. */
function levelIcon(level: string): keyof typeof Ionicons.glyphMap {
  switch (level) {
    case 'phase': return 'map';
    case 'building_tower': return 'business';
    case 'block': return 'grid';
    case 'zone': return 'location';
    case 'floor': return 'layers';
    default: return 'git-branch';
  }
}

/**
 * Manage a community's structure — its wings / buildings / floors (Req 13.1–13.4). A modern,
 * card-based layout: an "Add" {@link FormSection} (required name + configurable level) over a list of
 * the existing structure as {@link EntityCard}s with a per-level icon. Add surfaces a success toast
 * and reloads; validation errors raise a toast. Uses the shared {@link FormScreen} scaffold.
 */
export function WingsScreen({ resources, community, onBack }: WingsScreenProps) {
  const { data, loading, error, reload } = useAsync<HierarchyNode[]>(
    (signal) => resources.hierarchy.listForCommunity(community.id, { signal }),
    [community.id],
  );

  const [name, setName] = useState('');
  const [level, setLevel] = useState<string | null>('building_tower');

  const add = useAsyncAction(async () => {
    await resources.hierarchy.create({ communityId: community.id, level: level!, name: name.trim() });
    showSuccessAlert(`"${name.trim()}" added.`, 'Wing added');
    setName('');
    reload();
  });

  const onAdd = () => {
    if (!name.trim()) { emitToast({ tone: 'error', title: 'Check the form', message: 'Please enter a name (e.g. Wing C).' }); return; }
    if (!level) { emitToast({ tone: 'error', title: 'Check the form', message: 'Please choose a level.' }); return; }
    void add.run();
  };

  const nodes = data ?? [];

  return (
    <FormScreen
      title="Wings & structure"
      subtitle={community.name}
      {...(onBack ? { onBack } : {})}
    >
      <FormSection title="Add a wing / building" icon="add-circle" tint={theme.color.success}>
        <AppTextField
          label="Name"
          required
          value={name}
          onChangeText={setName}
          placeholder="e.g. Wing C"
        />
        <MasterDataDropdown
          label="Level"
          required
          listKey={MasterDataKeys.HierarchyLevel}
          masterData={resources.masterData}
          value={level}
          onChange={setLevel}
          placeholder="Choose a level"
        />
        <AppButton title="Add" onPress={onAdd} loading={add.running} accessibilityHint="Adds the wing to this community" />
      </FormSection>

      <FormSection
        title="Existing structure"
        subtitle={nodes.length > 0 ? `${nodes.length} ${nodes.length === 1 ? 'item' : 'items'}` : undefined}
        icon="git-branch"
        tint={theme.color.primary}
      >
        <AsyncBoundary
          loading={loading}
          error={error}
          empty={!loading && nodes.length === 0}
          emptyMessage="No wings or buildings yet. Add one above."
          onRetry={reload}
        >
          <View style={styles.list}>
            {nodes.map((n) => (
              <EntityCard
                key={n.id}
                title={n.name}
                subtitle={humanizeCode(n.level)}
                icon={levelIcon(n.level)}
                tint={theme.color.primary}
                badge={{ label: humanizeCode(n.level), tone: 'neutral' }}
              />
            ))}
          </View>
        </AsyncBoundary>
      </FormSection>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
});
