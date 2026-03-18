-- Patients Database module seed
-- Run manually if needed:
-- psql "$DATABASE_URL" -f database/seeds/patients_database_seed.sql

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_patient_master_name ON patient_master(patient_name);
CREATE INDEX IF NOT EXISTS idx_patient_master_last_seen ON patient_master(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_master_risk ON patient_master(risk_level);

INSERT INTO patient_master (
  patient_code,
  patient_name,
  identity_key,
  email,
  contact,
  sex,
  date_of_birth,
  age,
  emergency_contact,
  guardian_contact,
  latest_status,
  risk_level,
  appointment_count,
  walkin_count,
  checkup_count,
  mental_count,
  pharmacy_count,
  source_tags,
  last_seen_at
)
VALUES
  ('PAT-1001', 'Maria Santos', 'maria.santos|maria.santos@bcpclinic.test|09171234001', 'maria.santos@bcpclinic.test', '09171234001', 'Female', DATE '2004-08-14', 21, '09189990001', 'Lourdes Santos', 'active', 'low', 2, 0, 1, 0, 0, ARRAY['appointments','checkup'], NOW() - INTERVAL '2 hours'),
  ('PAT-1002', 'John Reyes', 'john.reyes|john.reyes@bcpclinic.test|09171234002', 'john.reyes@bcpclinic.test', '09171234002', 'Male', DATE '2006-01-23', 19, '09189990002', 'Arnel Reyes', 'active', 'medium', 1, 1, 1, 0, 0, ARRAY['appointments','walkin','checkup'], NOW() - INTERVAL '6 hours'),
  ('PAT-1003', 'Anne Dela Cruz', 'anne.delacruz|anne.delacruz@bcpclinic.test|09171234003', 'anne.delacruz@bcpclinic.test', '09171234003', 'Female', DATE '2001-04-04', 24, '09189990003', 'Rosa Dela Cruz', 'active', 'low', 1, 0, 0, 0, 0, ARRAY['appointments'], NOW() - INTERVAL '1 day'),
  ('PAT-1004', 'Paolo Lim', 'paolo.lim|paolo.lim@bcpclinic.test|09171234004', 'paolo.lim@bcpclinic.test', '09171234004', 'Male', DATE '2003-09-12', 22, '09189990004', 'Mila Lim', 'active', 'low', 1, 0, 0, 0, 0, ARRAY['appointments'], NOW() - INTERVAL '8 hours'),
  ('PAT-1005', 'Trisha Garcia', 'trisha.garcia|trisha.garcia@bcpclinic.test|09171234005', 'trisha.garcia@bcpclinic.test', '09171234005', 'Female', DATE '2005-02-19', 20, '09189990005', 'Nora Garcia', 'monitoring', 'medium', 1, 1, 1, 0, 1, ARRAY['appointments','walkin','checkup','pharmacy'], NOW() - INTERVAL '3 hours'),
  ('PAT-1006', 'Kevin Bautista', 'kevin.bautista|kevin.bautista@bcpclinic.test|09171234006', 'kevin.bautista@bcpclinic.test', '09171234006', 'Male', DATE '2002-11-07', 23, '09189990006', 'Liza Bautista', 'active', 'low', 1, 0, 1, 0, 0, ARRAY['appointments','checkup'], NOW() - INTERVAL '5 hours'),
  ('PAT-1007', 'Ella Tan', 'ella.tan|ella.tan@bcpclinic.test|09171234007', 'ella.tan@bcpclinic.test', '09171234007', 'Female', DATE '2007-06-01', 18, '09189990007', 'Grace Tan', 'follow_up', 'high', 1, 0, 0, 2, 0, ARRAY['appointments','mental_health'], NOW() - INTERVAL '12 hours'),
  ('PAT-1008', 'Miguel Chua', 'miguel.chua|miguel.chua@bcpclinic.test|09171234008', 'miguel.chua@bcpclinic.test', '09171234008', 'Male', DATE '1999-03-30', 26, '09189990008', 'Joan Chua', 'active', 'low', 1, 0, 0, 0, 0, ARRAY['appointments'], NOW() - INTERVAL '2 days')
ON CONFLICT (identity_key) DO NOTHING;

COMMIT;
