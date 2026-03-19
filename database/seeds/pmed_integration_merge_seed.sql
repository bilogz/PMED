-- PMED integration seed based on:
-- C:\xampp\htdocs\bpm commision\supabase\integration-merge\02-pmed.sql
--
-- Run after:
-- 1. C:\xampp\htdocs\bpm commision\supabase\integration-merge\01-clinic.sql
-- 2. C:\xampp\htdocs\bpm commision\supabase\integration-merge\02-pmed.sql
--
-- This seed targets the shared integration contract where PMED consumes
-- clinic-owned integration tables through the `pmed` schema views.

BEGIN;

WITH desired_profile AS (
  SELECT
    'pmed'::text AS department_key,
    'PMED'::text AS department_name,
    COALESCE(
      (SELECT flow_order FROM clinic.department_flow_profiles WHERE department_key = 'pmed'),
      (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM clinic.department_flow_profiles WHERE flow_order = 2)
            THEN COALESCE(MAX(flow_order), 0) + 1
          ELSE 2
        END
        FROM clinic.department_flow_profiles
      )
    ) AS flow_order,
    COALESCE(
      (SELECT clearance_stage_order FROM clinic.department_flow_profiles WHERE department_key = 'pmed'),
      (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM clinic.department_flow_profiles WHERE clearance_stage_order = 2)
            THEN COALESCE(MAX(clearance_stage_order), 0) + 1
          ELSE 2
        END
        FROM clinic.department_flow_profiles
      )
    ) AS clearance_stage_order,
    '["registrar","cashier","clinic","guidance","prefect","comlab","crad","hr"]'::jsonb AS receives,
    '["school_admin","hr"]'::jsonb AS sends,
    'Aggregates enrollment, finance, health, counseling, discipline, laboratory, activity, and employee performance records for evaluation reporting.'::text AS notes
)
INSERT INTO clinic.department_flow_profiles (
  department_key,
  department_name,
  flow_order,
  clearance_stage_order,
  receives,
  sends,
  notes
)
SELECT * FROM desired_profile
ON CONFLICT (department_key) DO UPDATE
SET
  department_name = EXCLUDED.department_name,
  receives = EXCLUDED.receives,
  sends = EXCLUDED.sends,
  notes = EXCLUDED.notes,
  updated_at = NOW();

UPDATE clinic.department_flow_profiles
SET
  receives = '["cashier","clinic","guidance","prefect","crad"]'::jsonb,
  sends = '["cashier","clinic","guidance","prefect","comlab","crad","pmed"]'::jsonb,
  notes = 'Maintains enrollment data, student information, academic records, and master student lists.',
  updated_at = NOW()
WHERE department_key = 'registrar';

UPDATE clinic.department_flow_profiles
SET
  receives = '["registrar","hr"]'::jsonb,
  sends = '["registrar","pmed"]'::jsonb,
  notes = 'Handles payment confirmation, payroll-linked financial processing, and PMED financial reporting.',
  updated_at = NOW()
WHERE department_key = 'cashier';

UPDATE clinic.department_flow_profiles
SET
  receives = '["registrar","prefect"]'::jsonb,
  sends = '["registrar","guidance","pmed"]'::jsonb,
  notes = 'Processes medical clearances, health concerns, and health service reporting.',
  updated_at = NOW()
WHERE department_key = 'clinic';

UPDATE clinic.department_flow_profiles
SET
  receives = '["registrar"]'::jsonb,
  sends = '["registrar","pmed","clinic","prefect","crad"]'::jsonb,
  notes = 'Maintains counseling reports, health concerns, discipline coordination, and student recommendations.',
  updated_at = NOW()
WHERE department_key = 'guidance';

UPDATE clinic.department_flow_profiles
SET
  receives = '["registrar"]'::jsonb,
  sends = '["registrar","guidance","clinic","pmed"]'::jsonb,
  notes = 'Tracks discipline records, incident reports, and PMED discipline statistics.',
  updated_at = NOW()
WHERE department_key = 'prefect';

UPDATE clinic.department_flow_profiles
SET
  receives = '["registrar","hr"]'::jsonb,
  sends = '["pmed"]'::jsonb,
  notes = 'Maintains student and staff access lists and laboratory usage reports.',
  updated_at = NOW()
WHERE department_key = 'comlab';

UPDATE clinic.department_flow_profiles
SET
  receives = '["registrar","guidance"]'::jsonb,
  sends = '["registrar","pmed"]'::jsonb,
  notes = 'Tracks activity participation records and program activity reports.',
  updated_at = NOW()
WHERE department_key = 'crad';

UPDATE clinic.department_flow_profiles
SET
  receives = '["pmed"]'::jsonb,
  sends = '["cashier","registrar","comlab","pmed"]'::jsonb,
  notes = 'Provides payroll data, staff rosters, and employee performance records.',
  updated_at = NOW()
WHERE department_key = 'hr';

WITH school_admin_profile AS (
  SELECT
    'school_admin'::text AS department_key,
    'School Administration'::text AS department_name,
    COALESCE(
      (SELECT flow_order FROM clinic.department_flow_profiles WHERE department_key = 'school_admin'),
      (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM clinic.department_flow_profiles WHERE flow_order = 10)
            THEN COALESCE(MAX(flow_order), 0) + 1
          ELSE 10
        END
        FROM clinic.department_flow_profiles
      )
    ) AS flow_order,
    COALESCE(
      (SELECT clearance_stage_order FROM clinic.department_flow_profiles WHERE department_key = 'school_admin'),
      (
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM clinic.department_flow_profiles WHERE clearance_stage_order = 10)
            THEN COALESCE(MAX(clearance_stage_order), 0) + 1
          ELSE 10
        END
        FROM clinic.department_flow_profiles
      )
    ) AS clearance_stage_order,
    '["pmed"]'::jsonb AS receives,
    '[]'::jsonb AS sends,
    'Receives final PMED evaluation reports for executive review.'::text AS notes
)
INSERT INTO clinic.department_flow_profiles (
  department_key,
  department_name,
  flow_order,
  clearance_stage_order,
  receives,
  sends,
  notes
)
SELECT * FROM school_admin_profile
ON CONFLICT (department_key) DO UPDATE
SET
  department_name = EXCLUDED.department_name,
  receives = EXCLUDED.receives,
  sends = EXCLUDED.sends,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO clinic.department_clearance_records (
  clearance_reference,
  patient_id,
  patient_code,
  patient_name,
  patient_type,
  department_key,
  department_name,
  stage_order,
  status,
  remarks,
  approver_name,
  approver_role,
  external_reference,
  requested_by,
  decided_at,
  metadata,
  created_at,
  updated_at
)
VALUES
  (
    'CLR-2026-PMED-0001',
    'PAT-1001',
    'PAT-1001',
    'Maria Santos',
    'student',
    'pmed',
    'PMED',
    2,
    'pending',
    'Awaiting HR validation package and clinic readiness inputs.',
    NULL,
    NULL,
    'PMED-2026-0001',
    'PMED Seed',
    NULL,
    '{"source":"integration-seed","depends_on":["hr","clinic"],"stage":"planning"}'::jsonb,
    NOW() - INTERVAL '4 hour',
    NOW() - INTERVAL '4 hour'
  ),
  (
    'CLR-2026-PMED-0002',
    'PAT-1002',
    'PAT-1002',
    'John Reyes',
    'student',
    'pmed',
    'PMED',
    2,
    'approved',
    'PMED review completed and forwarded to clinic workflow.',
    'PMED Planning Lead',
    'PMED Officer',
    'PMED-2026-0002',
    'PMED Seed',
    NOW() - INTERVAL '1 day',
    '{"source":"integration-seed","next_department":"clinic","stage":"data_collection"}'::jsonb,
    NOW() - INTERVAL '2 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'CLR-2026-PMED-0003',
    'PAT-1003',
    'PAT-1003',
    'Anne Dela Cruz',
    'teacher',
    'pmed',
    'PMED',
    2,
    'hold',
    'Guidance-linked requirements still incomplete.',
    'PMED Evaluation Desk',
    'PMED Analyst',
    'PMED-2026-0003',
    'PMED Seed',
    NOW() - INTERVAL '10 hour',
    '{"source":"integration-seed","blocking_department":"guidance","stage":"evaluation"}'::jsonb,
    NOW() - INTERVAL '14 hour',
    NOW() - INTERVAL '10 hour'
  ),
  (
    'CLR-2026-PMED-0004',
    'PAT-1004',
    'PAT-1004',
    'Paolo Lim',
    'teacher',
    'pmed',
    'PMED',
    2,
    'pending',
    'Clinic screening roster imported and waiting validation.',
    NULL,
    NULL,
    'SUB-2026-010',
    'PMED Seed',
    NULL,
    '{"source":"integration-seed","stage":"data_collection","plan_reference":"PLN-2026-004","department_name":"Clinic","feed_type":"Staff screening roster","coverage_period":"Q2 2026","submission_status":"Completed","validation_status":"Pending Review","source_table":"patient_appointments","source_endpoint":"/api/appointments"}'::jsonb,
    NOW() - INTERVAL '12 hour',
    NOW() - INTERVAL '11 hour'
  ),
  (
    'CLR-2026-PMED-0005',
    'PAT-1005',
    'PAT-1005',
    'Trisha Garcia',
    'student',
    'pmed',
    'PMED',
    2,
    'approved',
    'School Health Week evaluation completed and approved.',
    'Quality Assurance Lead',
    'Evaluation Board',
    'EVAL-2026-010',
    'PMED Seed',
    NOW() - INTERVAL '6 hour',
    '{"source":"integration-seed","stage":"evaluation","plan_reference":"PLN-2026-001","department_name":"Clinic","score_value":94,"target_result":"Complete screenings within schedule","actual_result":"95% completed within target week","decision_status":"Approved","reviewed_by":"Quality Assurance Lead"}'::jsonb,
    NOW() - INTERVAL '8 hour',
    NOW() - INTERVAL '6 hour'
  ),
  (
    'CLR-2026-PMED-0006',
    'PAT-1006',
    'PAT-1006',
    'Kevin Bautista',
    'student',
    'pmed',
    'PMED',
    2,
    'approved',
    'Report packet finalized and ready for administration release.',
    'Reports Analyst',
    'Reporting Desk',
    'RPT-2026-010',
    'PMED Seed',
    NOW() - INTERVAL '3 hour',
    '{"source":"integration-seed","stage":"reporting","plan_reference":"PLN-2026-001","report_reference":"RPT-2026-010","report_name":"School Health Week Final Report","owner_name":"Reports Analyst","export_format":"PDF","delivery_status":"Ready to Send","archive_status":"Active","file_url":"/reports/pmed/school-health-week-final.pdf"}'::jsonb,
    NOW() - INTERVAL '4 hour',
    NOW() - INTERVAL '3 hour'
  )
ON CONFLICT (clearance_reference) DO UPDATE
SET
  patient_id = EXCLUDED.patient_id,
  patient_code = EXCLUDED.patient_code,
  patient_name = EXCLUDED.patient_name,
  patient_type = EXCLUDED.patient_type,
  department_key = EXCLUDED.department_key,
  department_name = EXCLUDED.department_name,
  stage_order = EXCLUDED.stage_order,
  status = EXCLUDED.status,
  remarks = EXCLUDED.remarks,
  approver_name = EXCLUDED.approver_name,
  approver_role = EXCLUDED.approver_role,
  external_reference = EXCLUDED.external_reference,
  requested_by = EXCLUDED.requested_by,
  decided_at = EXCLUDED.decided_at,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO clinic.cashier_integration_events (
  event_key,
  source_module,
  source_entity,
  source_key,
  patient_name,
  patient_type,
  reference_no,
  amount_due,
  currency_code,
  payment_status,
  sync_status,
  last_error,
  synced_at,
  payload,
  created_at,
  updated_at
)
VALUES
  (
    'pmed-event-PLN-2026-003',
    'pmed',
    'plan',
    'PLN-2026-003',
    'Anne Dela Cruz',
    'teacher',
    'PMED-BILL-2026-003',
    52000.00,
    'PHP',
    'partial',
    'sent',
    NULL,
    NOW() - INTERVAL '1 day',
    '{"plan_reference":"PLN-2026-003","program":"Immunization Drive","stage":"monitoring"}'::jsonb,
    NOW() - INTERVAL '1 day 2 hour',
    NOW() - INTERVAL '1 day'
  ),
  (
    'pmed-monitor-MON-2026-004',
    'pmed',
    'monitoring',
    'PLN-2026-004',
    'Staff Wellness Check',
    'teacher',
    'MON-2026-004',
    180.00,
    'PHP',
    'partial',
    'pending',
    'Roster validation is still below threshold.',
    NOW() - INTERVAL '8 hour',
    '{"plan_reference":"PLN-2026-004","department_name":"HR","indicator_name":"Staff roster prepared","monitoring_status":"Needs Attention","target_value":180,"actual_value":140,"variance_value":-40,"owner_name":"HR Wellness Officer","summary":"Not enough validated employees yet."}'::jsonb,
    NOW() - INTERVAL '9 hour',
    NOW() - INTERVAL '8 hour'
  ),
  (
    'clinic-report-RPT-CLINIC-2026-010',
    'clinic',
    'report',
    'PLN-2026-001',
    'Clinic Health Service Report',
    'student',
    'RPT-CLINIC-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '7 hour',
    '{"plan_reference":"PLN-2026-001","report_reference":"RPT-CLINIC-2026-010","report_name":"Clinic Health Service Report","report_type":"Clinic Report","source_department":"clinic","target_department":"pmed","owner_name":"Clinic Director","export_format":"PDF","delivery_status":"Received","archive_status":"Active","file_url":"/reports/clinic/health-service-report.pdf","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '8 hour',
    NOW() - INTERVAL '7 hour'
  ),
  (
    'cashier-report-RPT-CASHIER-2026-010',
    'cashier',
    'report',
    'PLN-2026-003',
    'Cashier Financial Report',
    'student',
    'RPT-CASHIER-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '7 hour',
    '{"plan_reference":"PLN-2026-003","report_reference":"RPT-CASHIER-2026-010","report_name":"Cashier Financial Report","report_type":"Cashier Report","source_department":"cashier","target_department":"pmed","owner_name":"Cashier Supervisor","export_format":"Excel","delivery_status":"Received","archive_status":"Active","file_url":"/reports/cashier/financial-report.xlsx","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '8 hour',
    NOW() - INTERVAL '7 hour'
  ),
  (
    'guidance-report-RPT-GUIDANCE-2026-010',
    'guidance',
    'report',
    'PLN-2026-002',
    'Guidance Counseling Report',
    'student',
    'RPT-GUIDANCE-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '6 hour',
    '{"plan_reference":"PLN-2026-002","report_reference":"RPT-GUIDANCE-2026-010","report_name":"Guidance Counseling Report","report_type":"Guidance Report","source_department":"guidance","target_department":"pmed","owner_name":"Guidance Coordinator","export_format":"PDF","delivery_status":"Received","archive_status":"Active","file_url":"/reports/guidance/counseling-report.pdf","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '7 hour',
    NOW() - INTERVAL '6 hour'
  ),
  (
    'prefect-report-RPT-PREFECT-2026-010',
    'prefect',
    'report',
    'PLN-2026-004',
    'Prefect Discipline Statistics',
    'student',
    'RPT-PREFECT-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '6 hour',
    '{"plan_reference":"PLN-2026-004","report_reference":"RPT-PREFECT-2026-010","report_name":"Prefect Discipline Statistics","report_type":"Prefect Report","source_department":"prefect","target_department":"pmed","owner_name":"Prefect Coordinator","export_format":"PDF","delivery_status":"Received","archive_status":"Active","file_url":"/reports/prefect/discipline-statistics.pdf","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '7 hour',
    NOW() - INTERVAL '6 hour'
  ),
  (
    'comlab-report-RPT-COMLAB-2026-010',
    'comlab',
    'report',
    'PLN-2026-001',
    'Computer Laboratory Usage Report',
    'student',
    'RPT-COMLAB-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '5 hour',
    '{"plan_reference":"PLN-2026-001","report_reference":"RPT-COMLAB-2026-010","report_name":"Computer Laboratory Usage Report","report_type":"Computer Laboratory Report","source_department":"comlab","target_department":"pmed","owner_name":"ComLab Supervisor","export_format":"PDF","delivery_status":"Received","archive_status":"Active","file_url":"/reports/comlab/usage-report.pdf","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '6 hour',
    NOW() - INTERVAL '5 hour'
  ),
  (
    'crad-report-RPT-CRAD-2026-010',
    'crad',
    'report',
    'PLN-2026-001',
    'CRAD Program Activity Report',
    'student',
    'RPT-CRAD-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '5 hour',
    '{"plan_reference":"PLN-2026-001","report_reference":"RPT-CRAD-2026-010","report_name":"CRAD Program Activity Report","report_type":"CRAD Report","source_department":"crad","target_department":"pmed","owner_name":"CRAD Officer","export_format":"PDF","delivery_status":"Received","archive_status":"Active","file_url":"/reports/crad/program-activity-report.pdf","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '6 hour',
    NOW() - INTERVAL '5 hour'
  ),
  (
    'hr-report-RPT-HR-2026-010',
    'hr',
    'report',
    'PLN-2026-004',
    'HR Employee Performance Report',
    'teacher',
    'RPT-HR-2026-010',
    0.00,
    'PHP',
    'paid',
    'synced',
    NULL,
    NOW() - INTERVAL '4 hour',
    '{"plan_reference":"PLN-2026-004","report_reference":"RPT-HR-2026-010","report_name":"HR Employee Performance Report","report_type":"HR Report","source_department":"hr","target_department":"pmed","owner_name":"HR Manager","export_format":"Excel","delivery_status":"Received","archive_status":"Active","file_url":"/reports/hr/employee-performance-report.xlsx","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '5 hour',
    NOW() - INTERVAL '4 hour'
  ),
  (
    'pmed-report-RPT-2026-010',
    'pmed',
    'report',
    'PLN-2026-001',
    'School Health Week Final Report',
    'student',
    'RPT-2026-010',
    0.00,
    'PHP',
    'paid',
    'pending',
    NULL,
    NULL,
    '{"plan_reference":"PLN-2026-001","report_reference":"RPT-2026-010","report_name":"School Health Week Final Report","report_type":"Consolidated PMED Report","source_department":"pmed","target_department":"school_admin","owner_name":"Reports Analyst","export_format":"PDF","delivery_status":"Ready to Send","archive_status":"Active","file_url":"/reports/pmed/school-health-week-final.pdf","stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '4 hour',
    NOW() - INTERVAL '3 hour'
  )
ON CONFLICT (event_key) DO UPDATE
SET
  source_module = EXCLUDED.source_module,
  source_entity = EXCLUDED.source_entity,
  source_key = EXCLUDED.source_key,
  patient_name = EXCLUDED.patient_name,
  patient_type = EXCLUDED.patient_type,
  reference_no = EXCLUDED.reference_no,
  amount_due = EXCLUDED.amount_due,
  currency_code = EXCLUDED.currency_code,
  payment_status = EXCLUDED.payment_status,
  sync_status = EXCLUDED.sync_status,
  last_error = EXCLUDED.last_error,
  synced_at = EXCLUDED.synced_at,
  payload = EXCLUDED.payload,
  updated_at = NOW();

INSERT INTO clinic.cashier_payment_links (
  source_module,
  source_key,
  cashier_reference,
  cashier_billing_id,
  invoice_number,
  official_receipt,
  amount_due,
  amount_paid,
  balance_due,
  payment_status,
  latest_payment_method,
  cashier_can_proceed,
  cashier_verified_at,
  paid_at,
  metadata,
  created_at,
  updated_at
)
VALUES
  (
    'pmed',
    'PLN-2026-003',
    'PMED-BILL-2026-003',
    300003,
    'INV-PMED-2026-003',
    NULL,
    52000.00,
    47000.00,
    5000.00,
    'partial',
    'Bank Transfer',
    0,
    NOW() - INTERVAL '1 day',
    NULL,
    '{"plan_reference":"PLN-2026-003","program":"Immunization Drive"}'::jsonb,
    NOW() - INTERVAL '1 day 2 hour',
    NOW() - INTERVAL '1 day'
  ),
  (
    'pmed',
    'PLN-2026-004',
    'MON-2026-004',
    300004,
    'INV-PMED-2026-004',
    NULL,
    180.00,
    140.00,
    40.00,
    'partial',
    'Monitoring Sync',
    0,
    NOW() - INTERVAL '8 hour',
    NULL,
    '{"plan_reference":"PLN-2026-004","indicator_name":"Staff roster prepared"}'::jsonb,
    NOW() - INTERVAL '9 hour',
    NOW() - INTERVAL '8 hour'
  ),
  (
    'pmed',
    'PLN-2026-001',
    'RPT-2026-010',
    300010,
    'INV-PMED-2026-010',
    NULL,
    0.00,
    0.00,
    0.00,
    'paid',
    'Release Workflow',
    1,
    NOW() - INTERVAL '3 hour',
    NOW() - INTERVAL '3 hour',
    '{"report_reference":"RPT-2026-010","delivery_status":"Ready to Send"}'::jsonb,
    NOW() - INTERVAL '4 hour',
    NOW() - INTERVAL '3 hour'
  )
ON CONFLICT (source_module, source_key) DO UPDATE
SET
  cashier_reference = EXCLUDED.cashier_reference,
  cashier_billing_id = EXCLUDED.cashier_billing_id,
  invoice_number = EXCLUDED.invoice_number,
  official_receipt = EXCLUDED.official_receipt,
  amount_due = EXCLUDED.amount_due,
  amount_paid = EXCLUDED.amount_paid,
  balance_due = EXCLUDED.balance_due,
  payment_status = EXCLUDED.payment_status,
  latest_payment_method = EXCLUDED.latest_payment_method,
  cashier_can_proceed = EXCLUDED.cashier_can_proceed,
  cashier_verified_at = EXCLUDED.cashier_verified_at,
  paid_at = EXCLUDED.paid_at,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO clinic.clinic_cashier_sync_logs (
  source_module,
  source_type,
  source_id,
  patient_id,
  student_id,
  cashier_billing_id,
  sync_status,
  retry_count,
  error_message,
  request_payload,
  response_payload,
  extra_payload,
  created_at,
  updated_at
)
VALUES
  (
    'pmed',
    'plan',
    'PLN-2026-003',
    'PAT-1003',
    'PAT-1003',
    300003,
    'synced',
    0,
    NULL,
    '{"reference_no":"PMED-BILL-2026-003","amount_due":52000}'::jsonb,
    '{"status":"accepted"}'::jsonb,
    '{"stage":"monitoring"}'::jsonb,
    NOW() - INTERVAL '1 day 2 hour',
    NOW() - INTERVAL '1 day'
  ),
  (
    'pmed',
    'monitoring',
    'MON-2026-004',
    'PAT-1004',
    'PAT-1004',
    300004,
    'pending',
    1,
    'Waiting for HR roster completion.',
    '{"reference_no":"MON-2026-004","target_value":180,"actual_value":140}'::jsonb,
    '{"status":"queued"}'::jsonb,
    '{"stage":"monitoring"}'::jsonb,
    NOW() - INTERVAL '9 hour',
    NOW() - INTERVAL '8 hour'
  ),
  (
    'pmed',
    'report',
    'RPT-2026-010',
    'PAT-1006',
    'PAT-1006',
    300010,
    'synced',
    0,
    NULL,
    '{"reference_no":"RPT-2026-010","delivery_status":"Ready to Send"}'::jsonb,
    '{"status":"release_ready"}'::jsonb,
    '{"stage":"reporting"}'::jsonb,
    NOW() - INTERVAL '4 hour',
    NOW() - INTERVAL '3 hour'
  )
ON CONFLICT DO NOTHING;

INSERT INTO clinic.clinic_cashier_audit_logs (
  source_module,
  source_id,
  action_name,
  status_after,
  remarks,
  actor_name,
  payload_json,
  created_at
)
VALUES
  (
    'pmed',
    'PLN-2026-003',
    'PAYMENT_SYNC',
    'partial',
    'Cashier acknowledged partial funding release for PMED plan.',
    'Cashier Integration',
    '{"reference_no":"PMED-BILL-2026-003","balance_due":5000}'::jsonb,
    NOW() - INTERVAL '1 day'
  ),
  (
    'pmed',
    'MON-2026-004',
    'MONITORING_ALERT',
    'needs_attention',
    'HR monitoring sync still needs follow-up before evaluation.',
    'Monitoring Officer',
    '{"reference_no":"MON-2026-004","department":"HR"}'::jsonb,
    NOW() - INTERVAL '8 hour'
  ),
  (
    'pmed',
    'RPT-2026-010',
    'REPORT_READY',
    'ready_to_send',
    'Final PMED report package prepared for administration release.',
    'Reports Analyst',
    '{"reference_no":"RPT-2026-010","delivery_status":"Ready to Send"}'::jsonb,
    NOW() - INTERVAL '3 hour'
  )
ON CONFLICT DO NOTHING;

COMMIT;
