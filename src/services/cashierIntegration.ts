import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type CashierIntegrationQueueItem = {
  id: number;
  source_module: string;
  source_entity: string;
  source_key: string;
  patient_name: string;
  patient_type: string;
  reference_no: string;
  amount_due: number;
  currency_code: string;
  payment_status: string;
  sync_status: string;
  last_error: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CashierPaymentLink = {
  id: number;
  source_module: string;
  source_key: string;
  cashier_reference: string | null;
  invoice_number: string | null;
  official_receipt: string | null;
  amount_due: number;
  amount_paid: number;
  balance_due: number;
  payment_status: string;
  paid_at: string | null;
  updated_at: string;
};

export type CashierIntegrationStatus = {
  enabled: boolean;
  syncMode: 'queue' | 'auto';
  baseUrl: string;
  inboundPath: string;
  queue: {
    pending: number;
    sent: number;
    acknowledged: number;
    failed: number;
  };
  recentEvents: CashierIntegrationQueueItem[];
  recentPayments: CashierPaymentLink[];
};

export type CashierQueueResult = {
  items: CashierIntegrationQueueItem[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

export type CashierDepartmentRecord = {
  id: number;
  clearance_reference: string;
  patient_id: string | null;
  patient_code: string | null;
  patient_name: string;
  patient_type: string;
  department_key: string;
  department_name: string;
  stage_order: number;
  status: string;
  remarks: string | null;
  approver_name: string | null;
  approver_role: string | null;
  external_reference: string | null;
  requested_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type CashierDepartmentResult = {
  items: CashierDepartmentRecord[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  departments?: Array<Record<string, unknown>>;
};

type PaginationParams = {
  page?: number;
  perPage?: number;
};

type CashierQueueParams = PaginationParams & {
  syncStatus?: string;
  sourceModule?: string;
};

type CashierDepartmentParams = PaginationParams & {
  status?: string;
  search?: string;
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveCashierIntegrationBaseUrl(): string {
  const directApi = import.meta.env.VITE_CASHIER_INTEGRATION_API_URL?.trim();
  if (directApi) return trimTrailingSlashes(directApi);

  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/integrations/cashier`;

  return '/api/integrations/cashier';
}

function resolveCashierDepartmentUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/integrations/departments/records`;
  return '/api/integrations/departments/records';
}

function withQuery(url: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    query.set(key, String(value));
  });

  const suffix = query.toString();
  return suffix ? `${url}?${suffix}` : url;
}

export async function fetchCashierIntegrationStatus(): Promise<CashierIntegrationStatus> {
  return await fetchApiData<CashierIntegrationStatus>(`${resolveCashierIntegrationBaseUrl()}/status`, { ttlMs: 5_000 });
}

export async function fetchCashierQueue(params: CashierQueueParams = {}): Promise<CashierQueueResult> {
  return await fetchApiData<CashierQueueResult>(
    withQuery(`${resolveCashierIntegrationBaseUrl()}/queue`, {
      page: params.page,
      per_page: params.perPage,
      sync_status: params.syncStatus,
      source_module: params.sourceModule
    }),
    { ttlMs: 3_000 }
  );
}

export async function fetchCashierDepartmentRecords(params: CashierDepartmentParams = {}): Promise<CashierDepartmentResult> {
  return await fetchApiData<CashierDepartmentResult>(
    withQuery(resolveCashierDepartmentUrl(), {
      department: 'cashier',
      page: params.page,
      per_page: params.perPage,
      status: params.status,
      search: params.search
    }),
    { ttlMs: 3_000 }
  );
}

export async function dispatchPendingCashierEvents(limit = 10): Promise<void> {
  await fetchApiData<unknown>(`${resolveCashierIntegrationBaseUrl()}/sync`, {
    method: 'POST',
    body: { action: 'dispatch_pending', limit }
  });
  invalidateCashierIntegrationCache();
}

export async function updateCashierPaymentStatus(payload: Record<string, unknown>): Promise<void> {
  await fetchApiData<unknown>(`${resolveCashierIntegrationBaseUrl()}/payment-status`, {
    method: 'POST',
    body: payload
  });
  invalidateCashierIntegrationCache();
  invalidateApiCache('/api/dashboard');
  invalidateApiCache('/api/reports');
}

export async function submitCashierDepartmentDecision(payload: Record<string, unknown>): Promise<void> {
  await fetchApiData<unknown>(resolveCashierDepartmentUrl(), {
    method: 'POST',
    body: {
      action: 'submit_decision',
      department_key: 'cashier',
      ...payload
    }
  });
  invalidateCashierIntegrationCache();
}

export function invalidateCashierIntegrationCache(): void {
  invalidateApiCache('/api/integrations/cashier');
  invalidateApiCache('/api/integrations/departments/records');
}
