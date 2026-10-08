import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
import { Badge } from '../../ui/Badge';
import { Pager } from '../../ui/Pager';
import { useAsync } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { DEFAULT_PAGE_SIZE } from '../../models/query';
import type { PagedData } from '../../models/envelope';
import type { Announcement } from '../../models/announcement';
import type { ResourceClients } from '../../resources';
import { announcementCategoryTone, humanizeCode } from '../shared/status';

export interface AnnouncementsScreenProps {
  resources: ResourceClients;
  onBack?: () => void;
}

type AnnouncementsView = { name: 'list' } | { name: 'detail'; announcement: Announcement };

/**
 * Resident community notice board (MVP notices slice). Lists the announcements published for the
 * resident's community, newest-first and paginated. The list is tenant-scoped server-side (a
 * resident only sees their own community's board), so no scope is passed. Tapping a notice opens its
 * full body through a small internal view switch so the app navigator keeps a single "Announcements"
 * route (the hardware back pops the detail, then the screen). Read-only — the board is published by
 * the community, not the resident. Mirrors {@link TicketListScreen}.
 */
export function AnnouncementsScreen({ resources, onBack }: AnnouncementsScreenProps) {
  const [view, setView] = useState<AnnouncementsView>({ name: 'list' });
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsync<PagedData<Announcement>>(
    (signal) =>
      resources.announcements.list({ page, pageSize: DEFAULT_PAGE_SIZE, sort: 'publishedAtUtc:desc' }, {}, { signal }),
    [page],
  );

  if (view.name === 'detail') {
    const a = view.announcement;
    return (
      <FormScreen title="Announcement" onBack={() => setView({ name: 'list' })}>
        <View style={styles.detail}>
          <Badge label={humanizeCode(a.category)} tone={announcementCategoryTone(a.category)} />
          <Text style={styles.detailTitle}>{a.title}</Text>
          <Text style={styles.detailDate}>{formatDateTime(a.publishedAtUtc)}</Text>
          <Text style={styles.detailBody}>{a.body}</Text>
        </View>
      </FormScreen>
    );
  }

  const items = data?.items ?? [];

  return (
    <FormScreen title="Announcements" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && items.length === 0}
        emptyMessage="No announcements yet. Community notices will appear here."
        onRetry={reload}
      >
        <View style={styles.list}>
          {items.map((a) => (
            <ListRow
              key={a.id}
              title={a.title}
              subtitle={`${humanizeCode(a.category)} · ${formatDate(a.publishedAtUtc)}`}
              trailing={<Badge label={humanizeCode(a.category)} tone={announcementCategoryTone(a.category)} />}
              onPress={() => setView({ name: 'detail', announcement: a })}
              accessibilityHint={`Open announcement ${a.title}`}
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  detail: { gap: theme.spacing.sm },
  detailTitle: { fontSize: theme.fontSize.heading, fontWeight: '800', color: theme.color.text },
  detailDate: { fontSize: theme.fontSize.caption, color: theme.color.mutedText },
  detailBody: { fontSize: theme.fontSize.body, color: theme.color.text, lineHeight: 22, marginTop: theme.spacing.xs },
});
