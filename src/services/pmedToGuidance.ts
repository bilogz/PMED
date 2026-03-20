import { dispatchDepartmentFlow, getFlowEventStatus, type FlowEventStatus } from '@/services/departmentIntegration';

export type MonitoringAlert = {
  alert_type: 'wellness_concern' | 'attendance_pattern' | 'behavioral_issue' | 'academic_distress' | 'safety_concern';
  person_id: string;
  person_name: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  recommended_action?: string;
  source_module?: string;
  alert_date?: string;
  flagged_by?: string;
  notes?: string;
};

export type MonitoringAlertResult = FlowEventStatus & {
  alert?: MonitoringAlert;
};

export async function dispatchMonitoringAlertToGuidance(
  alert: MonitoringAlert,
  sourceRecordId?: string
): Promise<MonitoringAlertResult> {
  const payload: Record<string, unknown> = {
    alert_type: alert.alert_type,
    person_id: alert.person_id,
    person_name: alert.person_name,
    severity: alert.severity || 'medium',
    description: alert.description,
    recommended_action: alert.recommended_action,
    source_module: alert.source_module || 'pmed',
    alert_date: alert.alert_date || new Date().toISOString(),
    flagged_by: alert.flagged_by,
    notes: alert.notes
  };

  const result = await dispatchDepartmentFlow(
    'pmed',
    'guidance',
    'monitoring_alerts',
    payload,
    sourceRecordId
  );

  if (result.ok && result.correlation_id) {
    const status = await getFlowEventStatus(undefined, result.correlation_id);
    return {
      ...status,
      alert
    };
  }

  return {
    ok: false,
    last_error: result.message || 'Failed to dispatch monitoring alert'
  } as MonitoringAlertResult;
}

export async function alertGuidanceOfStudentConcern(
  personId: string,
  personName: string,
  alertType: MonitoringAlert['alert_type'],
  description: string,
  severity: MonitoringAlert['severity'] = 'medium',
  recommendedAction?: string
): Promise<MonitoringAlertResult> {
  return dispatchMonitoringAlertToGuidance({
    alert_type: alertType,
    person_id: personId,
    person_name: personName,
    severity,
    description,
    recommended_action: recommendedAction
  });
}
