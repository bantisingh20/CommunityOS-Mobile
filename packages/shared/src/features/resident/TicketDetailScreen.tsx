import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormScreen } from '../../ui/FormScreen';
import { SectionHeading } from '../../ui/SectionHeading';
import { AppTextField } from '../../ui/AppTextField';
import { AppButton } from '../../ui/AppButton';
import { AsyncBoundary } from '../../ui/AsyncBoundary';
import { ListRow } from '../../ui/ListRow';
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

/** The rating choices offered. The server validates against the community's configured bounds. */
const RATING_CHOICES = [1, 2, 3, 4, 5] as const;

/**
 * Resident ticket detail (Req 34.1, 34.4). Shows the current status, priority, SLA target and
 * assignment of one of the resident's own tickets plus its File_Service attachment references, and —
 * once the ticket is resolved/closed — lets the resident submit a feedback rating + optional comment
 * (Req 34.4). The ticket re-fetches so the status is current even if it moved since the list loaded.
 * Feedback is only offered while the ticket is in a feedback-eligible status; once given, the
 * submitted rating/comment is shown read-only (the server rejects a second submission). Reuses the
 * shared accessible primitives rather than hand-rolling controls.
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
    if (rating === null) {
      return Promise.reject(new Error('Select a rating'));
    }
    return resources.helpdesk
      .submitFeedback(ticketId, { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) })
      .then((t) => {
        reload();
        return t;
      });
  });

  const attachments = attachmentsState.data ?? [];

  return (
    <FormScreen title="Ticket details" {...(ticket ? { subtitle: ticket.title } : {})} {...(onBack ? { onBack } : {})}>
      <AsyncBoundary
        loading={loading && !ticket}
        error={ticket ? null : error}
        empty={!loading && !ticket}
        emptyMessage="This ticket could not be loaded."
        onRetry={reload}
      >
        {ticket ? (
          <>
            <ListRow
              title={humanizeCode(ticket.category)}
              subtitle={`${humanizeCode(ticket.priority)}${ticket.subcategory ? ` · ${humanizeCode(ticket.subcategory)}` : ''}`}
              trailing={<Badge label={humanizeCode(ticket.status)} tone={ticketStatusTone(ticket.status)} />}
            />
            <ListRow title="Description" subtitle={ticket.description} />
            <ListRow title="Raised" subtitle={formatDateTime(ticket.createdAtUtc)} />
            {ticket.assignedAtUtc ? (
              <ListRow title="Assigned" subtitle={formatDateTime(ticket.assignedAtUtc)} />
            ) : null}
            {ticket.slaDueAtUtc ? (
              <ListRow title="Target resolution" subtitle={formatDateTime(ticket.slaDueAtUtc)} />
            ) : null}

            <SectionHeading title="Attachments" />
            <AsyncBoundary
              loading={attachmentsState.loading}
              error={attachmentsState.error}
              empty={!attachmentsState.loading && attachments.length === 0}
              emptyMessage="No attachments on this ticket."
              onRetry={attachmentsState.reload}
            >
              <View style={styles.list}>
                {attachments.map((a) => (
                  <ListRow key={a.id} title={a.fileId} subtitle="File reference" />
                ))}
              </View>
            </AsyncBoundary>

            <SectionHeading title="Feedback" />
            {ticket.feedbackAtUtc && ticket.rating !== null ? (
              <>
                <ListRow
                  title={`Your rating: ${ticket.rating}`}
                  subtitle={ticket.feedbackComment ?? 'No comment'}
                  trailing={<Badge label="Submitted" tone="positive" />}
                />
              </>
            ) : isFeedbackEligible(ticket.status) ? (
              <>
                <View style={styles.ratingRow} accessibilityRole="radiogroup" accessibilityLabel="Satisfaction rating">
                  {RATING_CHOICES.map((n) => (
                    <View key={n} style={styles.flex}>
                      <AppButton
                        title={String(n)}
                        variant={rating === n ? 'primary' : 'secondary'}
                        onPress={() => setRating(n)}
                        accessibilityLabel={`Rate ${n} out of ${RATING_CHOICES.length}`}
                        accessibilityHint={`Give this ticket a rating of ${n}`}
                      />
                    </View>
                  ))}
                </View>
                <AppTextField
                  label="Comment (optional)"
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Tell us how it went"
                  autoCapitalize="sentences"
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
              <FormBanner message="You can leave feedback once this ticket is resolved." tone="success" />
            )}
          </>
        ) : null}
      </AsyncBoundary>
    </FormScreen>
  );
}

/** Feedback is accepted only while the ticket is resolved or closed (server-enforced, Req 34.4). */
function isFeedbackEligible(status: string): boolean {
  return status === TicketStatus.Resolved || status === TicketStatus.Closed;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
  ratingRow: { flexDirection: 'row', gap: theme.spacing.xs },
  flex: { flex: 1 },
});
