import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type ExchangeBoardRecord = {
  id: string;
  recordType: string;
  title: string;
  stage: string;
  sourceDepartment: string;
  targetDepartment: string;
  direction: 'Inbound' | 'Outbound' | 'Internal';
  status: string;
  owner: string;
  detail: string;
  entityKey: string;
  updatedAt: string;
};

export type ExchangeBoardDepartment = {
  key: string;
  name: string;
  purpose: string;
  inbound: number;
  outbound: number;
  waiting: number;
};

export type ExchangeBoardActivityLog = {
  id: number;
  action: string;
  detail: string;
  actor: string;
  reference: string;
  createdAt: string;
};

export type ExchangeBoardWorkspace = {
  records: ExchangeBoardRecord[];
  departments: ExchangeBoardDepartment[];
  activityLogs: ExchangeBoardActivityLog[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/exchange-board`;
  return '/api/pmed/exchange-board';
}

export async function fetchExchangeBoardWorkspace(forceRefresh = false): Promise<ExchangeBoardWorkspace> {
  return await fetchApiData<ExchangeBoardWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-exchange-board-workspace'
  });
}

export async function runExchangeBoardAction(
  action: 'request_exchange' | 'acknowledge_exchange' | 'dispatch_exchange',
  payload: {
    recordReference?: string;
    entityKey?: string;
    title?: string;
    detail?: string;
    stage?: string;
    targetDepartment?: string;
    requestType?: string;
    essentialsCategory?: string;
    quantity?: number;
    actor?: string;
  }
): Promise<ExchangeBoardWorkspace> {
  const data = await fetchApiData<ExchangeBoardWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      record_reference: payload.recordReference,
      entity_key: payload.entityKey,
      title: payload.title,
      detail: payload.detail,
      stage: payload.stage,
      target_department: payload.targetDepartment,
      request_type: payload.requestType,
      essentials_category: payload.essentialsCategory,
      quantity: payload.quantity,
      actor: payload.actor || 'PMED Exchange Desk'
    }
  });
  invalidateApiCache('pmed-exchange-board-workspace');
  return data;
}
