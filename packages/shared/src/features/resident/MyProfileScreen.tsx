import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { AppTextField } from '../../ui/AppTextField';
import { PhoneField } from '../../ui/PhoneField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { Badge } from '../../ui/Badge';
import { BottomSheet } from '../../ui/BottomSheet';
import { MasterDataDropdown } from '../../ui/MasterDataDropdown';
import { Select } from '../../ui/Select';
import { showSuccessAlert } from '../../ui/errorAlert';
import { emitToast } from '../../ui/toastBus';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { useMyResident } from './useMyResident';
import type { EmergencyContact, Vehicle, ResidentHouseholdUnit } from '../../models/resident';
import type { Unit, UnitHouseholdMember } from '../../models/community';
import type { PagedData } from '../../models/envelope';
import type { ResourceClients } from '../../resources';
import { humanizeCode } from '../shared/status';

export interface MyProfileScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

type ProfileView =
  | { name: 'menu' }
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
 * data is self-scoped server-side. A hero + menu routes to each sub-view; contact details is an
 * inline edit form (a single always-present record), while family / vehicles / emergency contacts
 * are **card lists with a header "+" that opens a keyboard-aware bottom sheet** to add — matching
 * the admin screens. (The backend offers add+view only for those three; no edit/delete yet.)
 */
export function MyProfileScreen({ resources, onBack }: MyProfileScreenProps) {
  const [view, setView] = useState<ProfileView>({ name: 'menu' });
  const [editingContact, setEditingContact] = useState(false);
  // GET /residents/me returns ONLY the signed-in person's own resident row (matched by the token's
  // user id server-side) or null — so a non-resident principal (superadmin) gets null and sees the
  // empty state, never a stranger's profile. No client-side userId guard needed anymore.
  const me = useMyResident(resources);
  const resident = me.data?.resident ?? null;
  const units = me.data?.units ?? [];
  // Only show a unit on the hero when the resident has exactly one (don't guess "the first" of many).
  const soleUnit = units.length === 1 ? units[0]! : null;

  const back = () => setView({ name: 'menu' });

  if (view.name === 'family' && resident) {
    return <FamilyView resources={resources} myUnits={units} communityId={resident.communityId} onBack={back} />;
  }
  if (view.name === 'vehicles') {
    return <VehiclesView resources={resources} myUnits={units} onBack={back} />;
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
                {soleUnit ? <HeroMeta icon="home-outline" label={`Unit ${soleUnit.unitNumber}`} /> : null}
              </View>
            </View>

            <MenuTile icon="create-outline" tint={theme.color.primary} title="Edit contact details" subtitle="Name, email and phone" onPress={() => setEditingContact(true)} />
            <MenuTile icon="people-outline" tint={theme.color.info} title="Family members" subtitle="View and add household members" onPress={() => setView({ name: 'family' })} />
            <MenuTile icon="car-outline" tint={theme.color.warning} title="Vehicles" subtitle="View and register your vehicles" onPress={() => setView({ name: 'vehicles' })} />
            <MenuTile icon="call-outline" tint={theme.color.success} title="Emergency contacts" subtitle="People to reach in an emergency" onPress={() => setView({ name: 'contacts' })} />

            <EditContactSheet
              resources={resources}
              resident={resident}
              visible={editingContact}
              onClose={() => setEditingContact(false)}
              onSaved={() => { setEditingContact(false); me.reload(); }}
            />
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

/**
 * Reusable keyboard-aware bottom sheet for the resident "add" flows (same structure as the admin
 * SecuritySheet): backdrop + grabber + header with close, a bounded inner ScrollView of fields, and
 * a pinned submit button. The whole sheet lifts above the keyboard (Android Modals ignore
 * adjustResize). Fields + submit are passed in by the caller.
 */
function AddSheet({
  visible,
  title,
  submitLabel,
  submitting,
  onSubmit,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={<AppButton title={submitLabel} loading={submitting} onPress={onSubmit} />}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

/** Edit the resident's own contact details (Req 15.1) — a bottom-sheet popup (just 3 fields). */
function EditContactSheet({ resources, resident, visible, onClose, onSaved }: { resources: ResourceClients; resident: { id: string; name: string; email: string | null; phone: string | null }; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(resident.name);
  const [email, setEmail] = useState(resident.email ?? '');
  const [phone, setPhone] = useState(resident.phone ?? '');

  // Reset to the current values each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setName(resident.name);
      setEmail(resident.email ?? '');
      setPhone(resident.phone ?? '');
    }
  }, [visible, resident]);

  const save = useAsyncAction(async () => {
    await resources.residents.update(resident.id, {
      name: name.trim(),
      email: email.trim() === '' ? null : email.trim(),
      updateEmail: true,
      phone: phone.trim() === '' ? null : phone.trim(),
      updatePhone: true,
    });
    showSuccessAlert('Your contact details were saved.', 'Saved');
    onSaved();
  });
  const onSubmit = () => {
    if (!name.trim()) { warn('Please enter your full name.'); return; }
    void save.run();
  };
  return (
    <AddSheet
      visible={visible}
      title="Edit contact details"
      submitLabel="Save changes"
      submitting={save.running}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      <AppTextField label="Full name" required value={name} onChangeText={setName} editable={!save.running} placeholder="Your name" autoCapitalize="words" />
      <AppTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!save.running} placeholder="you@example.com" />
      <PhoneField label="Phone" value={phone} onChangeText={setPhone} editable={!save.running} />
    </AddSheet>
  );
}

/**
 * Family / household members (Req 15.1, 15.2): a card list of the unit's current members + a header
 * "+" that opens an add sheet with the OWNER-FIRST rule (no owner yet → the first person added IS
 * the owner, one-time; else a family member). Add+view only (no edit/delete on the backend).
 */
function FamilyView({ resources, myUnits, communityId, onBack }: { resources: ResourceClients; myUnits: ResidentHouseholdUnit[]; communityId: string | null; onBack: () => void }) {
  const hasOwnUnit = myUnits.length > 0;
  // When the resident has NO unit of their own, let them pick a community unit (the owner-assign
  // case). We load community units ON DEMAND only in that case — never for a resident who already
  // has a unit (they use their own, no dropdown, no community-wide load).
  const pickable = useAsync<PagedData<Unit>>(
    (signal) => (hasOwnUnit ? Promise.resolve({ items: [], page: 1, pageSize: 0, totalCount: 0 } as PagedData<Unit>) : resources.units.list({ pageSize: 100 }, {}, { signal })),
    [hasOwnUnit],
  );

  // The unit set to work with: the resident's OWN units, or (when they have none) community units.
  const ownOptions = myUnits.map((u) => ({ id: u.unitId, unitNumber: u.unitNumber, communityId: u.communityId }));
  const communityOptions = (pickable.data?.items ?? []).map((u) => ({ id: u.id, unitNumber: u.unitNumber, communityId: u.communityId }));
  const unitChoices = hasOwnUnit ? ownOptions : communityOptions;

  // Auto-select when there's exactly one choice; otherwise require an explicit pick (never guess).
  const soleUnitId = unitChoices.length === 1 ? unitChoices[0]!.id : null;
  const [unitId, setUnitId] = useState<string | null>(soleUnitId);
  const effectiveUnitId = unitId ?? soleUnitId;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const selectedUnit = unitChoices.find((u) => u.id === effectiveUnitId) ?? null;
  const uploadCommunityId = selectedUnit?.communityId ?? communityId;

  const household = useAsync<UnitHouseholdMember[]>(
    (signal) => (effectiveUnitId ? resources.units.listHousehold(effectiveUnitId, { signal }) : Promise.resolve([])),
    [effectiveUnitId],
  );
  const members = household.data ?? [];
  const hasOwner = members.some((m) => m.residentType === 'owner');
  const memberType = hasOwner ? 'family_member' : 'owner';
  const addingOwner = !hasOwner;

  const openSheet = () => { setName(''); setPhone(''); setEmail(''); setRelationship(''); setSheetOpen(true); };

  const add = useAsyncAction(async () => {
    const member = await resources.residents.create({
      communityId: uploadCommunityId!,
      name: name.trim(),
      residentType: memberType,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
    });
    const rel = addingOwner ? 'owner' : relationship.trim();
    await resources.residents.addHousehold(member.id, { unitId: effectiveUnitId!, relationship: rel });
    showSuccessAlert(
      addingOwner ? `${name.trim()} was added as the unit owner.` : `${name.trim()} was added to your household.`,
      addingOwner ? 'Owner added' : 'Family member added',
    );
    setSheetOpen(false);
    household.reload();
  });

  const onSubmit = () => {
    if (!selectedUnit) { warn('Select a unit.'); return; }
    if (!name.trim()) { warn('Enter the person\u2019s name.'); return; }
    if (!addingOwner && !relationship.trim()) { warn('Enter the relationship (e.g. Spouse).'); return; }
    void add.run();
  };

  const needsPick = unitChoices.length > 1 && !effectiveUnitId;

  return (
    <FormScreen
      title="Family members"
      subtitle={selectedUnit ? `Unit ${selectedUnit.unitNumber}` : 'Choose a unit'}
      onBack={onBack}
      headerRight={
        <Pressable onPress={openSheet} accessibilityRole="button" accessibilityLabel="Add member" hitSlop={8}>
          <Ionicons name="add" size={26} color={theme.color.primaryText} />
        </Pressable>
      }
    >
      {!hasOwnUnit ? (
        <Text style={styles.note}>You don't have a unit yet. Choose one below to set up your household.</Text>
      ) : null}
      {unitChoices.length > 1 ? (
        <View style={styles.pickUnit}>
          <Select label="Unit" required value={effectiveUnitId} onChange={setUnitId} options={unitChoices.map((u) => ({ value: u.id, label: `Unit ${u.unitNumber}` }))} placeholder="Choose a unit" />
        </View>
      ) : null}

      <AsyncBoundary
        loading={household.loading || pickable.loading}
        error={household.error}
        empty={!household.loading && Boolean(effectiveUnitId) && members.length === 0}
        emptyMessage={needsPick ? 'Choose a unit above to view its household.' : addingOwner ? "No one is in this unit's household yet. Tap + to add the owner." : 'No household members yet. Tap + to add one.'}
        onRetry={household.reload}
      >
        <View style={styles.list}>
          {members.map((m) => {
            const isOwner = m.residentType === 'owner';
            const tint = isOwner ? theme.color.success : theme.color.info;
            return (
              <View key={m.residentId} style={styles.card}>
                <View style={[styles.cardIcon, { backgroundColor: `${tint}1f` }]}>
                  <Ionicons name={isOwner ? 'key' : 'person'} size={20} color={tint} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.cardSub} numberOfLines={1}>{humanizeCode(m.relationship)}</Text>
                </View>
                <Badge label={humanizeCode(m.residentType)} tone={isOwner ? 'positive' : 'neutral'} />
              </View>
            );
          })}
        </View>
      </AsyncBoundary>

      <Text style={styles.note}>Giving a household member their own app login is handled by your community admin.</Text>

      <AddSheet
        visible={sheetOpen}
        title={addingOwner ? 'Add unit owner' : 'Add family member'}
        submitLabel={addingOwner ? 'Add owner' : 'Add member'}
        submitting={add.running}
        onSubmit={onSubmit}
        onClose={() => setSheetOpen(false)}
      >
        {addingOwner ? (
          <Text style={styles.note}>This unit has no owner yet, so the first person you add becomes the unit owner.</Text>
        ) : null}
        <AppTextField label="Full name" required value={name} onChangeText={setName} editable={!add.running} placeholder="e.g. Priya Sharma" autoCapitalize="words" />
        {!addingOwner ? (
          <AppTextField label="Relationship" required value={relationship} onChangeText={setRelationship} editable={!add.running} placeholder="e.g. Spouse, Son, Daughter" />
        ) : null}
        <PhoneField label="Contact number" value={phone} onChangeText={setPhone} editable={!add.running} />
        <AppTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!add.running} placeholder="name@example.com" />
        {unitChoices.length > 1 ? (
          <Select label="Unit" required value={effectiveUnitId} onChange={setUnitId} options={unitChoices.map((u) => ({ value: u.id, label: `Unit ${u.unitNumber}` }))} />
        ) : null}
      </AddSheet>
    </FormScreen>
  );
}

/** Vehicles (Req 19.1, 19.2): a card list across the resident's units + a "+" add sheet. Add+view only. */
function VehiclesView({ resources, myUnits, onBack }: { resources: ResourceClients; myUnits: ResidentHouseholdUnit[]; onBack: () => void }) {
  const hasUnit = myUnits.length > 0;
  // Vehicles are registered against the resident's OWN unit(s). Pre-select the only one; otherwise
  // require an explicit pick (never guess).
  const soleUnitId = myUnits.length === 1 ? myUnits[0]!.unitId : null;
  const list = useAsync<Vehicle[]>(
    async (signal) => {
      const lists = await Promise.all(myUnits.map((u) => resources.units.listVehicles(u.unitId, { signal }).catch(() => [])));
      return lists.flat();
    },
    [myUnits.map((u) => u.unitId).join(',')],
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(soleUnitId);
  const [reg, setReg] = useState('');
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const selectedUnit = myUnits.find((u) => u.unitId === unitId) ?? null;

  const openSheet = () => { setReg(''); setVehicleType(null); setUnitId(soleUnitId); setSheetOpen(true); };

  const add = useAsyncAction(async () => {
    await resources.units.registerVehicle({ unitId: selectedUnit!.unitId, registrationNumber: reg.trim(), vehicleType: vehicleType! });
    showSuccessAlert('Vehicle registered.', 'Done');
    setSheetOpen(false);
    list.reload();
  });
  const onSubmit = () => {
    if (!selectedUnit) { warn('Select a unit.'); return; }
    if (!reg.trim()) { warn('Enter the registration number.'); return; }
    if (!vehicleType) { warn('Select a vehicle type.'); return; }
    void add.run();
  };

  // No unit assigned yet → no household to register vehicles against.
  if (!hasUnit) {
    return (
      <FormScreen title="Vehicles" subtitle="Your household" onBack={onBack}>
        <View style={styles.card}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.color.mutedText}1f` }]}>
            <Ionicons name="car-outline" size={20} color={theme.color.mutedText} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>No unit assigned yet</Text>
            <Text style={styles.cardSub}>Your community admin assigns your unit. Once you have one, you can register vehicles here.</Text>
          </View>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Vehicles"
      subtitle="Registered to your household"
      onBack={onBack}
      headerRight={
        <Pressable onPress={openSheet} accessibilityRole="button" accessibilityLabel="Register vehicle" hitSlop={8}>
          <Ionicons name="add" size={26} color={theme.color.primaryText} />
        </Pressable>
      }
    >
      <AsyncBoundary loading={list.loading} error={list.error} empty={!list.loading && (list.data?.length ?? 0) === 0} emptyMessage="No vehicles registered yet. Tap + to add one." onRetry={list.reload}>
        <View style={styles.list}>
          {(list.data ?? []).map((v) => (
            <View key={v.id} style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: `${theme.color.warning}1f` }]}>
                <Ionicons name="car-sport" size={20} color={theme.color.warning} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{v.registrationNumber}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{humanizeCode(v.vehicleType)}</Text>
              </View>
            </View>
          ))}
        </View>
      </AsyncBoundary>

      <AddSheet
        visible={sheetOpen}
        title="Register a vehicle"
        submitLabel="Register vehicle"
        submitting={add.running}
        onSubmit={onSubmit}
        onClose={() => setSheetOpen(false)}
      >
        {myUnits.length > 1 ? (
          <Select label="Unit" required value={unitId} onChange={setUnitId} options={myUnits.map((u) => ({ value: u.unitId, label: `Unit ${u.unitNumber}` }))} placeholder="Choose a unit" />
        ) : null}
        <AppTextField label="Registration number" required value={reg} onChangeText={setReg} autoCapitalize="characters" editable={!add.running} placeholder="e.g. MH12AB1234" />
        <MasterDataDropdown label="Vehicle type" required listKey="Vehicle_Type" masterData={resources.masterData} value={vehicleType} onChange={setVehicleType} {...(selectedUnit ? { communityId: selectedUnit.communityId } : {})} />
      </AddSheet>
    </FormScreen>
  );
}

/** Emergency contacts (Req 15.3): a card list + a "+" add sheet. Add+view only. */
function ContactsView({ resources, residentId, onBack }: { resources: ResourceClients; residentId: string; onBack: () => void }) {
  const list = useAsync<EmergencyContact[]>((signal) => resources.residents.listEmergencyContacts(residentId, { signal }), [residentId]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const openSheet = () => { setName(''); setPhone(''); setRelationship(''); setSheetOpen(true); };

  const add = useAsyncAction(async () => {
    await resources.residents.addEmergencyContact(residentId, { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() });
    showSuccessAlert('Emergency contact added.', 'Done');
    setSheetOpen(false);
    list.reload();
  });
  const onSubmit = () => {
    if (!name.trim()) { warn('Enter the contact name.'); return; }
    if (!phone.trim()) { warn('Enter the contact phone.'); return; }
    if (!relationship.trim()) { warn('Enter the relationship.'); return; }
    void add.run();
  };

  return (
    <FormScreen
      title="Emergency contacts"
      subtitle="People to reach in an emergency"
      onBack={onBack}
      headerRight={
        <Pressable onPress={openSheet} accessibilityRole="button" accessibilityLabel="Add contact" hitSlop={8}>
          <Ionicons name="add" size={26} color={theme.color.primaryText} />
        </Pressable>
      }
    >
      <AsyncBoundary loading={list.loading} error={list.error} empty={!list.loading && (list.data?.length ?? 0) === 0} emptyMessage="No emergency contacts on file. Tap + to add one." onRetry={list.reload}>
        <View style={styles.list}>
          {(list.data ?? []).map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: `${theme.color.success}1f` }]}>
                <Ionicons name="call" size={20} color={theme.color.success} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{humanizeCode(c.relationship)} · {c.phone}</Text>
              </View>
            </View>
          ))}
        </View>
      </AsyncBoundary>

      <AddSheet
        visible={sheetOpen}
        title="Add emergency contact"
        submitLabel="Add contact"
        submitting={add.running}
        onSubmit={onSubmit}
        onClose={() => setSheetOpen(false)}
      >
        <AppTextField label="Name" required value={name} onChangeText={setName} editable={!add.running} placeholder="Contact name" autoCapitalize="words" />
        <PhoneField label="Phone" required value={phone} onChangeText={setPhone} editable={!add.running} />
        <AppTextField label="Relationship" required value={relationship} onChangeText={setRelationship} editable={!add.running} placeholder="e.g. Brother, Neighbour" />
      </AddSheet>
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

  // Unit chooser shown above the household list when the resident has multiple units.
  pickUnit: { gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  // Card list (members / vehicles / contacts).
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.color.surface, borderRadius: theme.radius.lg,
    padding: theme.spacing.md, ...theme.shadow.soft,
  },
  cardIcon: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  cardSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },

  note: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: theme.spacing.sm, lineHeight: 18 },

  // Bottom-sheet field column (the sheet chrome is the shared BottomSheet).
  sheetScroll: { gap: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },
});
