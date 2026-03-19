import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type EvaluationRecord = {
  id: string;
  planReference: string;
  department: string;
  scoreValue: number;
  targetResult: string;
  actualResult: string;
  decisionStatus: string;
  reviewedBy: string;
  remarks: string;
  evaluatedAt: string;
  approvedAt: string;
};

export type EvaluationFinding = {
  id: number;
  title: string;
  detail: string;
};

export type EvaluationActivityLog = {
  id: number;
  reference: string;
  action: string;
  detail: string;
  actor: string;
  tone: 'success' | 'warning' | 'info';
  createdAt: string;
};

export type EvaluationWorkspace = {
  evaluations: EvaluationRecord[];
  findings: EvaluationFinding[];
  activityLogs: EvaluationActivityLog[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/evaluation`;
  return '/api/pmed/evaluation';
}

export async function fetchEvaluationWorkspace(forceRefresh = false): Promise<EvaluationWorkspace> {
  return await fetchApiData<EvaluationWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-evaluation-workspace'
  });
}

export async function saveEvaluationRecord(payload: {
  evaluationReference: string;
  planReference?: string;
  departmentName: string;
  scoreValue: number;
  targetResult: string;
  actualResult: string;
  decisionStatus?: string;
  remarks?: string;
  actor?: string;
  action?: 'upsert' | 'evaluate_performance' | 'score_departments' | 'add_remarks';
}): Promise<EvaluationWorkspace> {
  const data = await fetchApiData<EvaluationWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action: payload.action || 'upsert',
      evaluation_reference: payload.evaluationReference,
      plan_reference: payload.planReference,
      department_name: payload.departmentName,
      score_value: payload.scoreValue,
      target_result: payload.targetResult,
      actual_result: payload.actualResult,
      decision_status: payload.decisionStatus,
      remarks: payload.remarks,
      actor: payload.actor || 'Evaluation Officer'
    }
  });
  invalidateApiCache('pmed-evaluation-workspace');
  return data;
}

export async function runEvaluationAction(
  action: 'approve_evaluation' | 'compare_results' | 'send_feedback_hr',
  payload: {
    evaluationReference?: string;
    remarks?: string;
    actor?: string;
  }
): Promise<EvaluationWorkspace> {
  const data = await fetchApiData<EvaluationWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      evaluation_reference: payload.evaluationReference,
      remarks: payload.remarks,
      actor: payload.actor || 'Evaluation Officer'
    }
  });
  invalidateApiCache('pmed-evaluation-workspace');
  return data;
}
