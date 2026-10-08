/**
 * Phase 2 feature screens (Task 14.1). Shared across both apps: the admin management screens, the
 * resident self-view, and the guard read-only lookup. Each screen receives its {@link ResourceClients}
 * and simple navigation callbacks from the app, reuses the shared accessible UI primitives, and
 * resolves its option lists from master-data (no hardcoding).
 */
export * from './shared';
export * from './admin';
export * from './resident';
export * from './guard';
export * from './HomeNavigator';
