-- Reports module seed
-- This module derives most KPIs from other module tables.
-- Run manually if needed:
-- psql "$DATABASE_URL" -f database/seeds/reports_seed.sql

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_module_activity_recent ON module_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_module_activity_module ON module_activity_logs(module, created_at DESC);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
VALUES
  ('appointments', 'BOOKING_CONFIRMED', 'Appointment BK-20260313-1001 confirmed for Maria Santos.', 'BCP Clinic Admin', 'appointment', 'BK-20260313-1001', '{"status":"Confirmed"}'::jsonb, NOW() - INTERVAL '3 hours'),
  ('registration', 'REGISTRATION_CREATED', 'Registration REG-20260213-1001 created for Maria Santos.', 'Registrar Ana', 'registration', 'REG-20260213-1001', '{"status":"Pending"}'::jsonb, NOW() - INTERVAL '5 hours'),
  ('walkin', 'TRIAGE_STARTED', 'Walk-in case WLK-2026-1002 moved to triage.', 'Nurse Triage', 'walkin', 'WLK-2026-1002', '{"severity":"Moderate"}'::jsonb, NOW() - INTERVAL '7 hours'),
  ('checkup', 'CONSULTATION_STARTED', 'Check-up visit VISIT-2026-1003 started consultation.', 'Dr. B. Martinez', 'checkup', 'VISIT-2026-1003', '{"status":"in_consultation"}'::jsonb, NOW() - INTERVAL '9 hours'),
  ('laboratory', 'RESULT_RELEASED', 'Laboratory request LAB-2026-1196 released to requesting doctor.', 'Lab Staff', 'laboratory', 'LAB-2026-1196', '{"status":"Completed"}'::jsonb, NOW() - INTERVAL '1 day'),
  ('pharmacy', 'DISPENSE', 'Prescription RX-2026-3012 dispensed to Trisha Garcia.', 'Pharmacist Lea', 'pharmacy', 'RX-2026-3012', '{"status":"Fulfilled"}'::jsonb, NOW() - INTERVAL '1 day 2 hours'),
  ('mental_health', 'FOLLOW_UP_SET', 'Follow-up session scheduled for Ella Tan.', 'Counselor Mae', 'mental_session', 'MHS-2026-2401', '{"risk_level":"high"}'::jsonb, NOW() - INTERVAL '2 days'),
  ('patients', 'PROFILE_SYNCED', 'Patient master profile synchronized for PAT-1005.', 'System', 'patient', 'PAT-1005', '{"sources":["appointments","walkin","checkup","pharmacy"]}'::jsonb, NOW() - INTERVAL '2 days 4 hours')
ON CONFLICT DO NOTHING;

COMMIT;
