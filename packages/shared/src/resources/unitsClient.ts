import type { ApiClient } from '../api/client';
import type { PagedData } from '../models/envelope';
import type { ListQuery } from '../models/query';
import type { Unit, UnitHistory, UnitHouseholdMember } from '../models/community';
import type { Vehicle, Pet } from '../models/resident';
import { buildQuery, listQueryParams } from './query';

/** Extra server-side filters for the unit list (Req 14.5), on top of the shared {@link ListQuery}. */
export interface UnitListFilters {
  readonly unitStatus?: string;
  readonly unitType?: string;
  readonly floor?: string;
  readonly hierarchyNodeId?: string;
}

/** Register a vehicle against a unit (Req 19.1, 19.2). */
export interface RegisterVehicleBody {
  readonly unitId: string;
  readonly registrationNumber: string;
  readonly vehicleType: string;
}

/** Body to create a unit (flat) in a community, optionally under a hierarchy node/wing (Req 14.1). */
export interface CreateUnitBody {
  readonly communityId: string;
  /** The wing/building/floor this unit sits under (optional). */
  readonly hierarchyNodeId?: string;
  readonly unitNumber: string;
  /** Configurable unit-type code (`Unit_Type` list). */
  readonly unitType: string;
  readonly area?: number;
  readonly floor?: string;
  readonly bedrooms?: number;
  /** Configurable unit-status code (`Unit_Status` list). */
  readonly unitStatus: string;
  readonly customAttributes?: Record<string, string>;
}

/**
 * Typed client for `/api/v1/units` and its per-unit asset/history reads (Req 14.x, 16.4, 19.5).
 * Thin, envelope-aware wrapper over {@link ApiClient}. The list is tenant-scoped server-side; the
 * per-unit vehicle/pet reads are additionally resident self-scoped, so a resident principal only
 * sees their own unit's assets (Req 66.3).
 */
export class UnitsClient {
  constructor(private readonly api: ApiClient) {}

  list(
    query: ListQuery = {},
    filters: UnitListFilters = {},
    options?: { signal?: AbortSignal },
  ): Promise<PagedData<Unit>> {
    const qs = buildQuery({
      ...listQueryParams(query),
      unitStatus: filters.unitStatus,
      unitType: filters.unitType,
      floor: filters.floor,
      hierarchyNodeId: filters.hierarchyNodeId,
    });
    return this.api.get<PagedData<Unit>>(`/api/v1/units${qs}`, options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Unit> {
    return this.api.get<Unit>(`/api/v1/units/${id}`, options);
  }

  /** Create a unit (flat). Requires Create on Unit; a duplicate number in the community → conflict (Req 14.1). */
  create(body: CreateUnitBody): Promise<Unit> {
    return this.api.post<Unit>('/api/v1/units', { body });
  }

  /** A unit's registered vehicles (Req 19.1, 19.5). */
  listVehicles(unitId: string, options?: { signal?: AbortSignal }): Promise<Vehicle[]> {
    return this.api.get<Vehicle[]>(`/api/v1/units/${unitId}/vehicles`, options);
  }

  /** Register a vehicle against a unit (Req 19.1, 19.2). Registration number is unique per community. */
  registerVehicle(body: RegisterVehicleBody): Promise<Vehicle> {
    return this.api.post<Vehicle>(`/api/v1/vehicles`, { body });
  }

  /** A unit's registered pets (Req 19.3, 19.5). */
  listPets(unitId: string, options?: { signal?: AbortSignal }): Promise<Pet[]> {
    return this.api.get<Pet[]>(`/api/v1/units/${unitId}/pets`, options);
  }

  /** A unit's combined ownership + tenancy history (Req 16.4). */
  history(unitId: string, options?: { signal?: AbortSignal }): Promise<UnitHistory> {
    return this.api.get<UnitHistory>(`/api/v1/units/${unitId}/history`, options);
  }

  /** A unit's active household members (name + type) — used for the owner-first add rule (Req 15.2). */
  listHousehold(unitId: string, options?: { signal?: AbortSignal }): Promise<UnitHouseholdMember[]> {
    return this.api.get<UnitHouseholdMember[]>(`/api/v1/units/${unitId}/household`, options);
  }
}
