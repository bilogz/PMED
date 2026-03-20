import { fetchApiData } from '@/services/apiClient';

export type DepartmentMapEntry = {
  key: string;
  name: string;
  receives: string[];
  sends: string[];
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/integrations/departments/map`;
  return '/api/integrations/departments/map';
}

export async function fetchDepartmentMap(forceRefresh = false): Promise<DepartmentMapEntry[]> {
  const payload = await fetchApiData<{ departments?: Array<Record<string, unknown>> }>(resolveApiUrl(), {
    ttlMs: 30_000,
    forceRefresh,
    cacheKey: 'department-map'
  });

  return Array.isArray(payload.departments)
    ? payload.departments.map((item) => ({
        key: String(item.key || ''),
        name: String(item.name || ''),
        receives: Array.isArray(item.receives) ? item.receives.map((value) => String(value || '').toLowerCase()) : [],
        sends: Array.isArray(item.sends) ? item.sends.map((value) => String(value || '').toLowerCase()) : []
      }))
    : [];
}
