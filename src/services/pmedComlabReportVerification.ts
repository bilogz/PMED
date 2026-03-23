import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type PmedComlabVerificationRecord = {
  documentId: string;
  title: string;
  subjectRef: string;
  reportCategory: string;
  itemReference: string;
  quantity: number;
  status: string;
  workflowStage: string;
  workflowLabel: string;
  details: string;
  pmedVerificationNotes: string;
  pmedReturnNotes: string;
  submittedAt: string;
  updatedAt: string;
  canVerify: boolean;
  canReturn: boolean;
};

export type PmedComlabVerificationWorkspace = {
  summary: {
    total: number;
    pendingVerification: number;
    verified: number;
    returned: number;
    closed: number;
  };
  records: PmedComlabVerificationRecord[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/comlab-report-verification`;
  return '/api/pmed/comlab-report-verification';
}

export async function fetchPmedComlabVerificationWorkspace(forceRefresh = false): Promise<PmedComlabVerificationWorkspace> {
  return await fetchApiData<PmedComlabVerificationWorkspace>(resolveApiUrl(), {
    ttlMs: 8_000,
    forceRefresh,
    cacheKey: 'pmed-comlab-report-verification-workspace'
  });
}

export async function runPmedComlabVerificationAction(
  action: 'pmed_verify_report' | 'pmed_return_report',
  payload: { documentId: string; notes?: string; actor?: string }
): Promise<PmedComlabVerificationWorkspace> {
  const data = await fetchApiData<PmedComlabVerificationWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      document_id: payload.documentId,
      notes: payload.notes || '',
      actor: payload.actor || 'PMED Verification Desk'
    }
  });
  invalidateApiCache('pmed-comlab-report-verification-workspace');
  return data;
}
