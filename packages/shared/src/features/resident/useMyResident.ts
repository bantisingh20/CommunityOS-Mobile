import { useAsync } from '../../ui/hooks';
import type { AsyncState } from '../../ui/hooks';
import type { PagedData } from '../../models/envelope';
import type { Resident } from '../../models/resident';
import type { Unit } from '../../models/community';
import type { ResourceClients } from '../../resources';

/** The signed-in resident plus their unit(s), resolved from the self-scoped lists. */
export interface MyResident {
  readonly resident: Resident | null;
  readonly units: Unit[];
}

/**
 * Resolve the signed-in resident and their unit(s) from the self-scoped lists (the same pattern the
 * Phase 2 resident self-view uses — a resident principal's `residents.list()` / `units.list()`
 * return only their own rows, so there's no `/me` endpoint to call). The gate resident screens
 * (pre-invite, approvals, recurring) all need the resident id and a host unit, so this keeps that
 * derivation in one place instead of three copies (steering: reuse, don't hand-roll).
 */
export function useMyResident(resources: ResourceClients): AsyncState<MyResident> {
  return useAsync<MyResident>(
    async (signal) => {
      const [residents, units] = await Promise.all([
        resources.residents.list({ pageSize: 1 }, {}, { signal }),
        resources.units.list({ pageSize: 25 }, {}, { signal }),
      ]);
      return {
        resident: pickFirst(residents),
        units: units.items,
      };
    },
    [],
  );
}

function pickFirst(page: PagedData<Resident>): Resident | null {
  return page.items.length > 0 ? (page.items[0] ?? null) : null;
}
