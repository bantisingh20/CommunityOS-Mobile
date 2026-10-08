import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

export interface FeatureTileProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Optional accent colour for the icon badge; defaults to the theme primary. */
  tint?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * A tappable feature tile for the Services grid: an icon in a soft rounded badge over a label, on
 * an elevated card. Styled entirely from the shared {@link theme} so colours track a global theme
 * change. Accessible ≥44pt button.
 */
export function FeatureTile({ label, icon, onPress, tint, accessibilityHint, testID }: FeatureTileProps) {
  const accent = tint ?? theme.color.primary;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.badge, { backgroundColor: withAlpha(accent) }]}>
        <Ionicons name={icon} size={24} color={accent} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A light translucent fill derived from the accent, for the icon badge background. */
function withAlpha(hex: string): string {
  // Expect #rrggbb; fall back to the soft accent token if it isn't.
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return `${hex}1a`; // ~10% alpha
  }
  return theme.color.accentSoft;
}

const styles = StyleSheet.create({
  card: {
    width: '31%',
    minHeight: 104,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    ...theme.shadow.card,
  },
  pressed: { opacity: 0.85 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '700', color: theme.color.text, textAlign: 'center' },
});
