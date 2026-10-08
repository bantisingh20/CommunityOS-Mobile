import type { ApiClient } from '../api/client';
import type { HierarchyNode } from '../models/community';

/** Body to create a hierarchy node (wing / building / block / floor) in a community (Req 13.1). */
export interface CreateHierarchyNodeBody {
  readonly communityId: string;
  /** Optional parent node; omit for a top-level node (e.g. a wing directly under the community). */
  readonly parentId?: string;
  /** Configurable level code (`Hierarchy_Level` list): phase / building_tower / block / zone / floor. */
  readonly level: string;
  readonly name: string;
}

/**
 * Typed client for the configurable property hierarchy (Req 13.x). The hierarchy is a small
 * parent/child tree per community, so the read returns the whole tenant-scoped tree in one call
 * (`GET /api/v1/communities/{id}/hierarchy`) rather than a paginated list. Thin, envelope-aware
 * wrapper over {@link ApiClient}. Mirrors {@link CommunitiesClient}.
 */
export class HierarchyClient {
  constructor(private readonly api: ApiClient) {}

  /** The community's full hierarchy tree (wings/buildings/floors), tenant-scoped (Req 13.4). */
  listForCommunity(communityId: string, options?: { signal?: AbortSignal }): Promise<HierarchyNode[]> {
    return this.api.get<HierarchyNode[]>(`/api/v1/communities/${communityId}/hierarchy`, options);
  }

  /** Create a hierarchy node (wing/building/floor). Requires Create on HierarchyNode (Req 13.1). */
  create(body: CreateHierarchyNodeBody): Promise<HierarchyNode> {
    return this.api.post<HierarchyNode>('/api/v1/hierarchy-nodes', { body });
  }
}
