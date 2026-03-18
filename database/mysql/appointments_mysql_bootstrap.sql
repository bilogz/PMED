CREATE DATABASE IF NOT EXISTS clinic_system;
USE clinic_system;

CREATE TABLE IF NOT EXISTS doctors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_name VARCHAR(120) NOT NULL UNIQUE,
  department_name VARCHAR(120) NOT NULL,
  specialization VARCHAR(160) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_availability (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_name VARCHAR(120) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_appointments INT NOT NULL DEFAULT 8,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_doctor_slot (doctor_name, department_name, day_of_week, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS patient_appointments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
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
  visit_type VARCHAR(120) NULL,
  appointment_date DATE NOT NULL,
  preferred_time VARCHAR(20) NULL,
  visit_reason TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_registrations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  patient_email VARCHAR(190) NULL,
  age SMALLINT NULL,
  concern TEXT NULL,
  intake_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  booked_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  assigned_to VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_walkins (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  age SMALLINT NULL,
  sex VARCHAR(12) NULL,
  date_of_birth DATE NULL,
  contact VARCHAR(60) NULL,
  address TEXT NULL,
  emergency_contact VARCHAR(120) NULL,
  patient_ref VARCHAR(60) NULL,
  visit_department VARCHAR(80) NULL,
  checkin_time DATETIME NULL,
  pain_scale SMALLINT NULL,
  temperature_c DECIMAL(4,1) NULL,
  blood_pressure VARCHAR(20) NULL,
  pulse_bpm SMALLINT NULL,
  weight_kg DECIMAL(5,2) NULL,
  chief_complaint TEXT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'Low',
  intake_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_doctor VARCHAR(120) NOT NULL DEFAULT 'Nurse Triage',
  status VARCHAR(40) NOT NULL DEFAULT 'waiting',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkup_visits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  visit_id VARCHAR(40) NOT NULL UNIQUE,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  assigned_doctor VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
  source VARCHAR(50) NOT NULL DEFAULT 'appointment_confirmed',
  status VARCHAR(40) NOT NULL DEFAULT 'intake',
  chief_complaint TEXT NULL,
  diagnosis TEXT NULL,
  clinical_notes TEXT NULL,
  consultation_started_at DATETIME NULL,
  lab_requested TINYINT(1) NOT NULL DEFAULT 0,
  lab_result_ready TINYINT(1) NOT NULL DEFAULT 0,
  prescription_created TINYINT(1) NOT NULL DEFAULT 0,
  prescription_dispensed TINYINT(1) NOT NULL DEFAULT 0,
  follow_up_date DATE NULL,
  is_emergency TINYINT(1) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laboratory_requests (
  request_id BIGINT PRIMARY KEY,
  visit_id VARCHAR(60) NOT NULL,
  patient_id VARCHAR(60) NOT NULL,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  age SMALLINT NULL,
  sex VARCHAR(20) NULL,
  category VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by_doctor VARCHAR(120) NOT NULL,
  doctor_department VARCHAR(120) NULL,
  notes TEXT NULL,
  tests JSON NULL,
  specimen_type VARCHAR(80) NULL,
  sample_source VARCHAR(80) NULL,
  collection_date_time DATETIME NULL,
  clinical_diagnosis TEXT NULL,
  lab_instructions TEXT NULL,
  insurance_reference VARCHAR(120) NULL,
  billing_reference VARCHAR(120) NULL,
  assigned_lab_staff VARCHAR(120) NULL,
  sample_collected TINYINT(1) NOT NULL DEFAULT 0,
  sample_collected_at DATETIME NULL,
  processing_started_at DATETIME NULL,
  result_encoded_at DATETIME NULL,
  result_reference_range TEXT NULL,
  verified_by VARCHAR(120) NULL,
  verified_at DATETIME NULL,
  rejection_reason TEXT NULL,
  resample_flag TINYINT(1) NOT NULL DEFAULT 0,
  released_at DATETIME NULL,
  raw_attachment_name VARCHAR(255) NULL,
  encoded_values JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laboratory_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT NOT NULL,
  action VARCHAR(120) NOT NULL,
  details TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacy_medicines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  medicine_code VARCHAR(40) NOT NULL,
  sku VARCHAR(60) NOT NULL UNIQUE,
  medicine_name VARCHAR(150) NOT NULL,
  brand_name VARCHAR(150) NULL,
  generic_name VARCHAR(150) NULL,
  category VARCHAR(80) NULL,
  medicine_type VARCHAR(80) NULL,
  dosage_strength VARCHAR(80) NULL,
  unit_of_measure VARCHAR(40) NULL,
  supplier_name VARCHAR(120) NULL,
  purchase_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  batch_lot_no VARCHAR(80) NULL,
  manufacturing_date DATE NULL,
  expiry_date DATE NULL,
  storage_requirements TEXT NULL,
  reorder_level INT NOT NULL DEFAULT 20,
  low_stock_threshold INT NOT NULL DEFAULT 20,
  stock_capacity INT NOT NULL DEFAULT 100,
  stock_on_hand INT NOT NULL DEFAULT 0,
  stock_location VARCHAR(120) NULL,
  barcode VARCHAR(120) NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacy_dispense_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(60) NOT NULL UNIQUE,
  medicine_id BIGINT NOT NULL,
  patient_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  notes TEXT NULL,
  prescription_reference VARCHAR(120) NOT NULL,
  dispense_reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at DATETIME NULL,
  fulfilled_by VARCHAR(120) NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  medicine_id BIGINT NOT NULL,
  movement_type VARCHAR(40) NOT NULL,
  quantity_change INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reason TEXT NOT NULL,
  batch_lot_no VARCHAR(80) NULL,
  stock_location VARCHAR(120) NULL,
  actor VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacy_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(80) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL,
  tone VARCHAR(20) NOT NULL DEFAULT 'info',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mental_health_patients (
  patient_id VARCHAR(40) PRIMARY KEY,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  date_of_birth DATE NULL,
  sex VARCHAR(20) NULL,
  contact_number VARCHAR(60) NULL,
  guardian_contact VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mental_health_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_reference VARCHAR(60) NOT NULL UNIQUE,
  patient_id VARCHAR(40) NOT NULL,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  counselor VARCHAR(120) NOT NULL,
  session_type VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'create',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  diagnosis_condition TEXT NULL,
  treatment_plan TEXT NULL,
  session_goals TEXT NULL,
  session_duration_minutes INT NOT NULL DEFAULT 45,
  session_mode VARCHAR(20) NOT NULL DEFAULT 'in_person',
  location_room VARCHAR(120) NULL,
  guardian_contact VARCHAR(120) NULL,
  emergency_contact VARCHAR(120) NULL,
  medication_reference VARCHAR(120) NULL,
  follow_up_frequency VARCHAR(80) NULL,
  escalation_reason TEXT NULL,
  outcome_result TEXT NULL,
  assessment_score INT NULL,
  assessment_tool VARCHAR(80) NULL,
  appointment_at DATETIME NOT NULL,
  next_follow_up_at DATETIME NULL,
  created_by_role VARCHAR(80) NOT NULL,
  is_draft TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mental_health_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  note_type VARCHAR(80) NOT NULL,
  note_content TEXT NOT NULL,
  clinical_score INT NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_url VARCHAR(255) NULL,
  created_by_role VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mental_health_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NULL,
  action VARCHAR(120) NOT NULL,
  detail TEXT NOT NULL,
  actor_role VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_master (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_code VARCHAR(60) NOT NULL,
  patient_name VARCHAR(150) NOT NULL,
  identity_key VARCHAR(220) NOT NULL UNIQUE,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  email VARCHAR(190) NULL,
  contact VARCHAR(60) NULL,
  sex VARCHAR(20) NULL,
  date_of_birth DATE NULL,
  age SMALLINT NULL,
  emergency_contact VARCHAR(120) NULL,
  guardian_contact VARCHAR(120) NULL,
  latest_status VARCHAR(60) NOT NULL DEFAULT 'active',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  appointment_count INT NOT NULL DEFAULT 0,
  walkin_count INT NOT NULL DEFAULT 0,
  checkup_count INT NOT NULL DEFAULT 0,
  mental_count INT NOT NULL DEFAULT 0,
  pharmacy_count INT NOT NULL DEFAULT 0,
  source_tags JSON NULL,
  last_seen_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(190) NOT NULL UNIQUE,
  full_name VARCHAR(190) NOT NULL,
  email VARCHAR(190) NOT NULL,
  role VARCHAR(80) NOT NULL DEFAULT 'admin',
  department VARCHAR(120) NOT NULL DEFAULT 'Administration',
  access_exemptions JSON NULL,
  is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
  password_hash TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  phone VARCHAR(80) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_notifications TINYINT(1) NOT NULL DEFAULT 1,
  in_app_notifications TINYINT(1) NOT NULL DEFAULT 1,
  dark_mode TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(190) NOT NULL,
  action VARCHAR(100) NOT NULL,
  raw_action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(80) NOT NULL DEFAULT '127.0.0.1',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_token_hash VARCHAR(128) NOT NULL UNIQUE,
  admin_profile_id BIGINT NOT NULL,
  ip_address VARCHAR(80) NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS module_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(60) NOT NULL,
  action VARCHAR(120) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(120) NOT NULL DEFAULT 'System',
  entity_type VARCHAR(60) NULL,
  entity_key VARCHAR(120) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cashier_integration_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_key VARCHAR(128) NOT NULL UNIQUE,
  source_module VARCHAR(60) NOT NULL,
  source_entity VARCHAR(60) NOT NULL,
  source_key VARCHAR(120) NOT NULL,
  patient_name VARCHAR(150) NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  reference_no VARCHAR(120) NULL,
  amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'PHP',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT NULL,
  synced_at DATETIME NULL,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cashier_sync_status (sync_status, created_at),
  KEY idx_cashier_source_lookup (source_module, source_key)
);

CREATE TABLE IF NOT EXISTS cashier_payment_links (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_module VARCHAR(60) NOT NULL,
  source_key VARCHAR(120) NOT NULL,
  cashier_reference VARCHAR(120) NULL,
  cashier_billing_id BIGINT NULL,
  invoice_number VARCHAR(120) NULL,
  official_receipt VARCHAR(120) NULL,
  amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  latest_payment_method VARCHAR(40) NULL,
  paid_at DATETIME NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cashier_payment_link (source_module, source_key),
  KEY idx_cashier_reference (cashier_reference)
);

CREATE TABLE IF NOT EXISTS department_clearance_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  clearance_reference VARCHAR(120) NOT NULL UNIQUE,
  patient_id VARCHAR(120) NULL,
  patient_code VARCHAR(120) NULL,
  patient_name VARCHAR(150) NOT NULL,
  patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
  department_key VARCHAR(40) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  stage_order INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  remarks TEXT NULL,
  approver_name VARCHAR(150) NULL,
  approver_role VARCHAR(120) NULL,
  external_reference VARCHAR(120) NULL,
  requested_by VARCHAR(150) NULL,
  decided_at DATETIME NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_clearance_department (department_key, status, created_at),
  KEY idx_clearance_patient (patient_name, patient_code)
);

INSERT INTO doctors (doctor_name, department_name, specialization, is_active)
VALUES
  ('Dr. Humour', 'General Medicine', 'Internal Medicine', 1),
  ('Dr. Jenni', 'General Medicine', 'General Medicine', 1),
  ('Dr. Rivera', 'Pediatrics', 'Pediatrics', 1),
  ('Dr. Morco', 'Orthopedic', 'Orthopedics', 1),
  ('Dr. Martinez', 'Orthopedic', 'Orthopedics', 1),
  ('Dr. Santos', 'Dental', 'Dentistry', 1),
  ('Dr. Lim', 'Dental', 'Dentistry', 1),
  ('Dr. A. Rivera', 'Laboratory', 'Pathology', 1),
  ('Dr. S. Villaraza', 'Mental Health', 'Psychiatry', 1),
  ('Dr. B. Martinez', 'Check-Up', 'General Practice', 1)
ON DUPLICATE KEY UPDATE
  department_name = VALUES(department_name),
  specialization = VALUES(specialization),
  is_active = VALUES(is_active);

INSERT INTO doctor_availability (doctor_name, department_name, day_of_week, start_time, end_time, max_appointments, is_active)
VALUES
  ('Dr. Humour', 'General Medicine', 1, '08:00:00', '12:00:00', 8, 1),
  ('Dr. Humour', 'General Medicine', 3, '08:00:00', '12:00:00', 8, 1),
  ('Dr. Jenni', 'General Medicine', 2, '13:00:00', '17:00:00', 8, 1),
  ('Dr. Jenni', 'General Medicine', 4, '13:00:00', '17:00:00', 8, 1),
  ('Dr. Rivera', 'Pediatrics', 1, '09:00:00', '13:00:00', 10, 1),
  ('Dr. Rivera', 'Pediatrics', 3, '09:00:00', '13:00:00', 10, 1),
  ('Dr. Morco', 'Orthopedic', 2, '09:00:00', '12:00:00', 6, 1),
  ('Dr. Martinez', 'Orthopedic', 4, '09:00:00', '12:00:00', 6, 1),
  ('Dr. Santos', 'Dental', 1, '10:00:00', '15:00:00', 10, 1),
  ('Dr. Lim', 'Dental', 3, '10:00:00', '15:00:00', 10, 1),
  ('Dr. A. Rivera', 'Laboratory', 2, '08:00:00', '11:00:00', 5, 1),
  ('Dr. S. Villaraza', 'Mental Health', 5, '13:00:00', '18:00:00', 8, 1),
  ('Dr. B. Martinez', 'Check-Up', 2, '08:00:00', '12:00:00', 8, 1),
  ('Dr. B. Martinez', 'Check-Up', 5, '08:00:00', '12:00:00', 8, 1)
ON DUPLICATE KEY UPDATE
  max_appointments = VALUES(max_appointments),
  is_active = VALUES(is_active);

INSERT INTO checkup_visits (
  visit_id, patient_name, patient_type, assigned_doctor, source, status, chief_complaint,
  diagnosis, clinical_notes, lab_requested, lab_result_ready, prescription_created, prescription_dispensed
)
VALUES
  ('VISIT-2026-2001', 'Maria Santos', 'student', 'Dr. Humour', 'appointment_confirmed', 'queue', 'Fever with sore throat', NULL, NULL, 0, 0, 0, 0),
  ('VISIT-2026-2002', 'Rico Dela Cruz', 'teacher', 'Dr. Humour', 'walkin_triage_completed', 'doctor_assigned', 'Persistent headache', NULL, NULL, 0, 0, 0, 0),
  ('VISIT-2026-2003', 'Juana Reyes', 'student', 'Dr. Jenni', 'waiting_for_doctor', 'in_consultation', 'Back pain', 'Muscle strain', 'Pain localized at lower back, no neuro deficits.', 1, 0, 0, 0)
ON DUPLICATE KEY UPDATE
  visit_id = VALUES(visit_id);

INSERT INTO pharmacy_medicines (
  medicine_code, sku, medicine_name, brand_name, generic_name, category, medicine_type, dosage_strength,
  unit_of_measure, supplier_name, purchase_cost, selling_price, batch_lot_no, manufacturing_date, expiry_date,
  storage_requirements, reorder_level, low_stock_threshold, stock_capacity, stock_on_hand, stock_location, barcode
)
VALUES
  ('MED-00043', 'MED-OMP-043', 'Omeprazole', 'Losec', 'Omeprazole', 'Capsule', 'Antacid', '20mg', 'caps', 'MediCore Supply', 4.80, 8.50, 'OMP-52', '2025-01-05', '2026-05-01', 'Store below 25C, dry area', 35, 30, 200, 23, 'Warehouse A / Shelf C2', '4800010000432'),
  ('MED-00036', 'MED-MTF-036', 'Metformin', 'Glucophage', 'Metformin', 'Tablet', 'Diabetes', '500mg', 'tabs', 'Healix Pharma', 2.20, 4.70, 'MTF-11', '2025-02-18', '2026-11-22', 'Room temperature', 40, 35, 150, 0, 'Warehouse A / Shelf A1', '4800010000364')
ON DUPLICATE KEY UPDATE
  medicine_name = VALUES(medicine_name);

INSERT INTO mental_health_patients (patient_id, patient_name, patient_type, date_of_birth, sex, contact_number, guardian_contact)
VALUES
  ('PAT-3401', 'Maria Santos', 'student', '1990-03-14', 'Female', '0917-123-4411', NULL),
  ('PAT-3119', 'John Reyes', 'teacher', '1989-10-05', 'Male', '0918-223-8842', 'Luz Reyes - 0917-992-1113')
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name);

INSERT INTO admin_profiles (
  username, full_name, email, role, department, access_exemptions, is_super_admin, password_hash, status, phone
)
VALUES
  (
    'joecelgarcia1@gmail.com',
    'BCP Clinic Admin',
    'joecelgarcia1@gmail.com',
    'admin',
    'Administration',
    JSON_ARRAY(),
    1,
    'cde0553cf35289cc5af02775cf34251e:47f56b286c1ee7d6f28858fd098f716e83187c5af24f68b71f7f83d0875ce4c1fdd122f5a8e3cd8ab5c54031a01c03d40db2b7bf5ea0fc4bc4a0296a0345c024',
    'active',
    '+63 912 345 6789'
  )
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  email = VALUES(email);
