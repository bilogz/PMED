-- Appointments module seed
-- Run manually if needed:
-- psql "$DATABASE_URL" -f database/seeds/appointments_seed.sql

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_patient_appointments_date ON patient_appointments(appointment_date ASC);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_status ON patient_appointments(status);
CREATE INDEX IF NOT EXISTS idx_patient_appointments_department ON patient_appointments(department_name);

INSERT INTO patient_appointments (
  booking_id,
  patient_id,
  patient_name,
  patient_age,
  patient_email,
  patient_gender,
  patient_type,
  guardian_name,
  phone_number,
  emergency_contact,
  insurance_provider,
  payment_method,
  actor_role,
  appointment_priority,
  symptoms_summary,
  doctor_notes,
  doctor_name,
  department_name,
  visit_type,
  appointment_date,
  preferred_time,
  visit_reason,
  status
)
VALUES
  ('BK-20260313-1001', 'PAT-1001', 'Maria Santos', 21, 'maria.santos@bcpclinic.test', 'Female', 'student', 'Lourdes Santos', '09171234001', '09189990001', 'CarePlus', 'Insurance', 'student', 'Routine', 'Recurring migraine episodes', 'Prioritize neuro screening if headache persists.', 'Dr. Humour', 'General Medicine', 'Consultation', CURRENT_DATE + INTERVAL '1 day', '09:00', 'Migraine follow-up', 'Confirmed'),
  ('BK-20260313-1002', 'PAT-1002', 'John Reyes', 19, 'john.reyes@bcpclinic.test', 'Male', 'student', 'Arnel Reyes', '09171234002', '09189990002', 'MediShield', 'Cash', 'student', 'Urgent', 'Sprained ankle from sports activity', 'Assess swelling and mobility before imaging referral.', 'Dr. Morco', 'Orthopedic', 'Check-Up', CURRENT_DATE + INTERVAL '1 day', '10:30', 'Sports injury consultation', 'Pending'),
  ('BK-20260313-1003', 'PAT-1003', 'Anne Dela Cruz', 24, 'anne.delacruz@bcpclinic.test', 'Female', 'teacher', 'Rosa Dela Cruz', '09171234003', '09189990003', 'CarePlus', 'Insurance', 'teacher', 'Routine', 'Routine dental cleaning and gum pain', 'Check for early gingivitis signs.', 'Dr. Santos', 'Dental', 'Dental Visit', CURRENT_DATE + INTERVAL '2 day', '08:30', 'Dental cleaning', 'Accepted'),
  ('BK-20260313-1004', 'PAT-1004', 'Paolo Lim', 22, 'paolo.lim@bcpclinic.test', 'Male', 'teacher', 'Mila Lim', '09171234004', '09189990004', NULL, 'Cash', 'teacher', 'Routine', 'Request for annual medical certificate', 'Prepare clearance if vitals are normal.', 'Dr. Jenni', 'General Medicine', 'Medical Clearance', CURRENT_DATE + INTERVAL '2 day', '13:00', 'Annual physical exam', 'Confirmed'),
  ('BK-20260313-1005', 'PAT-1005', 'Trisha Garcia', 20, 'trisha.garcia@bcpclinic.test', 'Female', 'student', 'Nora Garcia', '09171234005', '09189990005', 'MediShield', 'Insurance', 'student', 'Urgent', 'Persistent cough with mild fever', 'Consider CBC if fever continues.', 'Dr. Rivera', 'Pediatrics', 'Check-Up', CURRENT_DATE, '15:00', 'Respiratory assessment', 'Pending'),
  ('BK-20260313-1006', 'PAT-1006', 'Kevin Bautista', 23, 'kevin.bautista@bcpclinic.test', 'Male', 'student', 'Liza Bautista', '09171234006', '09189990006', NULL, 'Cash', 'student', 'Routine', 'Follow-up for laboratory results', 'Review CBC and urinalysis outcome.', 'Dr. B. Martinez', 'Check-Up', 'Follow-Up', CURRENT_DATE + INTERVAL '3 day', '11:00', 'Lab result review', 'Confirmed'),
  ('BK-20260313-1007', 'PAT-1007', 'Ella Tan', 18, 'ella.tan@bcpclinic.test', 'Female', 'teacher', 'Grace Tan', '09171234007', '09189990007', 'CarePlus', 'Insurance', 'teacher', 'Routine', 'Counseling intake appointment', 'Coordinate with mental health desk for availability.', 'Dr. S. Villaraza', 'Mental Health', 'Counseling', CURRENT_DATE + INTERVAL '4 day', '14:00', 'Initial counseling', 'Accepted'),
  ('BK-20260313-1008', 'PAT-1008', 'Miguel Chua', 26, 'miguel.chua@bcpclinic.test', 'Male', 'teacher', 'Joan Chua', '09171234008', '09189990008', 'CarePlus', 'Cash', 'teacher', 'Routine', 'Skin irritation and allergy concern', 'Check allergy triggers and prescribe if needed.', 'Dr. Humour', 'General Medicine', 'Consultation', CURRENT_DATE + INTERVAL '5 day', '09:30', 'Allergy consult', 'Pending')
ON CONFLICT (booking_id) DO NOTHING;

COMMIT;
