import type { ApiClient } from '../api/client';
import type { PagedData } from '../models/envelope';
import type { ListQuery } from '../models/query';
import type { Announcement } from '../models/announcement';
import { buildQuery, listQueryParams } from './query';

/** Extra server-side filter for the announcement list (MVP notices slice). */
export interface AnnouncementListFilters {
  readonly category?: string;
}

/**
 * Typed client for the MVP notices-slice HTTP surface — the community notice board. Thin,
 * envelope-aware wrapper over {@link ApiClient}: screens call `announcements.list(...)` instead of
 * hand-rolling fetch + query strings (steering: reuse the shared client). The list is tenant-scoped
 * server-side by the EF global query filter, so a resident only ever sees their own community's
 * board without asking for a scope. Read-only in the MVP (no publish method). Mirrors
 * {@link HelpdeskClient}.
 */
export class AnnouncementsClient {
  constructor(private readonly api: ApiClient) {}

  list(
    query: ListQuery = {},
    filters: AnnouncementListFilters = {},
    options?: { signal?: AbortSignal },
  ): Promise<PagedData<Announcement>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      category: filters.category,
    });
    return this.api.get<PagedData<Announcement>>(`/api/v1/announcements${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Announcement> {
    return this.api.get<Announcement>(`/api/v1/announcements/${id}`, options);
  }
}
