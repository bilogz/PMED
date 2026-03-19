-- PMED Supabase / PostgreSQL schema
-- Generated from database/seeds.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS admin_profiles (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(190) NOT NULL UNIQUE,
  full_name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NOT NULL,
  role VARCHAR(80) NOT NULL DEFAULT 'admin',
  department VARCHAR(120) NOT NULL DEFAULT 'Administration',
  access_exemptions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_super_admin SMALLINT NOT NULL DEFAULT 0,
  password_hash TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  phone VARCHAR(80) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP NOT NULL DEFAULT NOW(),
  email_notifications SMALLINT NOT NULL DEFAULT 1,
  in_app_notifications SMALLINT NOT NULL DEFAULT 1,
  dark_mode SMALLINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS patient_appointments (
  id BIGSERIAL PRIMARY KEY,
  booking_id VARCHAR(40) NOT NULL UNIQUE,
  patient_id VARCHAR(60) NULL,
  patient_name VARCHAR(150) NOT NULL,
  patient_age SMALLINT NULL,
  patient_email VARCHAR(190) NULL,
  patient_gender VARCHAR(30) NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  guardian_name VARCHAR(150) NULL,
  phone_number VARCHAR(60) NOT NULL,
  emergency_contact VARCHAR(120) NULL,
  insurance_provider VARCHAR(120) NULL,
  payment_method VARCHAR(40) NULL,
  actor_role VARCHAR(20) NOT NULL DEFAULT 'unknown',
  appointment_priority VARCHAR(20) NOT NULL DEFAULT 'Routine',
  symptoms_summary TEXT NULL,
  doctor_notes TEXT NULL,
  doctor_name VARCHAR(120) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  visit_type VARCHAR(120) NOT NULL,
  appointment_date DATE NOT NULL,
  preferred_time VARCHAR(30) NULL,
  visit_reason TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS checkup_visits (
  id BIGSERIAL PRIMARY KEY,
  visit_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  assigned_doctor VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  source VARCHAR(50) NOT NULL DEFAULT 'appointment_confirmed',
  status VARCHAR(40) NOT NULL DEFAULT 'intake',
  chief_complaint TEXT NULL,
  diagnosis TEXT NULL,
  clinical_notes TEXT NULL,
  consultation_started_at TIMESTAMP NULL,
  lab_requested SMALLINT NOT NULL DEFAULT 0,
  lab_result_ready SMALLINT NOT NULL DEFAULT 0,
  prescription_created SMALLINT NOT NULL DEFAULT 0,
  prescription_dispensed SMALLINT NOT NULL DEFAULT 0,
  follow_up_date DATE NULL,
  is_emergency SMALLINT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS doctors (
  id BIGSERIAL PRIMARY KEY,
  doctor_name VARCHAR(120) NOT NULL UNIQUE,
  department_name VARCHAR(120) NOT NULL,
  specialization VARCHAR(160) NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS doctor_availability (
  id BIGSERIAL PRIMARY KEY,
  doctor_name VARCHAR(120) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_appointments INT NOT NULL DEFAULT 8,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_name, department_name, day_of_week, start_time, end_time)
);
CREATE TABLE IF NOT EXISTS laboratory_requests (
  id BIGSERIAL PRIMARY KEY,
  request_code VARCHAR(40) NOT NULL UNIQUE,
  visit_id VARCHAR(40) NULL,
  patient_id VARCHAR(60) NULL,
  patient_name VARCHAR(150) NOT NULL,
  age SMALLINT NULL CHECK (age BETWEEN 0 AND 120),
  sex VARCHAR(20) NULL,
  requested_by_doctor VARCHAR(120) NOT NULL,
  doctor_department VARCHAR(120) NULL,
  category VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent', 'STAT')),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Result Ready', 'Completed', 'Cancelled')),
  specimen_type VARCHAR(80) NULL,
  sample_source VARCHAR(80) NULL,
  collection_datetime TIMESTAMP NULL,
  clinical_diagnosis TEXT NULL,
  clinical_notes TEXT NULL,
  lab_instructions TEXT NULL,
  insurance_reference VARCHAR(120) NULL,
  billing_reference VARCHAR(120) NULL,
  assigned_lab_staff VARCHAR(120) NULL,
  sample_collected SMALLINT NOT NULL DEFAULT 0,
  sample_collected_at TIMESTAMP NULL,
  processing_started_at TIMESTAMP NULL,
  result_encoded_at TIMESTAMP NULL,
  result_reference_range TEXT NULL,
  verified_by VARCHAR(120) NULL,
  verified_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  resample_flag SMALLINT NOT NULL DEFAULT 0,
  released_at TIMESTAMP NULL,
  raw_attachment_name VARCHAR(255) NULL,
  encoded_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS laboratory_request_tests (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES laboratory_requests(id) ON DELETE CASCADE,
  test_name VARCHAR(160) NOT NULL,
  specimen_required VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, test_name)
);
CREATE TABLE IF NOT EXISTS laboratory_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES laboratory_requests(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  details TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mental_health_patients (
  id BIGSERIAL PRIMARY KEY,
  patient_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  date_of_birth DATE NULL,
  sex VARCHAR(20) NULL,
  contact_number VARCHAR(60) NULL,
  guardian_contact VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mental_health_sessions (
  id BIGSERIAL PRIMARY KEY,
  case_reference VARCHAR(40) NOT NULL UNIQUE,
  patient_id VARCHAR(40) NOT NULL REFERENCES mental_health_patients(patient_id) ON DELETE RESTRICT,
  patient_name VARCHAR(150) NOT NULL,
  counselor VARCHAR(120) NOT NULL,
  session_type VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'create',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  diagnosis_condition TEXT NULL,
  treatment_plan TEXT NULL,
  session_goals TEXT NULL,
  session_duration_minutes INT NOT NULL DEFAULT 45,
  session_mode VARCHAR(20) NOT NULL DEFAULT 'in_person',
  location_room VARCHAR(120) NULL,
  guardian_contact VARCHAR(150) NULL,
  emergency_contact VARCHAR(150) NULL,
  medication_reference VARCHAR(150) NULL,
  follow_up_frequency VARCHAR(60) NULL,
  escalation_reason TEXT NULL,
  outcome_result TEXT NULL,
  assessment_score NUMERIC(6,2) NULL,
  assessment_tool VARCHAR(80) NULL,
  appointment_at TIMESTAMP NOT NULL DEFAULT NOW(),
  next_follow_up_at TIMESTAMP NULL,
  created_by_role VARCHAR(40) NOT NULL DEFAULT 'Counselor',
  is_draft SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMP NULL
);
CREATE TABLE IF NOT EXISTS mental_health_notes (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES mental_health_sessions(id) ON DELETE CASCADE,
  note_type VARCHAR(40) NOT NULL DEFAULT 'Progress',
  note_content TEXT NOT NULL,
  clinical_score NUMERIC(6,2) NULL,
  attachment_name VARCHAR(190) NULL,
  attachment_url TEXT NULL,
  created_by_role VARCHAR(40) NOT NULL DEFAULT 'Counselor',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mental_health_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NULL REFERENCES mental_health_sessions(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  detail TEXT NOT NULL,
  actor_role VARCHAR(40) NOT NULL DEFAULT 'System',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS patient_master (
  id BIGSERIAL PRIMARY KEY,
  patient_code VARCHAR(60) NOT NULL,
  patient_name VARCHAR(150) NOT NULL,
  identity_key VARCHAR(260) NOT NULL UNIQUE,
  email VARCHAR(190) NULL,
  contact VARCHAR(80) NULL,
  sex VARCHAR(30) NULL,
  date_of_birth DATE NULL,
  age SMALLINT NULL,
  emergency_contact VARCHAR(150) NULL,
  guardian_contact VARCHAR(150) NULL,
  latest_status VARCHAR(80) NOT NULL DEFAULT 'active',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  appointment_count INT NOT NULL DEFAULT 0,
  walkin_count INT NOT NULL DEFAULT 0,
  checkup_count INT NOT NULL DEFAULT 0,
  mental_count INT NOT NULL DEFAULT 0,
  pharmacy_count INT NOT NULL DEFAULT 0,
  source_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_seen_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pharmacy_medicines (
  id BIGSERIAL PRIMARY KEY,
  medicine_code VARCHAR(40) NOT NULL UNIQUE,
  sku VARCHAR(60) NOT NULL UNIQUE,
  medicine_name VARCHAR(150) NOT NULL,
  brand_name VARCHAR(150) NOT NULL,
  generic_name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  medicine_type VARCHAR(80) NOT NULL,
  dosage_strength VARCHAR(60) NOT NULL,
  unit_of_measure VARCHAR(30) NOT NULL,
  supplier_name VARCHAR(120) NOT NULL,
  purchase_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  batch_lot_no VARCHAR(80) NOT NULL,
  manufacturing_date DATE NULL,
  expiry_date DATE NOT NULL,
  storage_requirements TEXT NULL,
  reorder_level INT NOT NULL DEFAULT 20,
  low_stock_threshold INT NOT NULL DEFAULT 20,
  stock_capacity INT NOT NULL DEFAULT 100,
  stock_on_hand INT NOT NULL DEFAULT 0,
  stock_location VARCHAR(120) NULL,
  barcode VARCHAR(120) NULL,
  is_archived SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pharmacy_dispense_requests (
  id BIGSERIAL PRIMARY KEY,
  request_code VARCHAR(40) NOT NULL UNIQUE,
  medicine_id BIGINT NOT NULL REFERENCES pharmacy_medicines(id) ON DELETE RESTRICT,
  patient_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  notes TEXT NULL,
  prescription_reference VARCHAR(80) NOT NULL,
  dispense_reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fulfilled', 'Cancelled')),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMP NULL,
  fulfilled_by VARCHAR(120) NULL
);
CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
  id BIGSERIAL PRIMARY KEY,
  medicine_id BIGINT NOT NULL REFERENCES pharmacy_medicines(id) ON DELETE CASCADE,
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('add', 'restock', 'dispense', 'adjust', 'archive', 'alert')),
  quantity_change INT NOT NULL DEFAULT 0,
  quantity_before INT NOT NULL DEFAULT 0,
  quantity_after INT NOT NULL DEFAULT 0,
  reason TEXT NULL,
  batch_lot_no VARCHAR(80) NULL,
  stock_location VARCHAR(120) NULL,
  actor VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pharmacy_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  module VARCHAR(40) NOT NULL DEFAULT 'pharmacy_inventory',
  action VARCHAR(80) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL,
  tone VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (tone IN ('success', 'warning', 'info', 'error')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS patient_registrations (
  id BIGSERIAL PRIMARY KEY,
  case_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  patient_email VARCHAR(190) NULL,
  age SMALLINT NULL,
  concern TEXT NULL,
  intake_time TIMESTAMP NOT NULL DEFAULT NOW(),
  booked_time TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  assigned_to VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS module_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  module VARCHAR(60) NOT NULL,
  action VARCHAR(120) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL DEFAULT 'System',
  entity_type VARCHAR(60) NULL,
  entity_key VARCHAR(120) NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS department_flow_profiles (
  department_key TEXT PRIMARY KEY,
  department_name TEXT NOT NULL,
  flow_order INT NOT NULL UNIQUE,
  clearance_stage_order INT NOT NULL UNIQUE,
  receives JSONB NOT NULL DEFAULT '[]'::jsonb,
  sends JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pmed_plans (
  id BIGSERIAL PRIMARY KEY,
  plan_reference VARCHAR(40) NOT NULL UNIQUE,
  program_title VARCHAR(180) NOT NULL,
  plan_cycle VARCHAR(80) NOT NULL DEFAULT 'SY 2026',
  lead_department VARCHAR(120) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  schedule_start DATE NOT NULL,
  schedule_end DATE NOT NULL,
  budget_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  target_count INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  approval_status VARCHAR(30) NOT NULL DEFAULT 'Pending Review',
  requirements_attached SMALLINT NOT NULL DEFAULT 0,
  readiness_percent INT NOT NULL DEFAULT 0,
  next_stage VARCHAR(40) NOT NULL DEFAULT 'planning',
  remarks TEXT NULL,
  created_by VARCHAR(120) NOT NULL DEFAULT 'PMED Admin',
  updated_by VARCHAR(120) NOT NULL DEFAULT 'PMED Admin',
  submitted_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pmed_plan_departments (
  id BIGSERIAL PRIMARY KEY,
  plan_reference VARCHAR(40) NOT NULL REFERENCES pmed_plans(plan_reference) ON DELETE CASCADE,
  department_code VARCHAR(40) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  owner_role VARCHAR(120) NULL,
  assignment_status VARCHAR(30) NOT NULL DEFAULT 'Assigned',
  submission_required SMALLINT NOT NULL DEFAULT 1,
  due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (plan_reference, department_code)
);
CREATE TABLE IF NOT EXISTS pmed_department_submissions (
  id BIGSERIAL PRIMARY KEY,
  submission_reference VARCHAR(40) NOT NULL UNIQUE,
  plan_reference VARCHAR(40) NOT NULL REFERENCES pmed_plans(plan_reference) ON DELETE CASCADE,
  department_code VARCHAR(40) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  feed_type VARCHAR(120) NOT NULL,
  coverage_period VARCHAR(120) NOT NULL,
  submission_status VARCHAR(30) NOT NULL DEFAULT 'Not Submitted',
  validation_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  reviewer_name VARCHAR(120) NULL,
  source_table VARCHAR(120) NULL,
  source_endpoint VARCHAR(190) NULL,
  remarks TEXT NULL,
  submitted_at TIMESTAMP NULL,
  validated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pmed_monitoring_snapshots (
  id BIGSERIAL PRIMARY KEY,
  monitor_reference VARCHAR(40) NOT NULL UNIQUE,
  plan_reference VARCHAR(40) NOT NULL REFERENCES pmed_plans(plan_reference) ON DELETE CASCADE,
  department_name VARCHAR(120) NOT NULL,
  indicator_name VARCHAR(160) NOT NULL,
  target_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  variance_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'On Track',
  issue_flag SMALLINT NOT NULL DEFAULT 0,
  summary TEXT NULL,
  captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pmed_evaluations (
  id BIGSERIAL PRIMARY KEY,
  evaluation_reference VARCHAR(40) NOT NULL UNIQUE,
  plan_reference VARCHAR(40) NOT NULL REFERENCES pmed_plans(plan_reference) ON DELETE CASCADE,
  department_name VARCHAR(120) NOT NULL,
  score_value NUMERIC(6, 2) NOT NULL DEFAULT 0,
  target_result VARCHAR(160) NOT NULL,
  actual_result VARCHAR(160) NOT NULL,
  decision_status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  reviewed_by VARCHAR(120) NULL,
  remarks TEXT NULL,
  evaluated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pmed_reports (
  id BIGSERIAL PRIMARY KEY,
  report_reference VARCHAR(40) NOT NULL UNIQUE,
  plan_reference VARCHAR(40) NOT NULL REFERENCES pmed_plans(plan_reference) ON DELETE CASCADE,
  report_name VARCHAR(180) NOT NULL,
  report_type VARCHAR(80) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  export_format VARCHAR(40) NOT NULL DEFAULT 'PDF',
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  archive_status VARCHAR(30) NOT NULL DEFAULT 'Active',
  file_url TEXT NULL,
  generated_at TIMESTAMP NULL,
  administration_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pmed_plan_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  plan_reference VARCHAR(40) NOT NULL REFERENCES pmed_plans(plan_reference) ON DELETE CASCADE,
  action VARCHAR(120) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL DEFAULT 'PMED Admin',
  tone VARCHAR(20) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS patient_walkins (
  id BIGSERIAL PRIMARY KEY,
  case_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  age SMALLINT NULL CHECK (age BETWEEN 0 AND 120),
  sex VARCHAR(12) NULL CHECK (sex IN ('Male', 'Female', 'Other')),
  date_of_birth DATE NULL,
  contact VARCHAR(80) NULL,
  address TEXT NULL,
  emergency_contact VARCHAR(120) NULL,
  patient_ref VARCHAR(60) NULL,
  visit_department VARCHAR(80) NULL,
  checkin_time TIMESTAMP NULL,
  pain_scale SMALLINT NULL CHECK (pain_scale BETWEEN 0 AND 10),
  temperature_c NUMERIC(4, 1) NULL CHECK (temperature_c BETWEEN 30 AND 45),
  blood_pressure VARCHAR(20) NULL,
  pulse_bpm SMALLINT NULL CHECK (pulse_bpm BETWEEN 20 AND 240),
  weight_kg NUMERIC(5, 2) NULL CHECK (weight_kg > 0),
  chief_complaint TEXT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'Low' CHECK (severity IN ('Low', 'Moderate', 'Emergency')),
  intake_time TIMESTAMP NOT NULL DEFAULT NOW(),
  assigned_doctor VARCHAR(120) NOT NULL DEFAULT 'Nurse Triage',
  status VARCHAR(30) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(190) NOT NULL,
  action VARCHAR(100) NOT NULL,
  raw_action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(80) NOT NULL DEFAULT '127.0.0.1',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_token_hash VARCHAR(128) NOT NULL UNIQUE,
  admin_profile_id BIGINT NOT NULL REFERENCES admin_profiles (id) ON DELETE CASCADE,
  ip_address VARCHAR(80) NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS department_clearance_records (
  id BIGSERIAL PRIMARY KEY,
  clearance_reference TEXT NOT NULL UNIQUE,
  patient_id TEXT NULL,
  patient_code TEXT NULL,
  patient_name TEXT NOT NULL,
  patient_type TEXT NOT NULL DEFAULT 'unknown',
  department_key TEXT NOT NULL REFERENCES department_flow_profiles (department_key) ON DELETE RESTRICT,
  department_name TEXT NOT NULL,
  stage_order INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  remarks TEXT NULL,
  approver_name TEXT NULL,
  approver_role TEXT NULL,
  external_reference TEXT NULL,
  requested_by TEXT NULL,
  decided_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cashier_integration_events (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  source_module TEXT NOT NULL,
  source_entity TEXT NOT NULL,
  source_key TEXT NOT NULL,
  patient_name TEXT NULL,
  patient_type TEXT NOT NULL DEFAULT 'unknown',
  reference_no TEXT NULL,
  amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'PHP',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT NULL,
  synced_at TIMESTAMPTZ NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cashier_payment_links (
  id BIGSERIAL PRIMARY KEY,
  source_module TEXT NOT NULL,
  source_key TEXT NOT NULL,
  cashier_reference TEXT NULL,
  cashier_billing_id BIGINT NULL,
  invoice_number TEXT NULL,
  official_receipt TEXT NULL,
  amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  latest_payment_method TEXT NULL,
  cashier_can_proceed SMALLINT NOT NULL DEFAULT 0,
  cashier_verified_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_module, source_key)
);
CREATE TABLE IF NOT EXISTS clinic_cashier_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  source_module TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  cashier_billing_id BIGINT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NULL,
  extra_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS clinic_cashier_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  source_module TEXT NOT NULL,
  source_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  status_after TEXT NOT NULL,
  remarks TEXT NULL,
  actor_name TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patient_appointments
  ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE patient_appointments
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20) NOT NULL DEFAULT 'unknown';

ALTER TABLE patient_appointments
  ADD COLUMN IF NOT EXISTS cashier_billing_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS cashier_billing_no VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS cashier_can_proceed SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashier_verified_at TIMESTAMPTZ NULL;
ALTER TABLE checkup_visits
  ADD COLUMN IF NOT EXISTS cashier_billing_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS cashier_billing_no VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS cashier_can_proceed SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashier_verified_at TIMESTAMPTZ NULL;
ALTER TABLE laboratory_requests
  ADD COLUMN IF NOT EXISTS cashier_billing_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS cashier_can_proceed SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashier_verified_at TIMESTAMPTZ NULL;
ALTER TABLE pharmacy_dispense_requests
  ADD COLUMN IF NOT EXISTS cashier_billing_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS cashier_billing_no VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS cashier_can_proceed SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashier_verified_at TIMESTAMPTZ NULL;
ALTER TABLE patient_registrations ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE checkup_visits ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE laboratory_requests ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE mental_health_patients ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE mental_health_sessions ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE patient_master ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS sex VARCHAR(12) NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS address TEXT NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(120) NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS patient_ref VARCHAR(60) NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS visit_department VARCHAR(80) NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS checkin_time TIMESTAMP NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS pain_scale SMALLINT NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS temperature_c NUMERIC(4, 1) NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS blood_pressure VARCHAR(20) NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS pulse_bpm SMALLINT NULL;
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5, 2) NULL;


CREATE INDEX IF NOT EXISTS idx_admin_profiles_role ON admin_profiles(role);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_date ON patient_appointments(appointment_date ASC);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_status ON patient_appointments(status);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_department ON patient_appointments(department_name);
CREATE INDEX IF NOT EXISTS idx_checkup_visits_status ON checkup_visits(status);
CREATE INDEX IF NOT EXISTS idx_checkup_visits_emergency ON checkup_visits(is_emergency);
CREATE INDEX IF NOT EXISTS idx_checkup_visits_updated ON checkup_visits(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_doctors_department ON doctors(department_name, is_active);
CREATE INDEX IF NOT EXISTS idx_lab_requests_status ON laboratory_requests(status);
CREATE INDEX IF NOT EXISTS idx_lab_requests_priority ON laboratory_requests(priority);
CREATE INDEX IF NOT EXISTS idx_lab_requests_category ON laboratory_requests(category);
CREATE INDEX IF NOT EXISTS idx_lab_requests_patient ON laboratory_requests(patient_name);
CREATE INDEX IF NOT EXISTS idx_lab_requests_requested_at ON laboratory_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_activity_request ON laboratory_activity_logs(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mh_sessions_status ON mental_health_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mh_sessions_patient ON mental_health_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_mh_notes_session ON mental_health_notes(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_master_name ON patient_master(patient_name);
CREATE INDEX IF NOT EXISTS idx_patient_master_last_seen ON patient_master(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_master_risk ON patient_master(risk_level);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicines_name ON pharmacy_medicines(medicine_name);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicines_stock ON pharmacy_medicines(stock_on_hand);
CREATE INDEX IF NOT EXISTS idx_pharmacy_medicines_expiry ON pharmacy_medicines(expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharmacy_dispense_status ON pharmacy_dispense_requests(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_movements_med ON pharmacy_stock_movements(medicine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_registrations_status ON patient_registrations(status);
CREATE INDEX IF NOT EXISTS idx_patient_registrations_intake ON patient_registrations(intake_time DESC);
CREATE INDEX IF NOT EXISTS idx_module_activity_recent ON module_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_module_activity_module ON module_activity_logs(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_department_flow_order ON department_flow_profiles(flow_order, clearance_stage_order);
CREATE INDEX IF NOT EXISTS idx_clearance_department ON department_clearance_records (department_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearance_patient ON department_clearance_records (patient_name, patient_code);
CREATE INDEX IF NOT EXISTS idx_pmed_plans_status ON pmed_plans(status, approval_status);
CREATE INDEX IF NOT EXISTS idx_pmed_plans_schedule ON pmed_plans(schedule_start, schedule_end);
CREATE INDEX IF NOT EXISTS idx_pmed_plan_departments_plan ON pmed_plan_departments(plan_reference, department_code);
CREATE INDEX IF NOT EXISTS idx_pmed_submissions_plan ON pmed_department_submissions(plan_reference, submission_status);
CREATE INDEX IF NOT EXISTS idx_pmed_submissions_department ON pmed_department_submissions(department_code, validation_status);
CREATE INDEX IF NOT EXISTS idx_pmed_monitoring_plan ON pmed_monitoring_snapshots(plan_reference, status);
CREATE INDEX IF NOT EXISTS idx_pmed_evaluations_plan ON pmed_evaluations(plan_reference, decision_status);
CREATE INDEX IF NOT EXISTS idx_pmed_reports_plan ON pmed_reports(plan_reference, delivery_status);
CREATE INDEX IF NOT EXISTS idx_pmed_plan_activity_recent ON pmed_plan_activity_logs(plan_reference, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_walkins_status ON patient_walkins(status);
CREATE INDEX IF NOT EXISTS idx_patient_walkins_intake ON patient_walkins(intake_time DESC);
CREATE INDEX IF NOT EXISTS idx_patient_walkins_checkin ON patient_walkins(checkin_time DESC);
CREATE INDEX IF NOT EXISTS idx_patient_walkins_patient_ref ON patient_walkins(patient_ref);
CREATE INDEX IF NOT EXISTS idx_patient_walkins_severity_status ON patient_walkins(severity, status);

DROP TRIGGER IF EXISTS trg_department_flow_profiles_updated_at ON department_flow_profiles;
CREATE TRIGGER trg_department_flow_profiles_updated_at
BEFORE UPDATE ON department_flow_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_department_clearance_records_updated_at ON department_clearance_records;
CREATE TRIGGER trg_department_clearance_records_updated_at
BEFORE UPDATE ON department_clearance_records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_cashier_integration_events_updated_at ON cashier_integration_events;
CREATE TRIGGER trg_cashier_integration_events_updated_at
BEFORE UPDATE ON cashier_integration_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_cashier_payment_links_updated_at ON cashier_payment_links;
CREATE TRIGGER trg_cashier_payment_links_updated_at
BEFORE UPDATE ON cashier_payment_links
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_clinic_cashier_sync_logs_updated_at ON clinic_cashier_sync_logs;
CREATE TRIGGER trg_clinic_cashier_sync_logs_updated_at
BEFORE UPDATE ON clinic_cashier_sync_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
