-- One-time schema + backfill for student/teacher monitoring across admin modules
-- Run manually in Neon if you want the columns populated immediately:
-- psql "$DATABASE_URL" -f database/seeds/modules_patient_types_backfill.sql

BEGIN;

ALTER TABLE patient_registrations ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE patient_walkins ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE checkup_visits ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE laboratory_requests ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE mental_health_patients ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE mental_health_sessions ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE patient_master ADD COLUMN IF NOT EXISTS patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown';

UPDATE patient_master
SET patient_type = CASE
  WHEN LOWER(COALESCE(patient_type, '')) IN ('student', 'teacher') THEN LOWER(patient_type)
  WHEN COALESCE(age, 0) > 0 AND age <= 23 THEN 'student'
  WHEN COALESCE(age, 0) >= 24 THEN 'teacher'
  ELSE 'unknown'
END
WHERE COALESCE(NULLIF(TRIM(patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE patient_registrations r
SET patient_type = CASE
  WHEN LOWER(COALESCE(r.patient_type, '')) IN ('student', 'teacher') THEN LOWER(r.patient_type)
  WHEN pm.patient_type IN ('student', 'teacher') THEN pm.patient_type
  WHEN COALESCE(r.age, 0) > 0 AND r.age <= 23 THEN 'student'
  WHEN COALESCE(r.age, 0) >= 24 THEN 'teacher'
  ELSE 'unknown'
END
FROM patient_master pm
WHERE LOWER(TRIM(pm.patient_name)) = LOWER(TRIM(r.patient_name))
  AND COALESCE(NULLIF(TRIM(r.patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE patient_registrations
SET patient_type = CASE
  WHEN COALESCE(age, 0) > 0 AND age <= 23 THEN 'student'
  WHEN COALESCE(age, 0) >= 24 THEN 'teacher'
  ELSE 'unknown'
END
WHERE COALESCE(NULLIF(TRIM(patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE patient_walkins w
SET patient_type = CASE
  WHEN LOWER(COALESCE(w.patient_type, '')) IN ('student', 'teacher') THEN LOWER(w.patient_type)
  WHEN pm.patient_type IN ('student', 'teacher') THEN pm.patient_type
  WHEN COALESCE(w.age, 0) > 0 AND w.age <= 23 THEN 'student'
  WHEN COALESCE(w.age, 0) >= 24 THEN 'teacher'
  ELSE 'unknown'
END
FROM patient_master pm
WHERE LOWER(TRIM(pm.patient_name)) = LOWER(TRIM(w.patient_name))
  AND COALESCE(NULLIF(TRIM(w.patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE checkup_visits c
SET patient_type = COALESCE(
  NULLIF(pm.patient_type, 'unknown'),
  CASE
    WHEN c.source = 'appointment_confirmed' THEN 'student'
    ELSE 'unknown'
  END
)
FROM patient_master pm
WHERE LOWER(TRIM(pm.patient_name)) = LOWER(TRIM(c.patient_name))
  AND COALESCE(NULLIF(TRIM(c.patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE laboratory_requests l
SET patient_type = COALESCE(
  NULLIF(pm.patient_type, 'unknown'),
  CASE
    WHEN COALESCE(l.age, 0) > 0 AND l.age <= 23 THEN 'student'
    WHEN COALESCE(l.age, 0) >= 24 THEN 'teacher'
    ELSE 'unknown'
  END
)
FROM patient_master pm
WHERE (
    LOWER(TRIM(pm.patient_name)) = LOWER(TRIM(l.patient_name))
    OR (NULLIF(TRIM(pm.patient_code), '') IS NOT NULL AND pm.patient_code = l.patient_id)
  )
  AND COALESCE(NULLIF(TRIM(l.patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE mental_health_patients p
SET patient_type = COALESCE(
  NULLIF(pm.patient_type, 'unknown'),
  CASE
    WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) <= 23 THEN 'student'
    WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) >= 24 THEN 'teacher'
    ELSE 'unknown'
  END
)
FROM patient_master pm
WHERE (
    LOWER(TRIM(pm.patient_name)) = LOWER(TRIM(p.patient_name))
    OR (NULLIF(TRIM(pm.patient_code), '') IS NOT NULL AND pm.patient_code = p.patient_id)
  )
  AND COALESCE(NULLIF(TRIM(p.patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

UPDATE mental_health_sessions s
SET patient_type = COALESCE(
  NULLIF(p.patient_type, 'unknown'),
  NULLIF(pm.patient_type, 'unknown'),
  'unknown'
)
FROM mental_health_patients p
LEFT JOIN patient_master pm
  ON LOWER(TRIM(pm.patient_name)) = LOWER(TRIM(s.patient_name))
WHERE s.patient_id = p.patient_id
  AND COALESCE(NULLIF(TRIM(s.patient_type), ''), 'unknown') NOT IN ('student', 'teacher');

COMMIT;
