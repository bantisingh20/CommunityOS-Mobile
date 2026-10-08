import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

export interface FilterCardProps {
  /** The filter controls (search field, dropdowns, …). */
  children: React.ReactNode;
  /** Start expanded (default true). Collapses to just the header to save space. */
  defaultOpen?: boolean;
  /** Count of active (non-empty) filters, shown as a small pill in the header. */
  activeCount?: number;
  /** Optional "Clear all" handler, shown when activeCount > 0. */
  onClear?: () => void;
  title?: string;
}

/**
 * Collapsible, elevated container for a list screen's search + filter controls. Gives every list a
 * consistent, modern "Filters" panel instead of loose fields on the page: a tappable header (with an
 * active-filter count + optional Clear), and the controls in a surface card below. Styled from the
 * shared {@link theme}.
 */
export function FilterCard({ children, defaultOpen = true, activeCount = 0, onClear, title = 'Filters' }: FilterCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${title}${activeCount > 0 ? `, ${activeCount} active` : ''}`}
        accessibilityHint={open ? 'Collapse filters' : 'Expand filters'}
        style={styles.header}
      >
        <Ionicons name="options-outline" size={18} color={theme.color.primary} />
        <Text style={styles.title}>{title}</Text>
        {activeCount > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{activeCount}</Text>
          </View>
        ) : null}
        <View style={styles.flex} />
        {activeCount > 0 && onClear ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear all filters" hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.color.mutedText} />
      </Pressable>
      {open ? <View style={styles.bodyFields}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadow.soft,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: theme.minTouchTarget },
  title: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  flex: { flex: 1 },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: theme.color.primaryText, fontSize: theme.fontSize.caption, fontWeight: '800' },
  clear: { color: theme.color.primary, fontSize: theme.fontSize.label, fontWeight: '700', marginRight: theme.spacing.sm },
  bodyFields: { gap: theme.spacing.md, paddingTop: theme.spacing.md },
});
