import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../ui/TopBar';
import { BottomTabBar, type TabKey } from '../ui/BottomTabBar';
import { FeatureTile } from '../ui/FeatureTile';
import { QuickActionCard } from '../ui/QuickActionCard';
import { StatChip } from '../ui/StatChip';
import { SectionHeading } from '../ui/SectionHeading';
import { theme } from '../ui/theme';
import { useAsync } from '../ui/hooks';
import { useNavStack } from '../ui/navStack';
import { useAuth } from '../auth/AuthContext';
import { LogoutButton } from '../screens/LogoutButton';
import type { ResourceClients, GateOfflineQueue } from '../resources';
import type { Community, Unit } from '../models/community';
import { CommunityListScreen } from './admin/CommunityListScreen';
import { CommunityManageScreen } from './admin/CommunityManageScreen';
import { CommunityFormScreen } from './admin/CommunityFormScreen';
import { WingsScreen } from './admin/WingsScreen';
import { UnitListScreen } from './admin/UnitListScreen';
import { UnitFormScreen } from './admin/UnitFormScreen';
import { UnitDetailScreen } from './admin/UnitDetailScreen';
import { ResidentListScreen } from './admin/ResidentListScreen';
import { AddResidentScreen } from './admin/AddResidentScreen';
import { MyHouseholdScreen } from './resident/MyHouseholdScreen';
import { MyProfileScreen } from './resident/MyProfileScreen';
import { CommunicationPreferencesScreen } from './resident/CommunicationPreferencesScreen';
import { InviteVisitorScreen } from './resident/InviteVisitorScreen';
import { MyVisitorsScreen } from './resident/MyVisitorsScreen';
import { WalkInApprovalsScreen } from './resident/WalkInApprovalsScreen';
import { RecurringVisitorsScreen } from './resident/RecurringVisitorsScreen';
import { ParcelListScreen } from './resident/ParcelListScreen';
import { RaiseTicketScreen } from './resident/RaiseTicketScreen';
import { TicketListScreen } from './resident/TicketListScreen';
import { AnnouncementsScreen } from './resident/AnnouncementsScreen';
import { GuardLookupScreen } from './guard/LookupScreen';
import { VisitPassVerifyScreen } from './guard/VisitPassVerifyScreen';
import { WalkInCaptureScreen } from './guard/WalkInCaptureScreen';
import { EntryExitLogScreen } from './guard/EntryExitLogScreen';
import { WatchlistScreen } from './guard/WatchlistScreen';
import { SosScreen } from './guard/SosScreen';
import { RegisterParcelScreen } from './guard/RegisterParcelScreen';
import { ParcelCustodyScreen } from './guard/ParcelCustodyScreen';
import { ParcelHandoverScreen } from './guard/ParcelHandoverScreen';
import { WorkOrderListScreen } from './guard/WorkOrderListScreen';
import { AssetLookupScreen } from './guard/AssetLookupScreen';

export interface HomeNavigatorProps {
  resources: ResourceClients;
  /** Which app this is — picks the feature set (resident self-service vs guard operations). */
  app: 'resident' | 'guard';
  /**
   * Whether to surface the admin management section. Computed from the signed-in roles; the server
   * still enforces real authz, so this flag only decides what to *offer*, never what is *allowed*.
   */
  isAdmin?: boolean;
  /** Shown as the home heading / app name fallback, e.g. "Resident" / "Guard". */
  appTitle: string;
  /** Optional offline write queue (guard app) for the gate entry/exit screen (Task 17.1). */
  offlineQueue?: GateOfflineQueue;
}

/**
 * Authenticated app shell: a persistent {@link TopBar} (society/app name + user, notification bell)
 * and {@link BottomTabBar} (Home · Services · Profile) around three tab bodies, with feature screens
 * pushed full-screen over the shell. Still a minimal state-based navigator (no navigation library) —
 * the surface is a tab switch plus a one-level drill-down, so a `useState` route is the smallest
 * correct thing. Everything is styled from the shared {@link theme}, so a global colour change flows
 * through the whole shell.
 */
export function HomeNavigator({ resources, app, isAdmin = false, appTitle, offlineQueue }: HomeNavigatorProps) {
  const { displayName, roles } = useAuth();
  // A real route stack (not a single route): pushing a feature screen keeps the shell beneath it,
  // the Android hardware-back pops one screen, and only the top route renders (per-route rendering).
  const nav = useNavStack<Route>({ name: 'tabs', tab: 'home' });
  const route = nav.current;
  const go = (r: Route) => nav.push(r);
  const back = () => nav.pop();
  // Tab switching models standard app tab history so the hardware back is never a dead-end:
  //  - Home       → stack [Home]              (back from Home exits the app, as expected)
  //  - Services   → stack [Home, Services]    (back returns to Home, not out of the app)
  //  - Profile    → stack [Home, Profile]     (back returns to Home)
  // Any open feature screen is cleared by the rebuild (switching tabs resets the drill-down).
  const setTab = (tab: TabKey) => {
    const homeBase: Route = { name: 'tabs', tab: 'home' };
    nav.replaceAll(tab === 'home' ? [homeBase] : [homeBase, { name: 'tabs', tab }]);
  };

  // Society name for the top bar: the first community the signed-in user can see, else the app name.
  const societyQuery = useAsync(
    (signal) => resources.communities.list({ pageSize: 1 }, {}, { signal }),
    [resources],
  );
  const societyName =
    societyQuery.data?.items?.[0]?.name ?? `CommunityOS · ${appTitle}`;

  // Prefer the signed-in person's real NAME in the header, not the phone/email they logged in with.
  // In the resident app the self-scoped list returns only the user's own resident row, so its name
  // is the user's name. Admin/guard principals have no resident row → fall back to the identifier.
  const meQuery = useAsync(
    (signal) =>
      app === 'resident'
        ? resources.residents.list({ pageSize: 1 }, {}, { signal })
        : Promise.resolve(null),
    [resources, app],
  );
  const residentName = meQuery.data?.items?.[0]?.name;
  const userName = residentName ?? displayName ?? 'Signed in';

  // Only the top route renders. Feature detail screens render full-screen (their own back → pop).
  switch (route.name) {
    case 'communities':
      return (
        <CommunityListScreen
          resources={resources}
          onBack={back}
          onOpenCommunity={(community) => go({ name: 'communityManage', community })}
          onCreate={(organizationId) => go({ name: 'communityForm', ...(organizationId ? { organizationId } : {}) })}
        />
      );
    case 'communityManage':
      return (
        <CommunityManageScreen
          community={route.community}
          onBack={back}
          onEdit={() => go({ name: 'communityForm', community: route.community })}
          onWings={() => go({ name: 'wings', community: route.community })}
          onAddUnit={() => go({ name: 'unitForm', community: route.community })}
          onViewUnits={() => go({ name: 'units', community: route.community })}
        />
      );
    case 'communityForm':
      return (
        <CommunityFormScreen
          resources={resources}
          {...(route.community ? { community: route.community } : {})}
          {...(route.organizationId ? { organizationId: route.organizationId } : {})}
          onBack={back}
          onSaved={() => back()}
        />
      );
    case 'wings':
      return <WingsScreen resources={resources} community={route.community} onBack={back} />;
    case 'unitForm':
      return (
        <UnitFormScreen
          resources={resources}
          community={route.community}
          onBack={back}
          onSaved={() => back()}
        />
      );
    case 'units':
      return (
        <UnitListScreen
          resources={resources}
          {...(route.community ? { community: route.community } : {})}
          onBack={back}
          onOpenUnit={(unit) => go({ name: 'unit', unit, origin: { name: 'units', community: route.community } })}
          {...(route.community ? { onAddUnit: () => go({ name: 'unitForm', community: route.community! }) } : {})}
        />
      );
    case 'allUnits':
      return (
        <UnitListScreen
          resources={resources}
          onBack={back}
          onOpenUnit={(unit) => go({ name: 'unit', unit, origin: { name: 'allUnits' } })}
        />
      );
    case 'unit':
      return (
        <UnitDetailScreen
          resources={resources}
          unitId={route.unit.id}
          initialUnit={route.unit}
          onBack={back}
        />
      );
    case 'residents':
      return <ResidentListScreen resources={resources} onBack={back} onAddResident={() => go({ name: 'addResident' })} />;
    case 'queue':
      return <ResidentListScreen resources={resources} queueOnly onBack={back} />;
    case 'addResident':
      return <AddResidentScreen resources={resources} onBack={back} onSaved={() => back()} />;
    case 'myHousehold':
      return <MyHouseholdScreen resources={resources} onBack={back} />;
    case 'myProfile':
      return <MyProfileScreen resources={resources} onBack={back} />;
    case 'commPrefs':
      return <CommunicationPreferencesScreen resources={resources} onBack={back} />;
    case 'lookup':
      return <GuardLookupScreen resources={resources} onBack={back} />;
    case 'inviteVisitor':
      return <InviteVisitorScreen resources={resources} onBack={back} />;

    case 'myVisitors':
      return <MyVisitorsScreen resources={resources} onBack={back} />;
    case 'walkInApprovals':
      return <WalkInApprovalsScreen resources={resources} onBack={back} />;
    case 'recurringVisitors':
      return <RecurringVisitorsScreen resources={resources} onBack={back} />;
    case 'myParcels':
      return <ParcelListScreen resources={resources} onBack={back} />;
    case 'raiseTicket':
      return <RaiseTicketScreen resources={resources} onBack={back} />;
    case 'myTickets':
      return <TicketListScreen resources={resources} onBack={back} />;
    case 'announcements':
      return <AnnouncementsScreen resources={resources} onBack={back} />;
    case 'verifyPass':
      return <VisitPassVerifyScreen resources={resources} onBack={back} />;
    case 'walkInCapture':
      return <WalkInCaptureScreen resources={resources} onBack={back} />;
    case 'entryExit':
      return (
        <EntryExitLogScreen
          resources={resources}
          {...(offlineQueue ? { offlineQueue } : {})}
          onBack={back}
        />
      );
    case 'watchlist':
      return <WatchlistScreen resources={resources} onBack={back} />;
    case 'sos':
      return <SosScreen resources={resources} onBack={back} />;
    case 'registerParcel':
      return <RegisterParcelScreen resources={resources} onBack={back} />;
    case 'parcelCustody':
      return <ParcelCustodyScreen resources={resources} onBack={back} />;
    case 'parcelHandover':
      return <ParcelHandoverScreen resources={resources} onBack={back} />;
    case 'workOrders':
      return (
        <WorkOrderListScreen
          resources={resources}
          {...(route.assetId ? { assetId: route.assetId } : {})}
          {...(route.title ? { title: route.title } : {})}
          onBack={back}
        />
      );
    case 'assetLookup':
      return (
        <AssetLookupScreen
          resources={resources}
          onOpenWorkOrders={(asset) =>
            go({ name: 'workOrders', assetId: asset.id, title: `Work orders · ${asset.name}` })
          }
          onBack={back}
        />
      );
    case 'tabs':
    default: {
      const tab = route.tab;
      return (
        <View style={styles.shell}>
          <TopBar title={societyName} subtitle={userName} notificationCount={0} />
          <View style={styles.body}>
            {tab === 'home' ? (
              <DashboardTab app={app} appTitle={appTitle} userName={userName} onNavigate={go} onOpenServices={() => setTab('services')} />
            ) : tab === 'services' ? (
              <ServicesTab app={app} isAdmin={isAdmin} onNavigate={go} />
            ) : (
              <ProfileTab
                userName={userName}
                appTitle={appTitle}
                societyName={societyName}
                roles={roles}
                {...(app === 'resident' ? { onManageProfile: () => go({ name: 'myProfile' }) } : {})}
              />
            )}
          </View>
          <BottomTabBar active={tab} onChange={setTab} />
        </View>
      );
    }
  }
}

/** Where the unit detail returns to — the list the user opened it from. */
type UnitOrigin = { name: 'units'; community?: Community } | { name: 'allUnits' };

/** The internal route union for the authenticated area. `tabs` is the shell; the rest are detail screens. */
type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'communities' }
  | { name: 'communityManage'; community: Community }
  | { name: 'communityForm'; community?: Community; organizationId?: string }
  | { name: 'wings'; community: Community }
  | { name: 'unitForm'; community: Community }
  | { name: 'units'; community?: Community }
  | { name: 'allUnits' }
  | { name: 'unit'; unit: Unit; origin: UnitOrigin }
  | { name: 'residents' }
  | { name: 'queue' }
  | { name: 'addResident' }
  | { name: 'myHousehold' }
  | { name: 'myProfile' }
  | { name: 'commPrefs' }
  | { name: 'lookup' }
  | { name: 'inviteVisitor' }
  | { name: 'myVisitors' }
  | { name: 'walkInApprovals' }
  | { name: 'recurringVisitors' }
  | { name: 'myParcels' }
  | { name: 'raiseTicket' }
  | { name: 'myTickets' }
  | { name: 'announcements' }
  | { name: 'verifyPass' }
  | { name: 'walkInCapture' }
  | { name: 'entryExit' }
  | { name: 'watchlist' }
  | { name: 'sos' }
  | { name: 'registerParcel' }
  | { name: 'parcelCustody' }
  | { name: 'parcelHandover' }
  | { name: 'workOrders'; assetId?: string; title?: string }
  | { name: 'assetLookup' };

/** A feature entry in the Services grid. */
interface Feature {
  readonly route: Route;
  readonly label: string;
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly tint?: string;
}

/** A labelled group of features for the Services grid. */
interface FeatureGroup {
  readonly title: string;
  readonly features: readonly Feature[];
}

/** Resident feature groups (self-service). */
function residentGroups(): FeatureGroup[] {
  return [
    {
      title: 'My home',
      features: [
        { route: { name: 'myProfile' }, label: 'My Profile', icon: 'person-circle', tint: theme.color.primary },
        { route: { name: 'myHousehold' }, label: 'My Household', icon: 'home', tint: theme.color.info },
        { route: { name: 'commPrefs' }, label: 'Preferences', icon: 'options', tint: '#8250df' },
      ],
    },
    {
      title: 'Visitors',
      features: [
        { route: { name: 'inviteVisitor' }, label: 'Invite Visitor', icon: 'person-add', tint: '#1a7f37' },
        { route: { name: 'myVisitors' }, label: 'My Visitors', icon: 'people', tint: '#0969da' },
        { route: { name: 'walkInApprovals' }, label: 'Approvals', icon: 'checkmark-done', tint: '#bf8700' },
        { route: { name: 'recurringVisitors' }, label: 'Recurring', icon: 'repeat', tint: '#0969da' },
      ],
    },
    {
      title: 'Parcels',
      features: [
        { route: { name: 'myParcels' }, label: 'My Parcels', icon: 'cube', tint: '#cf5500' },
      ],
    },
    {
      title: 'Helpdesk',
      features: [
        { route: { name: 'raiseTicket' }, label: 'Raise Ticket', icon: 'create', tint: '#cf222e' },
        { route: { name: 'myTickets' }, label: 'My Tickets', icon: 'list', tint: '#1f6feb' },
      ],
    },
    {
      title: 'Community',
      features: [
        { route: { name: 'announcements' }, label: 'Announcements', icon: 'megaphone', tint: '#8250df' },
      ],
    },
  ];
}

/** Guard feature groups (operations). */
function guardGroups(): FeatureGroup[] {
  return [
    {
      title: 'Gate',
      features: [
        { route: { name: 'verifyPass' }, label: 'Verify Pass', icon: 'qr-code', tint: '#1a7f37' },
        { route: { name: 'walkInCapture' }, label: 'Walk-in', icon: 'person-add', tint: '#bf8700' },
        { route: { name: 'entryExit' }, label: 'Entry / Exit', icon: 'swap-horizontal', tint: '#0969da' },
        { route: { name: 'watchlist' }, label: 'Watchlist', icon: 'alert-circle', tint: '#cf222e' },
      ],
    },
    {
      title: 'Parcels',
      features: [
        { route: { name: 'registerParcel' }, label: 'Register', icon: 'cube', tint: '#cf5500' },
        { route: { name: 'parcelCustody' }, label: 'Custody', icon: 'file-tray-stacked', tint: '#8250df' },
        { route: { name: 'parcelHandover' }, label: 'Handover', icon: 'hand-left', tint: '#1f6feb' },
      ],
    },
    {
      title: 'Maintenance',
      features: [
        { route: { name: 'workOrders' }, label: 'Work Orders', icon: 'construct', tint: '#bf8700' },
        { route: { name: 'assetLookup' }, label: 'Find Asset', icon: 'search', tint: '#0969da' },
      ],
    },
    {
      title: 'Security',
      features: [
        { route: { name: 'sos' }, label: 'SOS', icon: 'warning', tint: '#cf222e' },
        { route: { name: 'lookup' }, label: 'Lookup', icon: 'people', tint: '#1f6feb' },
      ],
    },
  ];
}

/** Admin management features (added when the signed-in roles look like an admin role). */
function adminGroup(): FeatureGroup {
  return {
    title: 'Management',
    features: [
      { route: { name: 'communities' }, label: 'Communities', icon: 'business', tint: '#8250df' },
      { route: { name: 'allUnits' }, label: 'Units', icon: 'grid', tint: '#0969da' },
      { route: { name: 'residents' }, label: 'Residents', icon: 'people', tint: '#1a7f37' },
      { route: { name: 'queue' }, label: 'Verification', icon: 'shield-checkmark', tint: '#bf8700' },
    ],
  };
}

/** A rich quick action for the dashboard. */
interface QuickAction {
  route: Route;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}

/** A friendly, time-of-day greeting. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Today's date, formatted for the hero subline. */
function todayLabel(): string {
  try {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

/** Home tab: a modern dashboard — a dark hero with stat chips, then rich quick-action cards. */
function DashboardTab({
  app,
  appTitle,
  userName,
  onNavigate,
  onOpenServices,
}: {
  app: 'resident' | 'guard';
  appTitle: string;
  userName: string;
  onNavigate: (r: Route) => void;
  onOpenServices: () => void;
}) {
  const quick: QuickAction[] = useMemo(
    () =>
      app === 'resident'
        ? [
            { route: { name: 'inviteVisitor' }, title: 'Invite a Visitor', subtitle: 'Share a QR pass with your guest', icon: 'person-add', tint: theme.color.success },
            { route: { name: 'raiseTicket' }, title: 'Raise a Ticket', subtitle: 'Report an issue for your unit', icon: 'create', tint: theme.color.danger },
            { route: { name: 'myParcels' }, title: 'My Parcels', subtitle: 'Track deliveries & handovers', icon: 'cube', tint: theme.color.warning },
            { route: { name: 'announcements' }, title: 'Announcements', subtitle: 'Community notices & updates', icon: 'megaphone', tint: '#8250df' },
          ]
        : [
            { route: { name: 'verifyPass' }, title: 'Verify a Pass', subtitle: 'Scan QR or enter OTP at the gate', icon: 'qr-code', tint: theme.color.success },
            { route: { name: 'registerParcel' }, title: 'Register a Parcel', subtitle: 'Log a delivery & notify resident', icon: 'cube', tint: theme.color.warning },
            { route: { name: 'walkInCapture' }, title: 'Register Walk-in', subtitle: 'Capture a visitor & request approval', icon: 'person-add', tint: theme.color.info },
            { route: { name: 'sos' }, title: 'SOS', subtitle: 'Raise or manage an emergency alert', icon: 'warning', tint: theme.color.danger },
          ],
    [app],
  );

  const stats =
    app === 'resident'
      ? [
          { icon: 'cube' as const, value: '—', label: 'Parcels' },
          { icon: 'people' as const, value: '—', label: 'Visitors' },
          { icon: 'construct' as const, value: '—', label: 'Tickets' },
        ]
      : [
          { icon: 'walk' as const, value: '—', label: 'On-site' },
          { icon: 'cube' as const, value: '—', label: 'Parcels' },
          { icon: 'alert-circle' as const, value: '—', label: 'Alerts' },
        ];

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroBlobA} />
        <View style={styles.heroBlobB} />
        <Text style={styles.heroHi}>{greeting()},</Text>
        <Text style={styles.heroName} numberOfLines={1}>{userName}</Text>
        <Text style={styles.heroDate}>{todayLabel()}</Text>
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <StatChip key={s.label} icon={s.icon} value={s.value} label={s.label} />
          ))}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.sectionRow}>
        <SectionHeading title="Quick actions" />
      </View>
      <View style={styles.actionList}>
        {quick.map((a) => (
          <QuickActionCard
            key={a.title}
            title={a.title}
            subtitle={a.subtitle}
            icon={a.icon}
            tint={a.tint}
            onPress={() => onNavigate(a.route)}
            accessibilityHint={`Open ${a.title}`}
          />
        ))}
      </View>

      {/* Explore all services */}
      <Pressable
        onPress={onOpenServices}
        accessibilityRole="button"
        accessibilityLabel="Explore all services"
        style={({ pressed }) => [styles.exploreCard, pressed ? styles.explorePressed : null]}
      >
        <View style={styles.exploreBadge}>
          <Ionicons name="apps" size={22} color={theme.color.primary} />
        </View>
        <View style={styles.exploreText}>
          <Text style={styles.exploreTitle}>Explore all services</Text>
          <Text style={styles.exploreSub}>Visitors, parcels, helpdesk & more</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={theme.color.primary} />
      </Pressable>
    </ScrollView>
  );
}

/** Services tab: every feature as a styled grid, grouped by area. */
function ServicesTab({
  app,
  isAdmin,
  onNavigate,
}: {
  app: 'resident' | 'guard';
  isAdmin: boolean;
  onNavigate: (r: Route) => void;
}) {
  const groups = useMemo(() => {
    const base = app === 'resident' ? residentGroups() : guardGroups();
    return isAdmin ? [...base, adminGroup()] : base;
  }, [app, isAdmin]);

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.servicesHeader}>
        <Text style={styles.servicesTitle}>Services</Text>
        <Text style={styles.servicesSub}>Everything you can do, in one place</Text>
      </View>
      {groups.map((group) => (
        <View key={group.title} style={styles.serviceGroup}>
          <View style={styles.groupHeaderRow}>
            <View style={styles.groupAccent} />
            <Text style={styles.groupTitle}>{group.title}</Text>
          </View>
          <View style={styles.grid}>
            {group.features.map((f) => (
              <FeatureTile
                key={f.label}
                label={f.label}
                icon={f.icon}
                tint={f.tint}
                onPress={() => onNavigate(f.route)}
                accessibilityHint={`Open ${f.label}`}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** Two-letter initials from a name/identifier for the avatar. */
function initialsOf(name: string): string {
  const cleaned = name.replace(/@.*$/, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** One row in the profile info/settings list. */
function ProfileRow({
  icon,
  label,
  value,
  tint,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  tint?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const accent = tint ?? theme.color.primary;
  const body = (
    <View style={[styles.pRow, last ? null : styles.pRowBorder]}>
      <View style={[styles.pRowIcon, { backgroundColor: `${accent}1f` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={styles.pRowText}>
        <Text style={styles.pRowLabel}>{label}</Text>
        {value ? <Text style={styles.pRowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.color.mutedText} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => (pressed ? styles.pRowPressed : null)}>
        {body}
      </Pressable>
    );
  }
  return body;
}

/** Profile tab: a modern profile page — hero header, account card, settings list, logout. */
function ProfileTab({
  userName,
  appTitle,
  societyName,
  roles,
  onManageProfile,
}: {
  userName: string;
  appTitle: string;
  societyName: string;
  roles: readonly string[];
  onManageProfile?: () => void;
}) {
  const roleLabel = roles.length > 0 ? roles.join(', ') : appTitle;
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Hero header */}
      <View style={styles.profileHero}>
        <View style={styles.heroBlobA} />
        <View style={styles.heroBlobB} />
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>{initialsOf(userName)}</Text>
        </View>
        <Text style={styles.profileHeroName} numberOfLines={1}>{userName}</Text>
        <View style={styles.roleChip}>
          <Ionicons name="shield-checkmark" size={13} color={theme.color.primaryText} />
          <Text style={styles.roleChipText} numberOfLines={1}>{roleLabel}</Text>
        </View>
      </View>

      {/* Account card */}
      <Text style={styles.pSection}>Account</Text>
      <View style={styles.pCard}>
        <ProfileRow icon="person-outline" label="Signed in as" value={userName} tint={theme.color.primary} />
        <ProfileRow icon="business-outline" label="Community" value={societyName} tint={theme.color.info} />
        <ProfileRow icon="ribbon-outline" label="Role" value={roleLabel} tint={theme.color.success} last />
      </View>

      {/* Manage (resident self-service) */}
      {onManageProfile ? (
        <>
          <Text style={styles.pSection}>Manage</Text>
          <View style={styles.pCard}>
            <ProfileRow icon="person-circle-outline" label="Profile & household" value="Contact details, family, vehicles" tint={theme.color.primary} onPress={onManageProfile} last />
          </View>
        </>
      ) : null}

      {/* Settings list */}
      <Text style={styles.pSection}>Settings</Text>
      <View style={styles.pCard}>
        <ProfileRow icon="notifications-outline" label="Notifications" value="Push & alerts" tint={theme.color.warning} onPress={() => {}} />
        <ProfileRow icon="lock-closed-outline" label="Security" value="Password & sessions" tint={theme.color.danger} onPress={() => {}} />
        <ProfileRow icon="help-circle-outline" label="Help & support" tint={theme.color.info} onPress={() => {}} last />
      </View>

      {/* Logout */}
      <View style={styles.pLogout}>
        <LogoutButton title="Log out" variant="secondary" />
      </View>
      <Text style={styles.pVersion}>CommunityOS · {appTitle} · v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: theme.color.background },
  body: { flex: 1 },
  tabContent: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  hero: {
    backgroundColor: theme.color.hero,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.xs,
    overflow: 'hidden',
    ...theme.shadow.hero,
  },
  // Decorative translucent "blobs" that fake a gradient without a native gradient dependency.
  heroBlobA: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: theme.color.heroAlt,
    opacity: 0.9,
  },
  heroBlobB: {
    position: 'absolute',
    bottom: -50,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.color.primary,
    opacity: 0.25,
  },
  heroHi: { fontSize: theme.fontSize.body, color: theme.color.primaryText, opacity: 0.85 },
  heroName: { fontSize: theme.fontSize.display, fontWeight: '800', color: theme.color.primaryText },
  heroDate: { fontSize: theme.fontSize.caption, color: theme.color.primaryText, opacity: 0.7, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  sectionRow: { marginTop: theme.spacing.sm },
  actionList: { gap: theme.spacing.md },
  exploreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  explorePressed: { opacity: 0.85 },
  exploreBadge: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreText: { flex: 1 },
  exploreTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  exploreSub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  group: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  servicesHeader: { marginBottom: theme.spacing.sm },
  servicesTitle: { fontSize: theme.fontSize.heading, fontWeight: '800', color: theme.color.text },
  servicesSub: { fontSize: theme.fontSize.label, color: theme.color.mutedText, marginTop: 2 },
  serviceGroup: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  groupAccent: { width: 4, height: 18, borderRadius: 2, backgroundColor: theme.color.primary },
  groupTitle: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  // --- Profile page ---
  profileHero: {
    backgroundColor: theme.color.hero,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.shadow.hero,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.onHeroSoft,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: { fontSize: theme.fontSize.display, fontWeight: '800', color: theme.color.primaryText },
  profileHeroName: { fontSize: theme.fontSize.heading, fontWeight: '800', color: theme.color.primaryText },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.color.onHeroSoft,
    borderRadius: theme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    maxWidth: '90%',
  },
  roleChipText: { color: theme.color.primaryText, fontSize: theme.fontSize.caption, fontWeight: '700' },
  pSection: {
    fontSize: theme.fontSize.caption,
    fontWeight: '800',
    color: theme.color.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: theme.spacing.md,
    marginLeft: theme.spacing.xs,
  },
  pCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadow.soft,
  },
  pRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  pRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  pRowPressed: { opacity: 0.6 },
  pRowIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pRowText: { flex: 1 },
  pRowLabel: { fontSize: theme.fontSize.label, fontWeight: '700', color: theme.color.text },
  pRowValue: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: 2 },
  pLogout: { marginTop: theme.spacing.lg },
  pVersion: { textAlign: 'center', color: theme.color.mutedText, fontSize: theme.fontSize.caption, marginTop: theme.spacing.md },
});
