import type { ApiClient } from '@/services/api/client';
import type { PagedData } from '@/types/envelope';
import type { ListQuery } from '@/types/query';
import type { MaintenanceBill, MaintenancePayment } from '@/types/myTasks';
import { buildQuery, listQueryParams } from './query';

export interface SubmitPaymentBody {
  readonly maintenanceBillId: string;
  readonly amount: number;
  readonly method: string;
  readonly reference?: string;
}

export interface MyBillsFilters {
  readonly status?: string;
}

export interface MaintenanceDefaulter {
  readonly unitId: string;
  readonly unitNumber: string;
  readonly residentName: string;
  readonly unpaidCount: number;
}

export class MaintenanceBillsClient {
  constructor(private readonly api: ApiClient) {}

  myDue(options?: { signal?: AbortSignal }): Promise<MaintenanceBill[]> {
    return this.api.get<MaintenanceBill[]>(
      '/api/v1/maintenance-bills/me/due',
      options?.signal ? { signal: options.signal } : undefined,
    );
  }

  myBills(
    query: ListQuery = {},
    filters: MyBillsFilters = {},
    options?: { signal?: AbortSignal },
  ): Promise<PagedData<MaintenanceBill>> {
    const qs = buildQuery({ ...listQueryParams(query), status: filters.status });
    return this.api.get<PagedData<MaintenanceBill>>(`/api/v1/maintenance-bills/me${qs}`, options);
  }

  defaulters(options?: { signal?: AbortSignal }): Promise<MaintenanceDefaulter[]> {
    return this.api.get<MaintenanceDefaulter[]>(
      '/api/v1/maintenance-bills/defaulters',
      options?.signal ? { signal: options.signal } : undefined,
    );
  }

  submitPayment(body: SubmitPaymentBody): Promise<MaintenancePayment> {
    return this.api.post<MaintenancePayment>('/api/v1/maintenance-payments/submit', { body });
  }
}
