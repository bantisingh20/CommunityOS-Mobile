import type { ApiClient } from '../api/client';
import { CommunitiesClient } from './communitiesClient';
import { UnitsClient } from './unitsClient';
import { HierarchyClient } from './hierarchyClient';
import { ResidentsClient } from './residentsClient';
import { MasterDataClient } from './masterDataClient';
import { GateClient } from './gateClient';
import { SecurityOpsClient } from './securityOpsClient';
import { ParcelClient } from './parcelClient';
import { HelpdeskClient } from './helpdeskClient';
import { MaintenanceClient } from './maintenanceClient';
import { AnnouncementsClient } from './announcementsClient';
import { FileClient } from './fileClient';

export * from './query';
export * from './fileClient';
export * from './idempotency';
export * from './communitiesClient';
export * from './unitsClient';
export * from './hierarchyClient';
export * from './residentsClient';
export * from './masterDataClient';
export * from './gateClient';
export * from './securityOpsClient';
export * from './parcelClient';
export * from './helpdeskClient';
export * from './maintenanceClient';
export * from './announcementsClient';
export * from './offlineQueue';

/**
 * The Phase 2 resource clients, bundled. One place to construct them from a single
 * {@link ApiClient} so screens receive a typed `resources` object (dependency injection) instead of
 * reaching for a global. Both apps build this once in their composition root alongside the core.
 */
export interface ResourceClients {
  readonly communities: CommunitiesClient;
  readonly units: UnitsClient;
  /** Configurable property hierarchy (wings / buildings / floors) per community. */
  readonly hierarchy: HierarchyClient;
  readonly residents: ResidentsClient;
  readonly masterData: MasterDataClient;
  /** Phase 3 Gate_Service: visit passes, walk-ins, entry/exit, recurring visitors. */
  readonly gate: GateClient;
  /** Phase 3 gate security-operations: watchlist + SOS. */
  readonly securityOps: SecurityOpsClient;
  /** Phase 4 Parcel_Service: registration, custody, authorized handover, timeline. */
  readonly parcels: ParcelClient;
  /** Phase 5 Helpdesk_Service: ticket raise/track/assign/status/feedback. */
  readonly helpdesk: HelpdeskClient;
  /** Phase 5 Maintenance_Service: assets + work orders with parts/labour. */
  readonly maintenance: MaintenanceClient;
  /** MVP notices slice: the community notice board (read-only). */
  readonly announcements: AnnouncementsClient;
  /** File_Service multipart upload (photos etc.) → opaque stored-file reference. */
  readonly files: FileClient;
}

/** Construct the bundle of resource clients over an {@link ApiClient}. */
export function createResourceClients(api: ApiClient): ResourceClients {
  return {
    communities: new CommunitiesClient(api),
    units: new UnitsClient(api),
    hierarchy: new HierarchyClient(api),
    residents: new ResidentsClient(api),
    masterData: new MasterDataClient(api),
    gate: new GateClient(api),
    securityOps: new SecurityOpsClient(api),
    parcels: new ParcelClient(api),
    helpdesk: new HelpdeskClient(api),
    maintenance: new MaintenanceClient(api),
    announcements: new AnnouncementsClient(api),
    files: new FileClient(api),
  };
}
