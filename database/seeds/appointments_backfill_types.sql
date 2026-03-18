-- One-time backfill for existing appointment rows
-- Adds / normalizes patient_type for old records that predate the new field.
-- Run manually if needed:
-- psql "$DATABASE_URL" -f database/seeds/appointments_backfill_types.sql

BEGIN;

ALTER TABLE patient_appointments
  ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';

ALTER TABLE patient_appointments
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(20) NOT NULL DEFAULT 'unknown';

UPDATE patient_appointments
SET patient_type = CASE
  WHEN LOWER(COALESCE(actor_role, '')) IN ('student', 'teacher') THEN LOWER(actor_role)
  WHEN LOWER(COALESCE(patient_type, '')) IN ('student', 'teacher') THEN LOWER(patient_type)
  WHEN CONCAT_WS(' ',
    COALESCE(patient_name, ''),
    COALESCE(patient_email, ''),
    COALESCE(visit_reason, ''),
    COALESCE(visit_type, '')
  ) ~* '(teacher|faculty|professor|prof\.|instructor|staff)'
    THEN 'teacher'
  WHEN CONCAT_WS(' ',
    COALESCE(patient_name, ''),
    COALESCE(patient_email, ''),
    COALESCE(visit_reason, ''),
    COALESCE(visit_type, '')
  ) ~* '(student|learner|pupil)'
    THEN 'student'
  WHEN COALESCE(patient_age, 0) > 0 AND patient_age <= 23 THEN 'student'
  WHEN COALESCE(patient_age, 0) >= 24 THEN 'teacher'
  ELSE 'student'
END
WHERE COALESCE(NULLIF(TRIM(patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

COMMIT;
