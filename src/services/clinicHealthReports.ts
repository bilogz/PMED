import { fetchApiData } from '@/services/apiClient';

export type HealthReportSeverity = 'low' | 'moderate' | 'high' | 'emergency';
export type HealthReportStudentType = 'student' | 'teacher' | 'unknown';

export type MedicineEntry = {
  name: string;
  dose?: string;
  quantity?: string;
  notes?: string;
};

export type ClinicHealthReport = {
  id: number;
  reportCode: string;
  studentId: string;
  studentName: string;
  studentType: HealthReportStudentType;
  gradeSection: string;
  age: number | null;
  sex: string;
  healthIssue: string;
  symptoms: string;
  severity: HealthReportSeverity;
  treatmentGiven: string;
  medicinesUsed: MedicineEntry[];
  firstAidGiven: string;
  attendingStaff: string;
  remarks: string;
  sentToPmed: boolean;
  pmedSentAt: string | null;
  pmedEntityKey: string;
  createdAt: string;
  updatedAt: string;
};

export type ClinicHealthReportListPayload = {
  items: ClinicHealthReport[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

type FetchQuery = {
  search?: string;
  severity?: HealthReportSeverity;
  studentType?: HealthReportStudentType;
  page?: number;
  perPage?: number;
  forceRefresh?: boolean;
};

export async function fetchClinicHealthReports(query: FetchQuery = {}): Promise<ClinicHealthReportListPayload> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.severity) params.set('severity', query.severity);
  if (query.studentType) params.set('student_type', query.studentType);
  if (query.page) params.set('page', String(query.page));
  if (query.perPage) params.set('per_page', String(query.perPage));

  const url = `/api/pmed/clinic-health-reports${params.toString() ? `?${params.toString()}` : ''}`;
  const result = await fetchApiData<{ ok: boolean; data: ClinicHealthReportListPayload }>(url, {
    ttlMs: 8_000,
    forceRefresh: query.forceRefresh
  });
  // Handle both wrapped { data: ... } and direct payload shapes
  return (result as any)?.data ?? (result as any);
}
