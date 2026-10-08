import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { EntityCard } from '../../ui/EntityCard';
import { Badge } from '../../ui/Badge';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import type { PagedData } from '../../models/envelope';
import type { Resident, EmergencyContact } from '../../models/resident';
import type { Unit } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { verificationTone, humanizeCode } from '../shared/status';
import { UnitDetailView } from '../shared/UnitDetailView';

export interface MyHouseholdScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

/** Two-letter initials for the avatar. */
function initialsOf(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/**
 * Resident self-view (Req 19.5, 66.3) — a modern, card-based layout: a profile hero (avatar, name,
 * type, verification badge, contact chips), emergency contacts as a {@link FormSection}, and the
 * resident's unit(s) with their household/vehicles/pets via the shared {@link UnitDetailView}.
 * Everything is self-scoped server-side (the API returns only the signed-in resident's own rows).
 */
export function MyHouseholdScreen({ resources, onBack }: MyHouseholdScreenProps) {
  const me = useAsync<PagedData<Resident>>(
    (signal) => resources.residents.list({ pageSize: 5 }, {}, { signal }),
    [],
  );
  const units = useAsync<PagedData<Unit>>(
    (signal) => resources.units.list({ pageSize: 25 }, {}, { signal }),
    [],
  );

  const resident = me.data?.items[0] ?? null;
  const myUnits = units.data?.items ?? [];

  return (
    <FormScreen title="My household" subtitle="Your profile, contacts & units" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={me.loading}
        error={me.error}
        empty={!me.loading && resident === null}
        emptyMessage="We couldn't find a resident profile linked to your account."
        onRetry={me.reload}
      >
        {resident ? (
          <>
            {/* Profile hero */}
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{initialsOf(resident.name)}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>{resident.name}</Text>
              <View style={styles.heroBadges}>
                <Badge label={humanizeCode(resident.residentType)} tone="neutral" />
                <Badge label={humanizeCode(resident.verificationStatus)} tone={verificationTone(resident.verificationStatus)} />
              </View>
              <View style={styles.heroMeta}>
                {resident.phone ? <HeroChip icon="call-outline" label={resident.phone} /> : null}
                {resident.email ? <HeroChip icon="mail-outline" label={resident.email} /> : null}
              </View>
            </View>

            <EmergencyContacts resources={resources} residentId={resident.id} />
          </>
        ) : null}
      </AsyncBoundary>

      {/* Units — the shared UnitDetailView renders its own hero + section cards per unit, so this is
          a plain section header rather than another card wrapper (avoids a card-in-card look). */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${theme.color.info}1f` }]}>
          <Ionicons name="home" size={16} color={theme.color.info} />
        </View>
        <Text style={styles.sectionTitle}>My units</Text>
        {myUnits.length > 0 ? <Text style={styles.sectionCount}>{myUnits.length}</Text> : null}
      </View>
      <AsyncBoundary
        loading={units.loading}
        error={units.error}
        empty={!units.loading && myUnits.length === 0}
        emptyMessage="No units are associated with your household yet."
        onRetry={units.reload}
      >
        <View style={styles.units}>
          {myUnits.map((u) => (
            <UnitDetailView key={u.id} resources={resources} unitId={u.id} initialUnit={u} showHistory={false} />
          ))}
        </View>
      </AsyncBoundary>
    </FormScreen>
  );
}

/** A small icon+label chip on the profile hero. */
function HeroChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroChip}>
      <Ionicons name={icon} size={13} color={theme.color.primaryText} />
      <Text style={styles.heroChipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** The resident's emergency contacts (Req 15.3), self-scoped. */
function EmergencyContacts({ resources, residentId }: { resources: ResourceClients; residentId: string }) {
  const contacts = useAsync<EmergencyContact[]>(
    (signal) => resources.residents.listEmergencyContacts(residentId, { signal }),
    [residentId],
  );
  const list = contacts.data ?? [];
  return (
    <FormSection
      title="Emergency contacts"
      subtitle={list.length > 0 ? `${list.length} contact${list.length === 1 ? '' : 's'}` : undefined}
      icon="call"
      tint={theme.color.success}
    >
      <AsyncBoundary
        loading={contacts.loading}
        error={contacts.error}
        empty={!contacts.loading && list.length === 0}
        emptyMessage="No emergency contacts on file."
        onRetry={contacts.reload}
      >
        <View style={styles.contactList}>
          {list.map((c) => (
            <EntityCard
              key={c.id}
              title={c.name}
              subtitle={`${humanizeCode(c.relationship)} · ${c.phone}`}
              icon="person"
              tint={theme.color.success}
            />
          ))}
        </View>
      </AsyncBoundary>
    </FormSection>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.color.hero,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadow.hero,
  },
  avatar: {
    width: 72, height: 72, borderRadius: theme.radius.pill,
    backgroundColor: theme.color.onHeroSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  initials: { fontSize: theme.fontSize.title, fontWeight: '800', color: theme.color.primaryText },
  name: { fontSize: theme.fontSize.title, fontWeight: '800', color: theme.color.primaryText },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.color.onHeroSoft, borderRadius: theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: theme.spacing.md, maxWidth: '100%',
  },
  heroChipText: { color: theme.color.primaryText, fontSize: theme.fontSize.caption, fontWeight: '600' },
  contactList: { gap: theme.spacing.sm },
  units: { gap: theme.spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  sectionCount: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, fontWeight: '700' },
});
