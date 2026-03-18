CREATE TABLE IF NOT EXISTS clinic_cashier_sync_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_module VARCHAR(80) NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  source_id VARCHAR(120) NOT NULL,
  patient_id VARCHAR(120) NOT NULL,
  student_id VARCHAR(120) NOT NULL,
  cashier_billing_id BIGINT NULL,
  sync_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  request_payload JSON NULL,
  response_payload JSON NULL,
  extra_payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_clinic_cashier_sync_lookup (source_module, source_id),
  KEY idx_clinic_cashier_sync_status (sync_status, created_at)
);

CREATE TABLE IF NOT EXISTS clinic_cashier_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_module VARCHAR(80) NOT NULL,
  source_id VARCHAR(120) NOT NULL,
  action_name VARCHAR(80) NOT NULL,
  status_after VARCHAR(40) NOT NULL,
  remarks TEXT NULL,
  actor_name VARCHAR(150) NOT NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_clinic_cashier_audit_source (source_module, source_id, created_at)
);

ALTER TABLE cashier_payment_links
  ADD COLUMN cashier_billing_id BIGINT NULL AFTER cashier_reference,
  ADD COLUMN latest_payment_method VARCHAR(40) NULL AFTER payment_status,
  ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER latest_payment_method,
  ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed;

ALTER TABLE patient_appointments
  ADD COLUMN cashier_billing_id BIGINT NULL AFTER payment_method,
  ADD COLUMN cashier_billing_no VARCHAR(120) NULL AFTER cashier_billing_id,
  ADD COLUMN cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER cashier_billing_no,
  ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER cashier_payment_status,
  ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed;

ALTER TABLE checkup_visits
  ADD COLUMN cashier_billing_id BIGINT NULL AFTER clinical_notes,
  ADD COLUMN cashier_billing_no VARCHAR(120) NULL AFTER cashier_billing_id,
  ADD COLUMN cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER cashier_billing_no,
  ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER cashier_payment_status,
  ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed;

ALTER TABLE laboratory_requests
  ADD COLUMN cashier_billing_id BIGINT NULL AFTER billing_reference,
  ADD COLUMN cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER cashier_billing_id,
  ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER cashier_payment_status,
  ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed;

ALTER TABLE pharmacy_dispense_requests
  ADD COLUMN cashier_billing_id BIGINT NULL AFTER prescription_reference,
  ADD COLUMN cashier_billing_no VARCHAR(120) NULL AFTER cashier_billing_id,
  ADD COLUMN cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER cashier_billing_no,
  ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER cashier_payment_status,
  ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed;
