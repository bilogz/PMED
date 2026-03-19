import { fetchApiData, invalidateApiCache } from '@/services/apiClient';

export type PlanningWorkspacePlan = {
  id: string;
  program: string;
  lead: string;
  scheduleStart: string;
  scheduleEnd: string;
  budget: number;
  status: string;
  targetCount: number;
  departments: string[];
  requirementsAttached: boolean;
  updatedAt: string;
};

export type PlanningWorkspaceLog = {
  id: number;
  planReference: string;
  action: string;
  detail: string;
  actor: string;
  tone: 'success' | 'info' | 'warning';
  createdAt: string;
};

export type PlanningWorkspaceDepartment = {
  name: string;
  role: string;
  owner: string;
  status: string;
};

export type PlanningWorkspace = {
  plans: PlanningWorkspacePlan[];
  activityLogs: PlanningWorkspaceLog[];
  departments: PlanningWorkspaceDepartment[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/pmed/planning`;
  return '/api/pmed/planning';
}

export async function fetchPlanningWorkspace(forceRefresh = false): Promise<PlanningWorkspace> {
  return await fetchApiData<PlanningWorkspace>(resolveApiUrl(), {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: 'pmed-planning-workspace'
  });
}

export async function savePlanningWorkspacePlan(payload: {
  planReference: string;
  programTitle: string;
  leadDepartment: string;
  scheduleStart: string;
  scheduleEnd: string;
  budgetAmount: number;
  status: string;
  targetCount: number;
  departments: string[];
  requirementsAttached: boolean;
  actor?: string;
  isEdit?: boolean;
}): Promise<PlanningWorkspace> {
  const data = await fetchApiData<PlanningWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action: 'upsert',
      plan_reference: payload.planReference,
      program_title: payload.programTitle,
      lead_department: payload.leadDepartment,
      schedule_start: payload.scheduleStart,
      schedule_end: payload.scheduleEnd,
      budget_amount: payload.budgetAmount,
      status: payload.status,
      target_count: payload.targetCount,
      departments: payload.departments,
      requirements_attached: payload.requirementsAttached,
      actor: payload.actor || 'PMED Admin',
      is_edit: payload.isEdit ? 'true' : 'false'
    }
  });
  invalidateApiCache('pmed-planning-workspace');
  return data;
}

export async function runPlanningWorkspaceAction(action: 'submit' | 'archive' | 'attach_requirements', planReference: string, actor = 'PMED Admin'): Promise<PlanningWorkspace> {
  const data = await fetchApiData<PlanningWorkspace>(resolveApiUrl(), {
    method: 'POST',
    body: {
      action,
      plan_reference: planReference,
      actor
    }
  });
  invalidateApiCache('pmed-planning-workspace');
  return data;
}
