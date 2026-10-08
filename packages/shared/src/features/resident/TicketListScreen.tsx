import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
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

/**
 * Resident ticket list (Req 32.4, 34.1). Shows the tickets the resident raised for their own unit,
 * paginated and newest-first. The list is self-scoped server-side (a resident principal's `tickets`
 * list returns only their own unit's rows — the same self-scope the Phase 2/3/4 resident screens
 * rely on), so no unit filter is passed. Tapping a ticket opens its detail (status, attachments,
 * feedback) through a small internal view switch so the app navigator keeps a single "My tickets"
 * route. Mirrors {@link ParcelListScreen}.
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
    <FormScreen title="My tickets" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="You haven't raised any tickets yet."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((t) => (
            <ListRow
              key={t.id}
              title={t.title}
              subtitle={`${humanizeCode(t.category)} · ${humanizeCode(t.priority)} · raised ${formatDate(t.createdAtUtc)}`}
              trailing={<Badge label={humanizeCode(t.status)} tone={ticketStatusTone(t.status)} />}
              onPress={() => setView({ name: 'detail', ticket: t })}
              accessibilityHint={`Open ticket ${t.title}`}
            />
          ))}
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
});
