-- PMED seed with integration context
-- Run after supabase/schema.sql.
-- Includes PMED module data plus the surrounding department flow used by PMED.

BEGIN;

INSERT INTO admin_profiles (
  username, full_name, email, role, department, access_exemptions,
  is_super_admin, password_hash, status, phone
)
VALUES
  (
    'admin@pmed.local',
    'Default PMED Admin',
    'admin@pmed.local',
    'Admin',
    'PMED',
    ARRAY['pmed','reports'],
    1,
    'fb16971bc6e0fd2852916dd599ae11b1:062a7e6c2f54a264e99b3d08b81d9fc9078849139d0e3635a3c6d38561242c75609f6366ae8df520a0110e231b07d3b78e82c180461bc94596f75dbc99dc5a11',
    'active',
    ''
  ),
  (
    'planning.officer@pmed.local',
    'Planning Officer',
    'planning.officer@pmed.local',
    'Planning Officer',
    'PMED',
    ARRAY['pmed'],
    0,
    '4d316a4e9a94c929a12f7d654ea8a205:8b513777a58abff03f5e03cdf5fe2181f5ab66afacfa3a368b117902be0ebe317779e3a62026fc7c0441728563d5f96dfc37d633a1b6634b82c16df6f7419e09',
    'active',
    '+63 912 000 2001'
  )
ON CONFLICT (username) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  access_exemptions = EXCLUDED.access_exemptions,
  is_super_admin = EXCLUDED.is_super_admin,
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status,
  phone = EXCLUDED.phone;

INSERT INTO department_flow_profiles (
  department_key,
  department_name,
  flow_order,
  clearance_stage_order,
  receives,
  sends,
  notes
)
VALUES
  ('hr', 'HR', 1, 1, '[]'::jsonb, '["pmed"]'::jsonb, 'Employment and staff clearance verification.'),
  ('pmed', 'PMED', 2, 2, '["hr"]'::jsonb, '["clinic"]'::jsonb, 'Pre-medical evaluation compliance.'),
  ('clinic', 'Clinic', 3, 3, '["pmed"]'::jsonb, '["guidance","cashier"]'::jsonb, 'Health clearance validation.'),
  ('guidance', 'Guidance', 4, 4, '["clinic"]'::jsonb, '["registrar"]'::jsonb, 'Behavioral and records validation.'),
  ('cashier', 'Cashier', 5, 5, '["clinic"]'::jsonb, '["registrar"]'::jsonb, 'Financial settlement and payment verification.'),
  ('registrar', 'Registrar', 6, 6, '["guidance","cashier"]'::jsonb, '[]'::jsonb, 'Final approval and document release.')
ON CONFLICT (department_key) DO UPDATE
SET
  department_name = EXCLUDED.department_name,
  receives = EXCLUDED.receives,
  sends = EXCLUDED.sends,
  notes = EXCLUDED.notes,
  updated_at = NOW();
INSERT INTO pmed_plans (
  plan_reference, program_title, plan_cycle, lead_department, owner_name,
  schedule_start, schedule_end, budget_amount, target_count, status, approval_status,
  requirements_attached, readiness_percent, next_stage, remarks, created_by, updated_by,
  submitted_at, approved_at
)
VALUES
  ('PLN-2026-001', 'School Health Week', 'AY 2026-2027', 'Clinic / PMED', 'PMED Planning Lead', DATE '2026-04-04', DATE '2026-04-10', 65000, 12, 'Approved', 'Approved', 1, 100, 'data_collection', 'Campus-wide health engagement program.', 'PMED Admin', 'PMED Admin', NOW() - INTERVAL '8 day', NOW() - INTERVAL '7 day'),
  ('PLN-2026-002', 'Mental Health Forum', 'AY 2026-2027', 'Guidance / PMED', 'Guidance Coordinator', DATE '2026-04-15', DATE '2026-04-15', 28000, 8, 'Draft', 'Pending Review', 0, 62, 'planning', 'Forum for awareness and support referrals.', 'PMED Admin', 'Planning Officer', NULL, NULL),
  ('PLN-2026-003', 'Immunization Drive', 'AY 2026-2027', 'Registrar / Clinic', 'Clinic Operations Lead', DATE '2026-04-18', DATE '2026-04-20', 52000, 10, 'Approved', 'Approved', 1, 100, 'monitoring', 'Vaccination activity for enrolled students.', 'PMED Admin', 'PMED Admin', NOW() - INTERVAL '6 day', NOW() - INTERVAL '5 day'),
  ('PLN-2026-004', 'Staff Wellness Check', 'AY 2026-2027', 'HR / Clinic', 'HR Wellness Officer', DATE '2026-04-22', DATE '2026-04-24', 40000, 6, 'For Review', 'Pending Review', 1, 84, 'planning', 'Annual wellness and screening program for employees.', 'PMED Admin', 'Planning Officer', NOW() - INTERVAL '1 day', NULL)
ON CONFLICT (plan_reference) DO UPDATE
SET
  program_title = EXCLUDED.program_title,
  plan_cycle = EXCLUDED.plan_cycle,
  lead_department = EXCLUDED.lead_department,
  owner_name = EXCLUDED.owner_name,
  schedule_start = EXCLUDED.schedule_start,
  schedule_end = EXCLUDED.schedule_end,
  budget_amount = EXCLUDED.budget_amount,
  target_count = EXCLUDED.target_count,
  status = EXCLUDED.status,
  approval_status = EXCLUDED.approval_status,
  requirements_attached = EXCLUDED.requirements_attached,
  readiness_percent = EXCLUDED.readiness_percent,
  next_stage = EXCLUDED.next_stage,
  remarks = EXCLUDED.remarks,
  updated_by = EXCLUDED.updated_by,
  submitted_at = EXCLUDED.submitted_at,
  approved_at = EXCLUDED.approved_at,
  updated_at = NOW();

INSERT INTO pmed_plan_departments (
  plan_reference, department_code, department_name, owner_name, owner_role, assignment_status, submission_required, due_date
)
VALUES
  ('PLN-2026-001', 'registrar', 'Registrar', 'Ms. Dela Cruz', 'Registrar Head', 'Assigned', 1, DATE '2026-04-02'),
  ('PLN-2026-001', 'clinic', 'Clinic', 'Dr. Santos', 'Clinic Director', 'Assigned', 1, DATE '2026-04-02'),
  ('PLN-2026-001', 'hr', 'HR', 'Mr. Ramos', 'HR Manager', 'Assigned', 1, DATE '2026-04-02'),
  ('PLN-2026-002', 'guidance', 'Guidance', 'Ms. Villanueva', 'Guidance Coordinator', 'Assigned', 1, DATE '2026-04-10'),
  ('PLN-2026-002', 'clinic', 'Clinic', 'Dr. Santos', 'Clinic Director', 'Assigned', 1, DATE '2026-04-10'),
  ('PLN-2026-003', 'registrar', 'Registrar', 'Ms. Dela Cruz', 'Registrar Head', 'Assigned', 1, DATE '2026-04-15'),
  ('PLN-2026-003', 'clinic', 'Clinic', 'Dr. Santos', 'Clinic Director', 'Assigned', 1, DATE '2026-04-15'),
  ('PLN-2026-003', 'cashier', 'Cashier', 'Ms. Aquino', 'Cashier Supervisor', 'Assigned', 1, DATE '2026-04-15'),
  ('PLN-2026-004', 'hr', 'HR', 'Mr. Ramos', 'HR Manager', 'Assigned', 1, DATE '2026-04-20'),
  ('PLN-2026-004', 'clinic', 'Clinic', 'Dr. Santos', 'Clinic Director', 'Assigned', 1, DATE '2026-04-20')
ON CONFLICT (plan_reference, department_code) DO UPDATE
SET
  department_name = EXCLUDED.department_name,
  owner_name = EXCLUDED.owner_name,
  owner_role = EXCLUDED.owner_role,
  assignment_status = EXCLUDED.assignment_status,
  submission_required = EXCLUDED.submission_required,
  due_date = EXCLUDED.due_date,
  updated_at = NOW();

INSERT INTO pmed_department_submissions (
  submission_reference, plan_reference, department_code, department_name, feed_type, coverage_period,
  submission_status, validation_status, reviewer_name, source_table, source_endpoint, remarks, submitted_at, validated_at
)
VALUES
  ('SUB-2026-001', 'PLN-2026-001', 'registrar', 'Registrar', 'Enrollment stats and student records', 'Q2 2026', 'Completed', 'Validated', 'PMED Validator', 'patient_registrations', '/api/registrations', 'Enrollment baseline complete.', NOW() - INTERVAL '6 day', NOW() - INTERVAL '6 day'),
  ('SUB-2026-002', 'PLN-2026-001', 'clinic', 'Clinic', 'Health reports', 'Q2 2026', 'Completed', 'Validated', 'PMED Validator', 'patient_appointments', '/api/appointments', 'Clinic feed accepted for execution.', NOW() - INTERVAL '6 day', NOW() - INTERVAL '5 day 20 hour'),
  ('SUB-2026-003', 'PLN-2026-001', 'hr', 'HR', 'Employee wellness list', 'Q2 2026', 'Pending', 'Pending', NULL, 'module_activity_logs', '/api/module-activity', 'Waiting for final HR attachment.', NULL, NULL),
  ('SUB-2026-004', 'PLN-2026-003', 'cashier', 'Cashier', 'Financial support allocation', 'Q2 2026', 'Completed', 'Validated', 'Finance Reviewer', 'cashier_integration_events', '/api/module-activity', 'Budget routing validated.', NOW() - INTERVAL '4 day', NOW() - INTERVAL '4 day'),
  ('SUB-2026-005', 'PLN-2026-004', 'clinic', 'Clinic', 'Staff screening roster', 'Q2 2026', 'Pending', 'Pending', NULL, 'patient_appointments', '/api/appointments', 'Clinic still preparing screening roster.', NOW() - INTERVAL '12 hour', NULL)
ON CONFLICT (submission_reference) DO UPDATE
SET
  plan_reference = EXCLUDED.plan_reference,
  department_code = EXCLUDED.department_code,
  department_name = EXCLUDED.department_name,
  feed_type = EXCLUDED.feed_type,
  coverage_period = EXCLUDED.coverage_period,
  submission_status = EXCLUDED.submission_status,
  validation_status = EXCLUDED.validation_status,
  reviewer_name = EXCLUDED.reviewer_name,
  source_table = EXCLUDED.source_table,
  source_endpoint = EXCLUDED.source_endpoint,
  remarks = EXCLUDED.remarks,
  submitted_at = EXCLUDED.submitted_at,
  validated_at = EXCLUDED.validated_at,
  updated_at = NOW();

INSERT INTO pmed_monitoring_snapshots (
  monitor_reference, plan_reference, department_name, indicator_name,
  target_value, actual_value, variance_value, status, issue_flag, summary, captured_at
)
VALUES
  ('MON-2026-001', 'PLN-2026-001', 'Clinic', 'Student screening completion', 1200, 1180, -20, 'On Track', 0, 'Minor shortfall but still inside operating target.', NOW() - INTERVAL '2 day'),
  ('MON-2026-002', 'PLN-2026-001', 'Registrar', 'Validated enrollment profiles', 1200, 1200, 0, 'On Track', 0, 'Registrar completed the target baseline.', NOW() - INTERVAL '2 day'),
  ('MON-2026-003', 'PLN-2026-003', 'Cashier', 'Funding disbursement released', 52000, 47000, -5000, 'At Risk', 1, 'Final tranche still pending approval.', NOW() - INTERVAL '1 day'),
  ('MON-2026-004', 'PLN-2026-004', 'HR', 'Staff roster prepared', 180, 140, -40, 'Needs Attention', 1, 'Not enough validated employees yet.', NOW() - INTERVAL '8 hour')
ON CONFLICT (monitor_reference) DO UPDATE
SET
  plan_reference = EXCLUDED.plan_reference,
  department_name = EXCLUDED.department_name,
  indicator_name = EXCLUDED.indicator_name,
  target_value = EXCLUDED.target_value,
  actual_value = EXCLUDED.actual_value,
  variance_value = EXCLUDED.variance_value,
  status = EXCLUDED.status,
  issue_flag = EXCLUDED.issue_flag,
  summary = EXCLUDED.summary,
  captured_at = EXCLUDED.captured_at;

INSERT INTO pmed_evaluations (
  evaluation_reference, plan_reference, department_name, score_value,
  target_result, actual_result, decision_status, reviewed_by, remarks, evaluated_at, approved_at
)
VALUES
  ('EVAL-2026-001', 'PLN-2026-001', 'Clinic', 96.50, 'Complete screenings within schedule', '97% completed within target week', 'Approved', 'Quality Assurance Lead', 'Excellent delivery against plan.', NOW() - INTERVAL '12 hour', NOW() - INTERVAL '10 hour'),
  ('EVAL-2026-002', 'PLN-2026-003', 'Registrar', 91.20, 'Immunization masterlist accuracy above 95%', '94% list accuracy after validation', 'For Review', 'Evaluation Officer', 'Small data cleanup still required.', NOW() - INTERVAL '5 hour', NULL),
  ('EVAL-2026-003', 'PLN-2026-004', 'HR', 84.00, 'Employee participation above 90%', '78% participation at current cutoff', 'Draft', NULL, 'Needs additional employee follow-up.', NOW() - INTERVAL '2 hour', NULL)
ON CONFLICT (evaluation_reference) DO UPDATE
SET
  plan_reference = EXCLUDED.plan_reference,
  department_name = EXCLUDED.department_name,
  score_value = EXCLUDED.score_value,
  target_result = EXCLUDED.target_result,
  actual_result = EXCLUDED.actual_result,
  decision_status = EXCLUDED.decision_status,
  reviewed_by = EXCLUDED.reviewed_by,
  remarks = EXCLUDED.remarks,
  evaluated_at = EXCLUDED.evaluated_at,
  approved_at = EXCLUDED.approved_at;

INSERT INTO pmed_reports (
  report_reference, plan_reference, report_name, report_type, owner_name,
  export_format, delivery_status, archive_status, file_url, generated_at, administration_sent_at
)
VALUES
  ('RPT-2026-001', 'PLN-2026-001', 'School Health Week Final Report', 'Final Evaluation', 'Reports Analyst', 'PDF', 'Sent to Administration', 'Active', '/reports/pmed/school-health-week-final.pdf', NOW() - INTERVAL '9 hour', NOW() - INTERVAL '8 hour'),
  ('RPT-2026-002', 'PLN-2026-003', 'Immunization Drive Progress Summary', 'Progress Summary', 'Reports Analyst', 'Excel', 'Ready to Send', 'Active', '/reports/pmed/immunization-progress.xlsx', NOW() - INTERVAL '4 hour', NULL),
  ('RPT-2026-003', 'PLN-2026-004', 'Staff Wellness Check Draft Packet', 'Draft Report', 'PMED Admin', 'PDF', 'Draft', 'Active', NULL, NULL, NULL)
ON CONFLICT (report_reference) DO UPDATE
SET
  plan_reference = EXCLUDED.plan_reference,
  report_name = EXCLUDED.report_name,
  report_type = EXCLUDED.report_type,
  owner_name = EXCLUDED.owner_name,
  export_format = EXCLUDED.export_format,
  delivery_status = EXCLUDED.delivery_status,
  archive_status = EXCLUDED.archive_status,
  file_url = EXCLUDED.file_url,
  generated_at = EXCLUDED.generated_at,
  administration_sent_at = EXCLUDED.administration_sent_at,
  updated_at = NOW();

INSERT INTO pmed_plan_activity_logs (
  plan_reference, action, detail, actor, tone, created_at
)
VALUES
  ('PLN-2026-001', 'Plan Approved', 'School Health Week moved to approved and unlocked collection.', 'PMED Planning Lead', 'success', NOW() - INTERVAL '7 day'),
  ('PLN-2026-002', 'Requirements Missing', 'Mental Health Forum is still missing supporting attachments.', 'Planning Officer', 'warning', NOW() - INTERVAL '3 hour'),
  ('PLN-2026-003', 'Submission Validated', 'Cashier support allocation was validated for immunization rollout.', 'Finance Reviewer', 'info', NOW() - INTERVAL '1 day'),
  ('PLN-2026-004', 'Plan Submitted', 'Staff Wellness Check moved to pending leadership review.', 'HR Wellness Officer', 'info', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

INSERT INTO department_clearance_records (
  clearance_reference, patient_id, patient_code, patient_name, patient_type,
  department_key, department_name, stage_order, status, remarks,
  approver_name, approver_role, external_reference, requested_by, decided_at,
  metadata, created_at, updated_at
)
VALUES
  (
    'CLR-2026-PMED-0001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student',
    'pmed', 'PMED Department', 2, 'pending', 'Awaiting complete inputs from HR and Clinic.',
    NULL, NULL, 'PMED-2026-0001', 'PMED Seed', NULL,
    '{"source":"seed","depends_on":["hr","clinic"]}'::jsonb, NOW() - INTERVAL '2 hour', NOW() - INTERVAL '2 hour'
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

INSERT INTO module_activity_logs (
  module, action, detail, actor, entity_type, entity_key, metadata, created_at
)
VALUES
  ('pmed', 'PLAN_CREATED', 'Created planning record PLN-2026-001 for School Health Week.', 'PMED Admin', 'plan', 'PLN-2026-001', '{"stage":"planning","status":"Approved"}'::jsonb, NOW() - INTERVAL '8 day'),
  ('pmed', 'DEPARTMENT_ASSIGNED', 'Assigned Registrar and Clinic to PLN-2026-001.', 'Operations', 'plan', 'PLN-2026-001', '{"departments":["Registrar","Clinic"]}'::jsonb, NOW() - INTERVAL '8 day 1 hour'),
  ('pmed', 'DATA_REQUESTED', 'Requested HR submission for PLN-2026-001.', 'PMED Validator', 'submission', 'SUB-2026-003', '{"stage":"data_collection","status":"Pending"}'::jsonb, NOW() - INTERVAL '1 day 6 hour'),
  ('pmed', 'ISSUE_FLAGGED', 'Funding release variance flagged for PLN-2026-003.', 'Monitoring Officer', 'monitoring', 'MON-2026-003', '{"stage":"monitoring","status":"At Risk"}'::jsonb, NOW() - INTERVAL '1 day'),
  ('pmed', 'EVALUATION_REVIEW', 'Evaluation EVAL-2026-002 routed for final review.', 'Evaluation Officer', 'evaluation', 'EVAL-2026-002', '{"stage":"evaluation","status":"For Review"}'::jsonb, NOW() - INTERVAL '4 hour'),
  ('pmed', 'REPORT_READY', 'Report RPT-2026-002 generated and ready for administration.', 'Reports Analyst', 'report', 'RPT-2026-002', '{"stage":"reporting","status":"Ready to Send"}'::jsonb, NOW() - INTERVAL '4 hour')
ON CONFLICT DO NOTHING;

COMMIT;
