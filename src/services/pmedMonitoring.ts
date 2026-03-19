import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type MonitoringSnapshot = {
  id: string;
  planReference: string;
  department: string;
  indicator: string;
  targetValue: number;
  actualValue: number;
  varianceValue: number;
  status: string;
  issueFlag: number;
  assignedTo: string;
  summary: string;
  capturedAt: string;
  updatedAt: string;
};

export type MonitoringAlert = {
  id: number;
  message: string;
  severity: string;
};

export type MonitoringActivityLog = {
  id: number;
  reference: string;
  action: string;
  detail: string;
  actor: string;
  tone: 'success' | 'warning' | 'info';
  createdAt: string;
};

export type MonitoringWorkspace = {
  snapshots: MonitoringSnapshot[];
  alerts: MonitoringAlert[];
  activityLogs: MonitoringActivityLog[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/monitoring`;
  return '/api/pmed/monitoring';
}

export async function fetchMonitoringWorkspace(forceRefresh = false): Promise<MonitoringWorkspace> {
  return await fetchApiData<MonitoringWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-monitoring-workspace'
  });
}

export async function saveMonitoringSnapshot(payload: {
  monitorReference: string;
  planReference?: string;
  departmentName: string;
  indicatorName: string;
  targetValue: number;
  actualValue: number;
  status?: string;
  summary?: string;
  actor?: string;
  action?: 'upsert' | 'track_progress';
}): Promise<MonitoringWorkspace> {
  const data = await fetchApiData<MonitoringWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action: payload.action || 'upsert',
      monitor_reference: payload.monitorReference,
      plan_reference: payload.planReference,
      department_name: payload.departmentName,
      indicator_name: payload.indicatorName,
      target_value: payload.targetValue,
      actual_value: payload.actualValue,
      status: payload.status,
      summary: payload.summary,
      actor: payload.actor || 'Monitoring Officer'
    }
  });
  invalidateApiCache('pmed-monitoring-workspace');
  return data;
}

export async function runMonitoringAction(
  action: 'flag_issue' | 'resolve_issue' | 'notify' | 'generate_summary',
  payload: {
    monitorReference?: string;
    summary?: string;
    status?: string;
    actor?: string;
  }
): Promise<MonitoringWorkspace> {
  const data = await fetchApiData<MonitoringWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      monitor_reference: payload.monitorReference,
      summary: payload.summary,
      status: payload.status,
      actor: payload.actor || 'Monitoring Officer'
    }
  });
  invalidateApiCache('pmed-monitoring-workspace');
  return data;
}
