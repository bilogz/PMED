import { fetchApiData } from '@/services/apiClient';

export type EnrollmentStatisticsRecord = {
  id: string;
  batchId: string;
  source: string;
  office: string;
  metric: string;
  currentValue: number;
  reportType: string;
  payload: Record<string, unknown> | null;
  sentAt: string;
  createdAt: string;
};

export type EnrollmentStatisticsSummary = {
  totalRecords: number;
  totalValue: number;
  activeBatches: number;
  sourceCount: number;
};

export type EnrollmentStatisticsWorkspace = {
  summary: EnrollmentStatisticsSummary;
  records: EnrollmentStatisticsRecord[];
  availableSources: string[];
  availableReportTypes: string[];
  lastSentAt: string;
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/enrollment-statistics`;
  return '/api/pmed/enrollment-statistics';
}

export async function fetchEnrollmentStatisticsWorkspace(forceRefresh = false): Promise<EnrollmentStatisticsWorkspace> {
  return await fetchApiData<EnrollmentStatisticsWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-enrollment-statistics-workspace'
  });
}
