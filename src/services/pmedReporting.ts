import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type ReportingRecord = {
  id: string;
  planReference: string;
  reportName: string;
  reportType: string;
  sourceDepartment: string;
  ownerName: string;
  exportFormat: string;
  generatedAt: string;
  deliveryStatus: string;
  archiveStatus: string;
  fileUrl: string;
  administrationSentAt: string;
  isExternalDelivery?: boolean;
  packageSummary?: Record<string, unknown> | null;
  packageSections?: Array<Record<string, unknown>>;
};

export type ReportingChecklistItem = {
  id: number;
  label: string;
  done: boolean;
};

export type ReportingActivityLog = {
  id: number;
  reference: string;
  action: string;
  detail: string;
  actor: string;
  tone: 'success' | 'warning' | 'info';
  createdAt: string;
};

export type ReportingWorkspace = {
  reports: ReportingRecord[];
  dispatchChecklist: ReportingChecklistItem[];
  activityLogs: ReportingActivityLog[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/reporting`;
  return '/api/pmed/reporting';
}

export async function fetchReportingWorkspace(forceRefresh = false): Promise<ReportingWorkspace> {
  return await fetchApiData<ReportingWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-reporting-workspace'
  });
}

export async function saveReportingRecord(payload: {
  reportReference: string;
  planReference?: string;
  reportName: string;
  ownerName?: string;
  exportFormat?: string;
  reportType?: string;
  sourceDepartment?: string;
  deliveryStatus?: string;
  archiveStatus?: string;
  fileUrl?: string;
  actor?: string;
  action?: 'upsert' | 'generate_report' | 'export_pdf' | 'request_department_report' | 'receive_department_report' | 'finalize_report';
}): Promise<ReportingWorkspace> {
  const data = await fetchApiData<ReportingWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action: payload.action || 'upsert',
      report_reference: payload.reportReference,
      plan_reference: payload.planReference,
      report_name: payload.reportName,
      source_department: payload.sourceDepartment,
      owner_name: payload.ownerName,
      export_format: payload.exportFormat,
      report_type: payload.reportType,
      delivery_status: payload.deliveryStatus,
      archive_status: payload.archiveStatus,
      file_url: payload.fileUrl,
      actor: payload.actor || 'Reports Analyst'
    }
  });
  invalidateApiCache('pmed-reporting-workspace');
  return data;
}

export async function runReportingAction(
  action: 'send_to_administration' | 'archive_report',
  payload: {
    reportReference?: string;
    actor?: string;
  }
): Promise<ReportingWorkspace> {
  const data = await fetchApiData<ReportingWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      report_reference: payload.reportReference,
      actor: payload.actor || 'Reports Analyst'
    }
  });
  invalidateApiCache('pmed-reporting-workspace');
  return data;
}
