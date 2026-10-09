import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import type { PagedData } from '../../models/envelope';
import type { Ticket } from '../../models/helpdesk';
import type { ResourceClients } from '../../resources';
import { ticketStatusTone, humanizeCode } from '../shared/status';
import { TicketDetailScreen } from './TicketDetailScreen';

export interface TicketListScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

type TicketView = { name: 'list' } | { name: 'detail'; ticket: Ticket };

/** A per-category icon so each ticket reads at a glance. */
function categoryIcon(code: string): keyof typeof Ionicons.glyphMap {
  switch (code) {
    case 'plumbing': return 'water';
    case 'electrical': return 'flash';
    case 'housekeeping': return 'sparkles';
    case 'security': return 'shield-checkmark';
    case 'common_area': return 'business';
    default: return 'construct';
  }
}

/**
 * Resident ticket list (Req 32.4, 34.1) — a modern, card-based surface mirroring the announcements
 * board. Shows the tickets the resident raised for their own unit, paginated and newest-first,
 * self-scoped server-side. Each ticket is a rich card (category icon tile + title + category ·
 * priority · date + status badge); tapping opens its detail (status, attachments, feedback) through
 * a small internal view switch so the app navigator keeps a single "My tickets" route.
 */
export function TicketListScreen({ resources, onBack }: TicketListScreenProps) {
  const [view, setView] = useState<TicketView>({ name: 'list' });
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync<PagedData<Ticket>>(
    (signal) =>
      resources.helpdesk.listTickets({ page, pageSize: DEFAULT_PAGE_SIZE, sort: '-createdAtUtc' }, {}, { signal }),
    [page],
  );

  if (view.name === 'detail') {
    return (
      <TicketDetailScreen
        resources={resources}
        ticketId={view.ticket.id}
        initialTicket={view.ticket}
        onBack={() => {
          setView({ name: 'list' });
          reload();
        }}
      />
    );
  }

  const items = data?.items ?? [];

  return (
    <FormScreen
      title="My tickets"
      subtitle={data?.totalCount ? `${data.totalCount} ${data.totalCount === 1 ? 'ticket' : 'tickets'}` : 'Your requests'}
      {...(onBack ? { onBack } : {})}
    >
      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="You haven't raised any tickets yet."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((t) => {
            const tone = ticketStatusTone(t.status);
            return (
              <Pressable
                key={t.id}
                style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
                onPress={() => setView({ name: 'detail', ticket: t })}
                accessibilityRole="button"
                accessibilityLabel={t.title}
                accessibilityHint="Open ticket details"
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconTile, { backgroundColor: `${toneColor(tone)}1f` }]}>
                    <Ionicons name={categoryIcon(t.category)} size={20} color={toneColor(tone)} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {humanizeCode(t.category)} · {humanizeCode(t.priority)} · {formatDate(t.createdAtUtc)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.color.mutedText} />
                </View>
                <View style={styles.cardFooter}>
                  <Badge label={humanizeCode(t.status)} tone={tone} />
                </View>
              </Pressable>
            );
          })}
        </View>
        {data ? (
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            onPageChange={setPage}
            disabled={loading}
          />
        ) : null}
      </AsyncBoundary>
    </FormScreen>
  );
}

/** Map a status tone to an accent color for the icon tile. */
function toneColor(tone: ReturnType<typeof ticketStatusTone>): string {
  switch (tone) {
    case 'positive': return theme.color.success;
    case 'warning': return theme.color.warning;
    case 'danger': return theme.color.danger;
    default: return theme.color.primary;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow.soft,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconTile: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: theme.fontSize.body, fontWeight: '800', color: theme.color.text },
  sub: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
});
