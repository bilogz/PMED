import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type DataCollectionSubmission = {
  id: string;
  planReference: string;
  department: string;
  feedType: string;
  coveragePeriod: string;
  status: string;
  reviewerName: string;
  sourceTable: string;
  sourceEndpoint: string;
  remarks: string;
  submittedAt: string;
  updatedAt: string;
};

export type DataCollectionDepartment = {
  name: string;
  status: string;
  note: string;
};

export type DataCollectionActivityLog = {
  id: number;
  reference: string;
  action: string;
  detail: string;
  actor: string;
  tone: 'success' | 'warning' | 'info';
  createdAt: string;
};

export type DataCollectionWorkspace = {
  submissions: DataCollectionSubmission[];
  departments: DataCollectionDepartment[];
  activityLogs: DataCollectionActivityLog[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/data-collection`;
  return '/api/pmed/data-collection';
}

export async function fetchDataCollectionWorkspace(forceRefresh = false): Promise<DataCollectionWorkspace> {
  return await fetchApiData<DataCollectionWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-data-collection-workspace'
  });
}

export async function saveDataCollectionSubmission(payload: {
  submissionReference: string;
  planReference?: string;
  departmentName: string;
  feedType: string;
  coveragePeriod: string;
  submissionStatus?: string;
  validationStatus?: string;
  reviewerName?: string;
  sourceTable?: string;
  sourceEndpoint?: string;
  remarks?: string;
  actor?: string;
  action?: 'upsert' | 'request' | 'import_data' | 'fetch_department_feed';
}): Promise<DataCollectionWorkspace> {
  const data = await fetchApiData<DataCollectionWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action: payload.action || 'upsert',
      submission_reference: payload.submissionReference,
      plan_reference: payload.planReference,
      department_name: payload.departmentName,
      feed_type: payload.feedType,
      coverage_period: payload.coveragePeriod,
      submission_status: payload.submissionStatus,
      validation_status: payload.validationStatus,
      reviewer_name: payload.reviewerName,
      source_table: payload.sourceTable,
      source_endpoint: payload.sourceEndpoint,
      remarks: payload.remarks,
      actor: payload.actor || 'PMED Admin'
    }
  });
  invalidateApiCache('pmed-data-collection-workspace');
  return data;
}

export async function runDataCollectionAction(
  action: 'validate' | 'send_back',
  submissionReference: string,
  options?: {
    actor?: string;
    remarks?: string;
  }
): Promise<DataCollectionWorkspace> {
  const data = await fetchApiData<DataCollectionWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      submission_reference: submissionReference,
      actor: options?.actor || 'PMED Admin',
      remarks: options?.remarks
    }
  });
  invalidateApiCache('pmed-data-collection-workspace');
  return data;
}
