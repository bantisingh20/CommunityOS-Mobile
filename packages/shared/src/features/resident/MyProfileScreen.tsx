import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { FormSection } from '../../ui/FormSection';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { EntityCard } from '../../ui/EntityCard';
import { Badge } from '../../ui/Badge';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { Select } from '../../ui/Select';
import { showSuccessAlert } from '../../ui/errorAlert';
import { emitToast } from '../../ui/toastBus';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { useMyResident } from './useMyResident';
import type { EmergencyContact, Vehicle } from '../../models/resident';
import type { Unit, UnitHouseholdMember } from '../../models/community';
import type { ResourceClients } from '../../resources';
import { humanizeCode } from '../shared/status';

export interface MyProfileScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

type ProfileView =
  | { name: 'menu' }
  | { name: 'editContact' }
  | { name: 'family' }
  | { name: 'vehicles' }
  | { name: 'contacts' };

/** Raise a client-side validation toast (deduped by the host). */
function warn(message: string): void {
  emitToast({ tone: 'error', title: 'Check the form', message });
}

/**
 * Resident self-service hub (Req 15.1-15.3, 19.1): the signed-in resident views and manages their
 * own profile — contact details, family/household members, vehicles and emergency contacts. All
 * data is self-scoped server-side. Route-based via an internal view switch; each sub-view is a
 * {@link FormScreen} with grouped {@link FormSection} cards, required-field markers and toast
 * feedback (no raw errors).
 */
export function MyProfileScreen({ resources, onBack }: MyProfileScreenProps) {
  const [view, setView] = useState<ProfileView>({ name: 'menu' });
  const me = useMyResident(resources);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];
  const primaryUnit = units[0] ?? null;

  const back = () => setView({ name: 'menu' });

  if (view.name === 'editContact' && resident) {
    return <EditContactView resources={resources} resident={resident} onDone={() => { me.reload(); back(); }} onBack={back} />;
  }
  if (view.name === 'family' && resident) {
    return <FamilyView resources={resources} units={units} onBack={back} />;
  }
  if (view.name === 'vehicles') {
    return <VehiclesView resources={resources} units={units} onBack={back} />;
  }
  if (view.name === 'contacts' && resident) {
    return <ContactsView resources={resources} residentId={resident.id} onBack={back} />;
  }

  return (
    <FormScreen title="My Profile" subtitle="Manage your household" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={me.loading}
        error={me.error}
        empty={!me.loading && resident === null}
        emptyMessage="We couldn't find a resident profile linked to your account."
        onRetry={me.reload}
      >
        {resident ? (
          <>
            {/* Hero summary */}
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={30} color={theme.color.primaryText} />
              </View>
              <Text style={styles.name} numberOfLines={1}>{resident.name}</Text>
              <Text style={styles.sub}>{humanizeCode(resident.residentType)}</Text>
              <View style={styles.heroMeta}>
                {resident.phone ? <HeroMeta icon="call-outline" label={resident.phone} /> : null}
                {resident.email ? <HeroMeta icon="mail-outline" label={resident.email} /> : null}
                {primaryUnit ? <HeroMeta icon="home-outline" label={`Unit ${primaryUnit.unitNumber}`} /> : null}
              </View>
            </View>

            <MenuTile icon="create-outline" tint={theme.color.primary} title="Edit contact details" subtitle="Name, email and phone" onPress={() => setView({ name: 'editContact' })} />
            <MenuTile icon="people-outline" tint={theme.color.info} title="Family members" subtitle="View and add household members" onPress={() => setView({ name: 'family' })} />
            <MenuTile icon="car-outline" tint={theme.color.warning} title="Vehicles" subtitle="View and register your vehicles" onPress={() => setView({ name: 'vehicles' })} />
            <MenuTile icon="call-outline" tint={theme.color.success} title="Emergency contacts" subtitle="People to reach in an emergency" onPress={() => setView({ name: 'contacts' })} />
          </>
        ) : null}
      </AsyncBoundary>
    </FormScreen>
  );
}

/** A small icon+label chip on the profile hero. */
function HeroMeta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroChip}>
      <Ionicons name={icon} size={13} color={theme.color.primaryText} />
      <Text style={styles.heroChipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** A navigation tile on the profile hub. */
function MenuTile({ icon, title, subtitle, tint, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; tint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}>
      <View style={[styles.tileIcon, { backgroundColor: `${tint}1f` }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.color.mutedText} />
    </Pressable>
  );
}

/** Edit the resident's own contact details (Req 15.1). */
function EditContactView({ resources, resident, onDone, onBack }: { resources: ResourceClients; resident: { id: string; name: string; email: string | null; phone: string | null }; onDone: () => void; onBack: () => void }) {
  const [name, setName] = useState(resident.name);
  const [email, setEmail] = useState(resident.email ?? '');
  const [phone, setPhone] = useState(resident.phone ?? '');
  const save = useAsyncAction(async () => {
    await resources.residents.update(resident.id, {
      name: name.trim(),
      email: email.trim() === '' ? null : email.trim(),
      updateEmail: true,
      phone: phone.trim() === '' ? null : phone.trim(),
      updatePhone: true,
    });
    showSuccessAlert('Your contact details were saved.', 'Saved');
  });
  const onSubmit = async () => {
    if (!name.trim()) { warn('Please enter your full name.'); return; }
    if (await save.run()) onDone();
  };
  return (
    <FormScreen title="Edit contact details" subtitle="Your personal details" onBack={onBack}>
      <FormSection title="Contact details" icon="person" tint={theme.color.primary}>
        <AppTextField label="Full name" required value={name} onChangeText={setName} editable={!save.running} placeholder="Your name" />
        <AppTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!save.running} placeholder="you@example.com" />
        <AppTextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!save.running} placeholder="+91…" />
      </FormSection>
      <View style={styles.actions}>
        <AppButton title="Save changes" loading={save.running} onPress={onSubmit} accessibilityHint="Saves your contact details" />
      </View>
    </FormScreen>
  );
}

/** Family / household members: add a person to the unit's household with the OWNER-FIRST rule
 *  (Req 15.1, 15.2). If the unit has no owner yet, the first person added IS the owner (one-time);
 *  once an owner exists, further people are added as family members. Creates a Resident record then
 *  associates them to the unit. Also shows the unit's current members. */
function FamilyView({ resources, units, onBack }: { resources: ResourceClients; units: Unit[]; onBack: () => void }) {
  const primaryUnit = units[0] ?? null;
  const [unitId, setUnitId] = useState<string | null>(primaryUnit?.id ?? null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const selectedUnit = units.find((u) => u.id === unitId) ?? primaryUnit;

  // The selected unit's current household — drives the owner-first rule.
  const household = useAsync<UnitHouseholdMember[]>(
    (signal) => (unitId ? resources.units.listHousehold(unitId, { signal }) : Promise.resolve([])),
    [unitId],
  );
  const members = household.data ?? [];
  const hasOwner = members.some((m) => m.residentType === 'owner');
  // No owner yet → this add creates the owner (one-time). Owner exists → it's a family member.
  const memberType = hasOwner ? 'family_member' : 'owner';
  const addingOwner = !hasOwner;

  const add = useAsyncAction(async () => {
    const member = await resources.residents.create({
      communityId: selectedUnit!.communityId,
      name: name.trim(),
      residentType: memberType,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
    });
    // When adding the owner, the household relationship is "owner"; else the stated relationship.
    const rel = addingOwner ? 'owner' : relationship.trim();
    await resources.residents.addHousehold(member.id, { unitId: unitId!, relationship: rel });
    showSuccessAlert(
      addingOwner
        ? `${name.trim()} was added as the unit owner.`
        : `${name.trim()} was added to your household.`,
      addingOwner ? 'Owner added' : 'Family member added',
    );
    setName(''); setPhone(''); setEmail(''); setRelationship('');
    household.reload();
  });

  const onSubmit = () => {
    if (!name.trim()) { warn('Enter the person\u2019s name.'); return; }
    if (!unitId) { warn('Select a unit.'); return; }
    if (!addingOwner && !relationship.trim()) { warn('Enter the relationship (e.g. Spouse).'); return; }
    void add.run();
  };

  const sectionTitle = addingOwner ? 'Add unit owner' : 'Add a family member';
  const sectionIcon = addingOwner ? ('key' as const) : ('people' as const);
  const sectionTint = addingOwner ? theme.color.success : theme.color.info;

  return (
    <FormScreen title="Family members" subtitle={selectedUnit ? `Unit ${selectedUnit.unitNumber}` : 'Household'} onBack={onBack}>
      {/* Current members */}
      <FormSection title="Current household" subtitle={members.length > 0 ? `${members.length} member${members.length === 1 ? '' : 's'}` : undefined} icon="home" tint={theme.color.primary}>
        <AsyncBoundary
          loading={household.loading}
          error={household.error}
          empty={!household.loading && members.length === 0}
          emptyMessage="No one is in this unit's household yet. Add the owner below."
          onRetry={household.reload}
        >
          <View style={styles.memberList}>
            {members.map((m) => (
              <View key={m.residentId} style={styles.memberRow}>
                <View style={[styles.memberIcon, { backgroundColor: `${m.residentType === 'owner' ? theme.color.success : theme.color.info}1f` }]}>
                  <Ionicons name={m.residentType === 'owner' ? 'key' : 'person'} size={16} color={m.residentType === 'owner' ? theme.color.success : theme.color.info} />
                </View>
                <View style={styles.memberText}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberSub}>{humanizeCode(m.relationship)}</Text>
                </View>
                <Badge label={humanizeCode(m.residentType)} tone={m.residentType === 'owner' ? 'positive' : 'neutral'} />
              </View>
            ))}
          </View>
        </AsyncBoundary>
      </FormSection>

      {/* Add form — owner-first */}
      <FormSection title={sectionTitle} icon={sectionIcon} tint={sectionTint}>
        {addingOwner ? (
          <Text style={styles.note}>This unit has no owner yet, so the first person you add becomes the unit owner.</Text>
        ) : null}
        <AppTextField label="Full name" required value={name} onChangeText={setName} editable={!add.running} placeholder="e.g. Priya Sharma" autoCapitalize="words" />
        {!addingOwner ? (
          <AppTextField label="Relationship" required value={relationship} onChangeText={setRelationship} editable={!add.running} placeholder="e.g. Spouse, Son, Daughter" />
        ) : null}
        <AppTextField label="Contact number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!add.running} placeholder="+91…" />
        <AppTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!add.running} placeholder="name@example.com" />
        {units.length > 1 ? (
          <Select label="Unit" required value={unitId} onChange={setUnitId} options={units.map((u) => ({ value: u.id, label: `Unit ${u.unitNumber}` }))} />
        ) : null}
        <AppButton title={addingOwner ? 'Add owner' : 'Add member'} loading={add.running} onPress={onSubmit} accessibilityHint={addingOwner ? 'Adds the unit owner' : 'Adds a household member'} />
      </FormSection>
      <Text style={styles.note}>Giving a household member their own app login is handled by your community admin.</Text>
    </FormScreen>
  );
}

/** Vehicles: list across the resident's units + register (Req 19.1, 19.2). */
function VehiclesView({ resources, units, onBack }: { resources: ResourceClients; units: Unit[]; onBack: () => void }) {
  const primaryUnit = units[0] ?? null;
  const list = useAsync<Vehicle[]>(
    async (signal) => {
      const lists = await Promise.all(units.map((u) => resources.units.listVehicles(u.id, { signal }).catch(() => [])));
      return lists.flat();
    },
    [units.map((u) => u.id).join(',')],
  );
  const [unitId, setUnitId] = useState<string | null>(primaryUnit?.id ?? null);
  const [reg, setReg] = useState('');
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const communityId = primaryUnit?.communityId;
  const add = useAsyncAction(async () => {
    await resources.units.registerVehicle({ unitId: unitId!, registrationNumber: reg.trim(), vehicleType: vehicleType! });
    showSuccessAlert('Vehicle registered.', 'Done');
    setReg('');
    setVehicleType(null);
  });
  const onSubmit = async () => {
    if (!unitId) { warn('Select a unit.'); return; }
    if (!reg.trim()) { warn('Enter the registration number.'); return; }
    if (!vehicleType) { warn('Select a vehicle type.'); return; }
    if (await add.run()) list.reload();
  };
  return (
    <FormScreen title="Vehicles" subtitle="Registered to your household" onBack={onBack}>
      <FormSection title="Your vehicles" icon="car-sport" tint={theme.color.warning}>
        <AsyncBoundary loading={list.loading} error={list.error} empty={!list.loading && (list.data?.length ?? 0) === 0} emptyMessage="No vehicles registered yet." onRetry={list.reload}>
          <View style={styles.list}>
            {(list.data ?? []).map((v) => (
              <EntityCard key={v.id} title={v.registrationNumber} subtitle={humanizeCode(v.vehicleType)} icon="car-sport" tint={theme.color.warning} />
            ))}
          </View>
        </AsyncBoundary>
      </FormSection>

      <FormSection title="Register a vehicle" icon="add-circle" tint={theme.color.success}>
        {units.length > 1 ? (
          <Select label="Unit" required value={unitId} onChange={setUnitId} options={units.map((u) => ({ value: u.id, label: `Unit ${u.unitNumber}` }))} />
        ) : null}
        <AppTextField label="Registration number" required value={reg} onChangeText={setReg} autoCapitalize="characters" editable={!add.running} placeholder="e.g. MH12AB1234" />
        <MasterDataDropdown label="Vehicle type" required listKey="Vehicle_Type" masterData={resources.masterData} value={vehicleType} onChange={setVehicleType} {...(communityId ? { communityId } : {})} />
        <AppButton title="Register vehicle" loading={add.running} onPress={onSubmit} accessibilityHint="Registers a vehicle" />
      </FormSection>
    </FormScreen>
  );
}

/** Emergency contacts: list + add (Req 15.3). */
function ContactsView({ resources, residentId, onBack }: { resources: ResourceClients; residentId: string; onBack: () => void }) {
  const list = useAsync<EmergencyContact[]>((signal) => resources.residents.listEmergencyContacts(residentId, { signal }), [residentId]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const add = useAsyncAction(async () => {
    await resources.residents.addEmergencyContact(residentId, { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() });
    showSuccessAlert('Emergency contact added.', 'Done');
    setName(''); setPhone(''); setRelationship('');
  });
  const onSubmit = async () => {
    if (!name.trim()) { warn('Enter the contact name.'); return; }
    if (!phone.trim()) { warn('Enter the contact phone.'); return; }
    if (!relationship.trim()) { warn('Enter the relationship.'); return; }
    if (await add.run()) list.reload();
  };
  return (
    <FormScreen title="Emergency contacts" subtitle="People to reach in an emergency" onBack={onBack}>
      <FormSection title="Your contacts" icon="call" tint={theme.color.success}>
        <AsyncBoundary loading={list.loading} error={list.error} empty={!list.loading && (list.data?.length ?? 0) === 0} emptyMessage="No emergency contacts on file." onRetry={list.reload}>
          <View style={styles.list}>
            {(list.data ?? []).map((c) => (
              <EntityCard key={c.id} title={c.name} subtitle={`${humanizeCode(c.relationship)} · ${c.phone}`} icon="call" tint={theme.color.success} />
            ))}
          </View>
        </AsyncBoundary>
      </FormSection>

      <FormSection title="Add a contact" icon="add-circle" tint={theme.color.primary}>
        <AppTextField label="Name" required value={name} onChangeText={setName} editable={!add.running} placeholder="Contact name" />
        <AppTextField label="Phone" required value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!add.running} placeholder="+91…" />
        <AppTextField label="Relationship" required value={relationship} onChangeText={setRelationship} editable={!add.running} placeholder="e.g. Brother, Neighbour" />
        <AppButton title="Add contact" loading={add.running} onPress={onSubmit} accessibilityHint="Adds an emergency contact" />
      </FormSection>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.color.hero,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadow.hero,
  },
  avatar: {
    width: 72, height: 72, borderRadius: theme.radius.pill,
    backgroundColor: theme.color.onHeroSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  name: { fontSize: theme.fontSize.title, fontWeight: '800', color: theme.color.primaryText },
  sub: { fontSize: theme.fontSize.label, color: theme.color.primaryText, opacity: 0.85, fontWeight: '700' },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.color.onHeroSoft, borderRadius: theme.radius.pill,
    paddingVertical: 5, paddingHorizontal: theme.spacing.md, maxWidth: '100%',
  },
  heroChipText: { color: theme.color.primaryText, fontSize: theme.fontSize.caption, fontWeight: '600' },
  tile: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.color.surface, borderRadius: theme.radius.lg,
    padding: theme.spacing.md, ...theme.shadow.soft,
  },
  pressed: { opacity: 0.85 },
  tileIcon: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1 },
  tileTitle: { fontSize: theme.fontSize.body, fontWeight: '700', color: theme.color.text },
  tileSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: 2 },
  list: { gap: theme.spacing.sm },
  actions: { marginTop: theme.spacing.sm },
  note: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: theme.spacing.sm, lineHeight: 18 },
  memberList: { gap: theme.spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  memberIcon: { width: 32, height: 32, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  memberText: { flex: 1 },
  memberName: { fontSize: theme.fontSize.label, fontWeight: '700', color: theme.color.text },
  memberSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: 1 },
});
