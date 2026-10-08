# Task: Phase 5 mobile — resident helpdesk + staff work-order screens (Task 22.1)
- Date: 2026-01-01
- Author: Kiro
- Project: mobile (CommunityOS-Mobile Expo monorepo)
- Status: done

## Objective
Build the Phase 5 mobile screens on top of the existing Helpdesk + Maintenance backend
(tasks 20-21). Resident raises/tracks a complaint ticket and submits feedback; maintenance
staff work their assigned work orders (parts/labour/status/assign) and look up an asset by
its QR token. Requirements: 32.1, 34.4, 36.4, 65.6.

## Requirements
- Resident: raise a ticket (category/subcategory/priority from master data + optional
  File_Service attachment references), track own tickets (list + detail with status/SLA),
  submit feedback/rating on a resolved ticket.
- Staff: assigned work orders (list + detail), record parts + labour, change work-order
  status through the configurable transition, assign/re-assign, asset QR-token lookup
  (text field + lookup, NO camera dependency — mirrors the gate/parcel QR flow).
- Accessible components only (Req 65.6): reuse the shared accessible UI primitives.
- Preserve existing behavior: self-scoped resident lists, envelope/Bearer/idempotency via
  the shared ApiClient, master-data-driven dropdowns (no hardcoded option lists).

## Host app for staff screens
There is no separate "staff" app — the two apps are Resident and Guard/Security. Maintenance
staff screens are hosted in the GUARD app (the non-resident operational app), surfaced through
the shared `HomeNavigator` under a new "Maintenance" group, exactly like the Phase 3 guard
operational screens. The server still enforces real authorization (View/Edit/Assign on
WorkOrder/Asset), so a guard without those permissions simply gets FORBIDDEN.

## Affected Files / Components
- packages/shared/src/models/helpdesk.ts — NEW: Ticket/attachment read models + list keys + status codes
- packages/shared/src/models/maintenance.ts — NEW: Asset/WorkOrder/part/labour read models + list keys + status codes
- packages/shared/src/models/index.ts — export the two new model modules
- packages/shared/src/resources/helpdeskClient.ts — NEW: typed Helpdesk client
- packages/shared/src/resources/maintenanceClient.ts — NEW: typed Maintenance client
- packages/shared/src/resources/index.ts — add helpdesk+maintenance to ResourceClients + factory
- packages/shared/src/features/shared/status.ts — add ticketStatusTone + workOrderStatusTone
- packages/shared/src/features/resident/RaiseTicketScreen.tsx — NEW
- packages/shared/src/features/resident/TicketListScreen.tsx — NEW (list + routes to detail)
- packages/shared/src/features/resident/TicketDetailScreen.tsx — NEW (status, attachments, feedback)
- packages/shared/src/features/resident/index.ts — export new resident screens
- packages/shared/src/features/guard/WorkOrderListScreen.tsx — NEW (staff; list + routes to detail)
- packages/shared/src/features/guard/WorkOrderDetailScreen.tsx — NEW (parts/labour/status/assign)
- packages/shared/src/features/guard/AssetLookupScreen.tsx — NEW (QR-token/serial lookup)
- packages/shared/src/features/guard/index.ts — export new guard screens
- packages/shared/src/features/HomeNavigator.tsx — add Helpdesk (resident) + Maintenance (guard) routes/menu

## Implementation Steps
- [x] Read models + list keys + well-known status codes (mirror backend DTOs 1:1)
- [x] Helpdesk + Maintenance resource clients (mirror parcelClient/gateClient)
- [x] ticketStatusTone + workOrderStatusTone
- [x] Resident raise/list/detail(+feedback) screens
- [x] Staff work-order list/detail(+parts/labour/status/assign) + asset lookup screens
- [x] Wire routes + menu groups into HomeNavigator; export from indexes
- [x] npm run typecheck:all clean (exit 0 across shared + guard + resident)

## Edge Cases & Risks
- Attachments: resident passes File_Service reference ids (attachmentFileIds). No upload/camera
  dependency added — same approach the Phase 4 parcel evidence screens use (reference id field).
- Asset QR lookup: the backend asset list is searchable by name/serial/location, NOT by qrToken.
  So the "scan" field drives `search` (serial) and we also exact-match the returned `qrToken`
  client-side. ponytail: naive client-side token match over one search page; a server-side
  qrToken filter would be the upgrade path.
- Feedback only valid while the ticket is resolved/closed (server enforces); the detail screen
  only offers feedback in those states and shows the given rating otherwise.
- Assign uses a plain staff user-id field (no user-search client exists); server validates the
  assignee is a valid staff user.

## Verification
- `npm run typecheck:all` in CommunityOS-Mobile must exit 0.
- No tests authored (per task directive — implementation only).

## Notes / Decisions
- Reused: @communityos/shared ApiClient, ResourceClients bundle, MasterDataDropdown, UnitPicker,
  useMyResident, Screen/AppButton/AppTextField/Select/Badge/ListRow/Pager/FormBanner/AsyncBoundary,
  useAsync/useAsyncAction, humanizeCode, the state-based HomeNavigator pattern.
