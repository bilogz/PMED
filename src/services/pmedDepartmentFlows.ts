import { dispatchDepartmentFlow, getFlowEventStatus, type FlowEventStatus } from '@/services/departmentIntegration';

type TrackedPmedDispatch<T> = FlowEventStatus & {
  payload?: T;
};

async function trackPmedDispatch<T>(
  targetDepartment: 'cashier' | 'comlab' | 'hr',
  eventCode: string,
  payload: Record<string, unknown>,
  sourceRecordId: string | undefined,
  attachment: T,
  fallbackMessage: string
): Promise<TrackedPmedDispatch<T>> {
  const result = await dispatchDepartmentFlow('pmed', targetDepartment, eventCode, payload, sourceRecordId);

  if (result.ok && result.correlation_id) {
    const status = await getFlowEventStatus(undefined, result.correlation_id);
    return {
      ...status,
      payload: attachment
    };
  }

  return {
    ok: false,
    last_error: result.message || fallbackMessage,
    payload: attachment
  };
}

export type PmedFinancialReportRequest = {
  report_name: string;
  requested_by: string;
  report_period?: string;
  reference_no?: string;
};

export async function dispatchFinancialReportRequestToCashier(
  request: PmedFinancialReportRequest,
  sourceRecordId?: string
): Promise<TrackedPmedDispatch<PmedFinancialReportRequest>> {
  return await trackPmedDispatch(
    'cashier',
    'financial_report_requests',
    {
      report_name: request.report_name,
      requested_by: request.requested_by,
      report_period: request.report_period,
      reference_no: request.reference_no
    },
    sourceRecordId,
    request,
    'Failed to dispatch financial report request to Cashier.'
  );
}

export type PmedFacultyAttendance = {
  report_period: string;
  attendance_summary: string;
  faculty_count?: number;
  notes?: string;
};

export async function dispatchFacultyAttendanceToComlab(
  report: PmedFacultyAttendance,
  sourceRecordId?: string
): Promise<TrackedPmedDispatch<PmedFacultyAttendance>> {
  return await trackPmedDispatch(
    'comlab',
    'pmed_faculty_attendance',
    {
      report_period: report.report_period,
      attendance_summary: report.attendance_summary,
      faculty_count: report.faculty_count,
      notes: report.notes
    },
    sourceRecordId,
    report,
    'Failed to dispatch faculty attendance to COMLAB.'
  );
}

export type PmedStaffEvaluationFeedback = {
  report_period: string;
  feedback_summary: string;
  employee_count?: number;
  recommendations?: string;
};

export async function dispatchStaffEvaluationFeedbackToHr(
  feedback: PmedStaffEvaluationFeedback,
  sourceRecordId?: string
): Promise<TrackedPmedDispatch<PmedStaffEvaluationFeedback>> {
  return await trackPmedDispatch(
    'hr',
    'hr_staff_request',
    {
      report_period: feedback.report_period,
      feedback_summary: feedback.feedback_summary,
      employee_count: feedback.employee_count,
      recommendations: feedback.recommendations
    },
    sourceRecordId,
    feedback,
    'Failed to dispatch staff evaluation feedback to HR.'
  );
}
