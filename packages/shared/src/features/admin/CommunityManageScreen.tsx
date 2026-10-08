import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { theme } from '../../ui/theme';
import type { Community } from '../../models/community';
import { humanizeCode } from '../shared/status';

export interface CommunityManageScreenProps {
  community: Community;
  onEdit: () => void;
  onWings: () => void;
  onAddUnit: () => void;
  onViewUnits: () => void;
  onBack?: () => void;
}

/**
 * Management hub for one community (super-admin). A simple list of actions — edit the society,
 * manage its wings/structure, add a unit, or browse its units — each pushing its own route so the
 * hardware back returns here. Keeps the community-admin surface route-based and discoverable without
 * a heavy menu. Uses the shared {@link FormScreen} scaffold.
 */
export function CommunityManageScreen({
  community,
  onEdit,
  onWings,
  onAddUnit,
  onViewUnits,
  onBack,
}: CommunityManageScreenProps) {
  return (
    <FormScreen title={community.name} subtitle={humanizeCode(community.communityType)} {...(onBack ? { onBack } : {})}>
      <ActionRow icon="create-outline" tint={theme.color.primary} label="Edit community" hint="Change name or type" onPress={onEdit} />
      <ActionRow icon="git-branch-outline" tint="#8250df" label="Wings & structure" hint="Add wings, buildings, floors" onPress={onWings} />
      <ActionRow icon="add-circle-outline" tint={theme.color.success} label="Add a unit" hint="Create a flat / unit" onPress={onAddUnit} />
      <ActionRow icon="grid-outline" tint={theme.color.info} label="View units" hint="Browse this community's units" onPress={onViewUnits} />
    </FormScreen>
  );
}

function ActionRow({
  icon,
  tint,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.icon, { backgroundColor: `${tint}1f` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.color.mutedText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.soft,
  },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  label: { fontSize: theme.fontSize.body, fontWeight: '700', color: theme.color.text },
  hint: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: 2 },
});
