import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormScreen } from '../../ui/FormScreen';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { Badge } from '../../ui/Badge';
import { FormBanner } from '../../ui/FormBanner';
import { useAsync, useAsyncAction } from '../../ui/hooks';
import { theme } from '../../ui/theme';
import { TicketStatus } from '../../models/helpdesk';
import type { Ticket, TicketAttachment } from '../../models/helpdesk';
import type { ResourceClients } from '../../resources';
import { ticketStatusTone, humanizeCode } from '../shared/status';

export interface TicketDetailScreenProps {
  resources: ResourceClients;
  ticketId: string;
  /** The row the resident tapped, shown immediately while the fresh copy loads. */
  initialTicket?: Ticket;
  onBack?: () => void;
}

const RATING_CHOICES = [1, 2, 3, 4, 5] as const;

/**
 * Resident ticket detail (Req 34.1, 34.4) — a modern, hierarchical layout: a status hero card
 * (title + category/priority chips + status badge), the description, a timeline (raised → assigned →
 * target), attachment thumbnails (rendered via the authorized File_Service download), and a feedback
 * section (star rating + optional comment) once the ticket is resolved/closed. The ticket re-fetches
 * so the status is current even if it moved since the list loaded.
 */
export function TicketDetailScreen({ resources, ticketId, initialTicket, onBack }: TicketDetailScreenProps) {
  const { data, loading, error, reload } = useAsync<Ticket>(
    (signal) => resources.helpdesk.getTicket(ticketId, { signal }),
    [ticketId],
  );
  const attachmentsState = useAsync<TicketAttachment[]>(
    (signal) => resources.helpdesk.getAttachments(ticketId, { signal }),
    [ticketId],
  );

  const ticket = data ?? initialTicket ?? null;
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const submit = useAsyncAction(() => {
    if (rating === null) return Promise.reject(new Error('Select a rating'));
    return resources.helpdesk
      .submitFeedback(ticketId, { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) })
      .then((t) => { reload(); return t; });
  });

  const attachments = attachmentsState.data ?? [];
  const tone = ticket ? ticketStatusTone(ticket.status) : 'neutral';

  return (
    <FormScreen title="Ticket" {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={loading && !ticket}
        error={ticket ? null : error}
        empty={!loading && !ticket}
        emptyMessage="This ticket could not be loaded."
        onRetry={reload}
      >
        {ticket ? (
          <>
            {/* Status hero */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={[styles.heroIcon, { backgroundColor: `${toneColor(tone)}1f` }]}>
                  <Ionicons name="construct" size={22} color={toneColor(tone)} />
                </View>
                <Badge label={humanizeCode(ticket.status)} tone={tone} />
              </View>
              <Text style={styles.heroTitle}>{ticket.title}</Text>
              <View style={styles.chipRow}>
                <MetaChip icon="pricetag-outline" label={humanizeCode(ticket.category)} />
                {ticket.subcategory ? <MetaChip icon="pricetags-outline" label={humanizeCode(ticket.subcategory)} /> : null}
                <MetaChip icon="flag-outline" label={humanizeCode(ticket.priority)} />
              </View>
            </View>

            {/* Description */}
            <Section title="Description" icon="document-text-outline">
              <Text style={styles.body}>{ticket.description}</Text>
            </Section>

            {/* Timeline */}
            <Section title="Timeline" icon="time-outline">
              <TimelineRow icon="create-outline" label="Raised" value={formatDateTime(ticket.createdAtUtc)} done />
              <TimelineRow icon="person-outline" label="Assigned" value={ticket.assignedAtUtc ? formatDateTime(ticket.assignedAtUtc) : 'Not yet assigned'} done={Boolean(ticket.assignedAtUtc)} />
              {ticket.slaDueAtUtc ? (
                <TimelineRow icon="alarm-outline" label="Target resolution" value={formatDateTime(ticket.slaDueAtUtc)} done={ticket.status === TicketStatus.Resolved || ticket.status === TicketStatus.Closed} last />
              ) : null}
            </Section>

            {/* Attachments */}
            <Section title="Attachments" icon="images-outline">
              <AsyncBoundary
                loading={attachmentsState.loading}
                error={attachmentsState.error}
                empty={!attachmentsState.loading && attachments.length === 0}
                emptyMessage="No photos attached to this ticket."
                onRetry={attachmentsState.reload}
              >
                <View style={styles.thumbRow}>
                  {attachments.map((a) => {
                    const src = resources.files.downloadSource(a.fileId);
                    return src ? (
                      <Image key={a.id} source={src} style={styles.thumb} accessibilityLabel="Ticket attachment" />
                    ) : (
                      <View key={a.id} style={[styles.thumb, styles.thumbEmpty]}>
                        <Ionicons name="document-outline" size={22} color={theme.color.mutedText} />
                      </View>
                    );
                  })}
                </View>
              </AsyncBoundary>
            </Section>

            {/* Feedback */}
            <Section title="Feedback" icon="star-outline">
              {ticket.feedbackAtUtc && ticket.rating !== null ? (
                <View style={styles.feedbackGiven}>
                  <View style={styles.starsRow}>
                    {RATING_CHOICES.map((n) => (
                      <Ionicons key={n} name={n <= ticket.rating! ? 'star' : 'star-outline'} size={22} color={theme.color.warning} />
                    ))}
                  </View>
                  <Text style={styles.body}>{ticket.feedbackComment ?? 'No comment'}</Text>
                  <Badge label="Submitted" tone="positive" />
                </View>
              ) : isFeedbackEligible(ticket.status) ? (
                <>
                  <Text style={styles.feedbackPrompt}>How did we do? Tap a star to rate.</Text>
                  <View style={styles.starsRow} accessibilityRole="radiogroup" accessibilityLabel="Satisfaction rating">
                    {RATING_CHOICES.map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setRating(n)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: rating === n }}
                        accessibilityLabel={`Rate ${n} out of 5`}
                        hitSlop={6}
                      >
                        <Ionicons name={rating !== null && n <= rating ? 'star' : 'star-outline'} size={32} color={theme.color.warning} />
                      </Pressable>
                    ))}
                  </View>
                  <AppTextField
                    label="Comment (optional)"
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Tell us how it went"
                    autoCapitalize="sentences"
                    multiline
                    numberOfLines={3}
                    {...(submit.error?.fieldErrors.comment ? { error: submit.error.fieldErrors.comment } : {})}
                  />
                  {submit.error && !submit.error.fieldErrors.comment ? (
                    <FormBanner message={submit.error.message} tone="error" />
                  ) : null}
                  <AppButton
                    title="Submit feedback"
                    loading={submit.running}
                    disabled={rating === null}
                    onPress={() => submit.run()}
                    accessibilityHint="Submit your feedback rating for this ticket"
                  />
                </>
              ) : (
                <Text style={styles.body}>You can leave feedback once this ticket is resolved.</Text>
              )}
            </Section>
          </>
        ) : null}
      </AsyncBoundary>
    </FormScreen>
  );
}

/** A titled section card. */
function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={theme.color.mutedText} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** A small icon + label chip on the hero. */
function MetaChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={13} color={theme.color.mutedText} />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

/** A step in the timeline: a colored dot + label + value. */
function TimelineRow({ icon, label, value, done, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; done: boolean; last?: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: done ? theme.color.success : theme.color.disabled }]}>
          <Ionicons name={icon} size={12} color={theme.color.primaryText} />
        </View>
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineText}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineValue}>{value}</Text>
      </View>
    </View>
  );
}

function isFeedbackEligible(status: string): boolean {
  return status === TicketStatus.Resolved || status === TicketStatus.Closed;
}

function toneColor(tone: ReturnType<typeof ticketStatusTone>): string {
  switch (tone) {
    case 'positive': return theme.color.success;
    case 'warning': return theme.color.warning;
    case 'danger': return theme.color.danger;
    default: return theme.color.primary;
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const styles = StyleSheet.create({
  // Status hero.
  hero: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow.soft,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 44, height: 44, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: theme.fontSize.title, fontWeight: '800', color: theme.color.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.color.background, borderRadius: theme.radius.pill, paddingVertical: 5, paddingHorizontal: theme.spacing.md },
  metaChipText: { fontSize: theme.fontSize.caption, color: theme.color.text, fontWeight: '600' },

  // Section cards.
  section: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    ...theme.shadow.soft,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  sectionTitle: { fontSize: theme.fontSize.caption, fontWeight: '800', color: theme.color.mutedText, letterSpacing: 0.5, textTransform: 'uppercase' },
  body: { fontSize: theme.fontSize.body, color: theme.color.text, lineHeight: 22 },

  // Timeline.
  timelineRow: { flexDirection: 'row', gap: theme.spacing.md },
  timelineRail: { alignItems: 'center', width: 24 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.color.border, marginVertical: 2 },
  timelineText: { flex: 1, paddingBottom: theme.spacing.sm },
  timelineLabel: { fontSize: theme.fontSize.label, fontWeight: '700', color: theme.color.text },
  timelineValue: { fontSize: theme.fontSize.caption, color: theme.color.mutedText, marginTop: 1 },

  // Attachments.
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  thumb: { width: 84, height: 84, borderRadius: theme.radius.md, backgroundColor: theme.color.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.color.border },

  // Feedback.
  feedbackPrompt: { fontSize: theme.fontSize.label, color: theme.color.mutedText },
  starsRow: { flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' },
  feedbackGiven: { gap: theme.spacing.sm },
});
