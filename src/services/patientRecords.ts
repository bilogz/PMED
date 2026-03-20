import { fetchApiData } from '@/services/apiClient';

export type PatientRecord = {
  patientCode: string;
  patientName: string;
  patientEmail: string;
  phoneNumber: string;
  patientType: 'student' | 'teacher' | 'unknown';
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_BASE_URL?.trim();
  if (configured) return `${trimTrailingSlashes(configured)}/patients`;
  return '/api/patients';
}

export async function fetchPatientRecords(search = '', forceRefresh = false): Promise<PatientRecord[]> {
  const params = new URLSearchParams();
  params.set('page', '1');
  params.set('per_page', '50');
  if (search.trim()) params.set('search', search.trim());

  const payload = await fetchApiData<{
    items?: Array<Record<string, unknown>>;
  }>(`${resolveApiUrl()}?${params.toString()}`, {
    ttlMs: 10_000,
    forceRefresh,
    cacheKey: `patient-records:${search.trim().toLowerCase()}`
  });

  return Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const type = String(item.patient_type || 'unknown').trim().toLowerCase();
        return {
          patientCode: String(item.patient_code || ''),
          patientName: String(item.patient_name || ''),
          patientEmail: String(item.email || ''),
          phoneNumber: String(item.contact || ''),
          patientType: type === 'student' || type === 'teacher' ? type : 'unknown'
        };
      })
    : [];
}
