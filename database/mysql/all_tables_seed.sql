USE clinic_system;

START TRANSACTION;

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

INSERT INTO patient_appointments (
  booking_id, patient_id, patient_name, patient_age, patient_email, patient_gender, patient_type,
  guardian_name, phone_number, emergency_contact, insurance_provider, payment_method, actor_role,
  appointment_priority, symptoms_summary, doctor_notes, doctor_name, department_name, visit_type,
  appointment_date, preferred_time, visit_reason, status
)
VALUES
  ('BK-20260313-1001', 'PAT-1001', 'Maria Santos', 21, 'maria.santos@bcpclinic.test', 'Female', 'student', '', '0917-100-1001', '0918-100-1001', 'CarePlus', 'Cash', 'student', 'Routine', 'Fever, sore throat', '', 'Dr. Humour', 'General Medicine', 'Consultation', '2026-03-14', '09:00', 'Medical consultation', 'Confirmed'),
  ('BK-20260313-1002', 'PAT-1002', 'John Reyes', 19, 'john.reyes@bcpclinic.test', 'Male', 'student', '', '0917-100-1002', '0918-100-1002', 'MediShield', 'Insurance', 'student', 'Routine', 'Back pain after PE class', '', 'Dr. Morco', 'Orthopedic', 'Check-Up', '2026-03-15', '10:30', 'Orthopedic follow-up', 'Pending'),
  ('BK-20260313-1003', 'PAT-1003', 'Anne Dela Cruz', 24, 'anne.delacruz@bcpclinic.test', 'Female', 'teacher', '', '0917-100-1003', '0918-100-1003', 'CarePlus', 'Cash', 'teacher', 'Routine', 'Dental discomfort', '', 'Dr. Santos', 'Dental', 'Dental Visit', '2026-03-15', '08:30', 'Dental check', 'Accepted'),
  ('BK-20260313-1004', 'PAT-1004', 'Paolo Lim', 22, 'paolo.lim@bcpclinic.test', 'Male', 'student', '', '0917-100-1004', '0918-100-1004', 'MediShield', 'Cash', 'student', 'Routine', 'Medical clearance request', '', 'Dr. Jenni', 'General Medicine', 'Medical Clearance', '2026-03-15', '13:00', 'Clearance for sports event', 'Confirmed'),
  ('BK-20260313-1005', 'PAT-1005', 'Kevin Bautista', 27, 'kevin.bautista@bcpclinic.test', 'Male', 'teacher', '', '0917-100-1005', '0918-100-1005', 'CarePlus', 'Insurance', 'admin', 'Routine', 'Persistent cough', 'Booked by front desk admin', 'Dr. B. Martinez', 'Check-Up', 'Follow-Up', '2026-03-16', '11:00', 'Follow-up consultation', 'Confirmed'),
  ('BK-20260313-1006', 'PAT-1006', 'Ella Tan', 20, 'ella.tan@bcpclinic.test', 'Female', 'student', '', '0917-100-1006', '0918-100-1006', 'CarePlus', 'Cash', 'student', 'Routine', 'Stress and sleep difficulty', '', 'Dr. S. Villaraza', 'Mental Health', 'Counseling', '2026-03-17', '14:00', 'Mental health counseling', 'Accepted'),
  ('BK-20260313-1007', 'PAT-1007', 'Miguel Chua', 32, 'miguel.chua@bcpclinic.test', 'Male', 'teacher', '', '0917-100-1007', '0918-100-1007', 'MediShield', 'Cash', 'teacher', 'Urgent', 'Headache and elevated blood pressure', '', 'Dr. Humour', 'General Medicine', 'Consultation', '2026-03-18', '09:30', 'General consultation', 'Pending'),
  ('BK-20260313-1008', 'PAT-1008', 'Trisha Garcia', 18, 'trisha.garcia@bcpclinic.test', 'Female', 'student', '', '0917-100-1008', '0918-100-1008', 'CarePlus', 'Cash', 'student', 'Routine', 'Fever and body pain', '', 'Dr. Rivera', 'Pediatrics', 'Check-Up', '2026-03-13', '15:00', 'Pediatric consult', 'Pending')
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  actor_role = VALUES(actor_role),
  status = VALUES(status);

INSERT INTO patient_registrations (
  case_id, patient_name, patient_type, patient_email, age, concern, intake_time, booked_time, status, assigned_to
)
VALUES
  ('REG-20260313-1001', 'Maria Santos', 'student', 'maria.santos@bcpclinic.test', 21, 'Follow-up document submission', '2026-03-13 08:15:00', '2026-03-13 08:35:00', 'Pending', 'Registrar Ana'),
  ('REG-20260313-1002', 'Anne Dela Cruz', 'teacher', 'anne.delacruz@bcpclinic.test', 24, 'Teacher clinic intake', '2026-03-13 09:00:00', '2026-03-13 09:20:00', 'Review', 'Registrar Ben'),
  ('REG-20260313-1003', 'Kevin Bautista', 'teacher', 'kevin.bautista@bcpclinic.test', 27, 'Insurance record update', '2026-03-13 10:10:00', '2026-03-13 10:40:00', 'Active', 'Registrar Ana'),
  ('REG-20260313-1004', 'Ella Tan', 'student', 'ella.tan@bcpclinic.test', 20, 'Mental health onboarding', '2026-03-13 10:30:00', '2026-03-13 10:45:00', 'Pending', 'Registrar Mae')
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  status = VALUES(status),
  assigned_to = VALUES(assigned_to);

INSERT INTO patient_walkins (
  case_id, patient_name, patient_type, age, sex, date_of_birth, contact, address, emergency_contact,
  patient_ref, visit_department, checkin_time, pain_scale, temperature_c, blood_pressure, pulse_bpm,
  weight_kg, chief_complaint, severity, intake_time, assigned_doctor, status
)
VALUES
  ('WLK-20260313-1001', 'Rico Dela Cruz', 'teacher', 35, 'Male', '1991-02-10', '0917-200-1001', 'Balagtas, Bulacan', '0918-200-1001', 'PAT-2001', 'General OPD', '2026-03-13 09:05:00', 5, 37.2, '130/85', 88, 72.50, 'Persistent headache', 'Moderate', '2026-03-13 09:10:00', 'Nurse Triage', 'in_triage'),
  ('WLK-20260313-1002', 'Leo Magno', 'student', 18, 'Male', '2008-01-11', '0917-200-1002', 'Malolos, Bulacan', '0918-200-1002', 'PAT-2002', 'General OPD', '2026-03-13 11:00:00', 3, 36.8, '118/78', 79, 60.00, 'Minor ankle sprain', 'Low', '2026-03-13 11:05:00', 'Nurse Triage', 'waiting'),
  ('WLK-20260313-1003', 'Carlo Diaz', 'teacher', 41, 'Male', '1985-06-03', '0917-200-1003', 'Plaridel, Bulacan', '0918-200-1003', 'PAT-2003', 'ER', '2026-03-13 12:40:00', 7, 37.8, '145/95', 96, 76.20, 'Blood pressure spike', 'Emergency', '2026-03-13 12:42:00', 'ER Team', 'emergency')
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  status = VALUES(status),
  assigned_doctor = VALUES(assigned_doctor);

INSERT INTO checkup_visits (
  visit_id, patient_name, patient_type, assigned_doctor, source, status, chief_complaint, diagnosis,
  clinical_notes, consultation_started_at, lab_requested, lab_result_ready, prescription_created,
  prescription_dispensed, follow_up_date, is_emergency, version
)
VALUES
  ('VISIT-2026-2101', 'Paolo Lim', 'student', 'Dr. Humour', 'walkin_triage_completed', 'in_consultation', 'Chest discomfort, shortness of breath', 'For ECG workup', 'Student athlete under observation.', '2026-03-13 13:05:00', 1, 0, 1, 0, '2026-03-20', 0, 1),
  ('VISIT-2026-2102', 'Rico Dela Cruz', 'teacher', 'Unassigned', 'walkin_triage_completed', 'queue', 'Persistent headache', '', 'Awaiting doctor assignment.', NULL, 0, 0, 0, 0, NULL, 0, 1),
  ('VISIT-2026-2103', 'Juana Reyes', 'student', 'Dr. Humour', 'waiting_for_doctor', 'doctor_assigned', 'Back pain with numbness', '', 'Requested follow-up check.', NULL, 0, 0, 0, 0, NULL, 0, 1),
  ('VISIT-2026-2104', 'Nina Cruz', 'teacher', 'Dr. Jenni', 'appointment_confirmed', 'in_consultation', 'Upper abdominal discomfort', 'Possible gastritis', 'Teacher requested dietary advice.', '2026-03-13 15:20:00', 0, 0, 1, 0, '2026-03-22', 0, 1),
  ('VISIT-2026-2105', 'Carlo Diaz', 'teacher', 'Dr. Morco', 'walkin_triage_completed', 'lab_requested', 'Blood pressure spike', 'Hypertension workup', 'Urgent labs requested.', '2026-03-13 12:55:00', 1, 0, 0, 0, '2026-03-16', 1, 1),
  ('VISIT-2026-2106', 'Ana Perez', 'student', 'Dr. Humour', 'appointment_confirmed', 'pharmacy', 'Fever and persistent cough', 'Upper respiratory tract infection', 'Medication routed to pharmacy.', '2026-03-13 16:10:00', 0, 0, 1, 0, '2026-03-18', 0, 1),
  ('VISIT-2026-2107', 'Leo Magno', 'student', 'Dr. Jenni', 'appointment_confirmed', 'completed', 'Minor ankle sprain', 'Soft tissue injury', 'Cleared with home care instructions.', '2026-03-13 10:30:00', 0, 0, 1, 1, '2026-03-19', 0, 1),
  ('VISIT-2026-2108', 'Maria Santos', 'student', 'Unassigned', 'appointment_confirmed', 'intake', 'Fever with sore throat', '', 'Ready for intake validation.', NULL, 0, 0, 0, 0, NULL, 0, 1)
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  status = VALUES(status),
  assigned_doctor = VALUES(assigned_doctor);

INSERT INTO laboratory_requests (
  request_id, visit_id, patient_id, patient_name, patient_type, age, sex, category, priority, status,
  requested_at, requested_by_doctor, doctor_department, notes, tests, specimen_type, sample_source,
  collection_date_time, clinical_diagnosis, lab_instructions, insurance_reference, billing_reference,
  assigned_lab_staff, sample_collected, sample_collected_at, processing_started_at, result_encoded_at,
  result_reference_range, verified_by, verified_at, rejection_reason, resample_flag, released_at,
  raw_attachment_name, encoded_values
)
VALUES
  (1301, 'VISIT-2026-2105', 'PAT-2003', 'Carlo Diaz', 'teacher', 41, 'Male', 'Blood Test', 'Urgent', 'In Progress', '2026-03-13 13:05:00', 'Dr. Morco', 'Orthopedic', 'Check CBC and lipid profile.', JSON_ARRAY('Complete Blood Count (CBC)', 'Lipid Panel'), 'Whole Blood', 'Blood', '2026-03-13 13:18:00', 'Hypertension workup', 'Fast if repeat is required.', 'INS-1301', 'BILL-LAB-1301', 'Tech Anne', 1, '2026-03-13 13:18:00', '2026-03-13 13:25:00', NULL, '', '', NULL, '', 0, NULL, '', JSON_OBJECT()),
  (1302, 'VISIT-2026-2101', 'PAT-1004', 'Paolo Lim', 'student', 22, 'Male', 'Blood Test', 'Normal', 'Result Ready', '2026-03-13 13:12:00', 'Dr. Humour', 'General Medicine', 'Rule out cardiac markers concern.', JSON_ARRAY('Complete Blood Count (CBC)'), 'Whole Blood', 'Blood', '2026-03-13 13:20:00', 'Chest discomfort', 'Release once verified.', 'INS-1302', 'BILL-LAB-1302', 'Tech Mark', 1, '2026-03-13 13:20:00', '2026-03-13 13:30:00', '2026-03-13 14:10:00', 'Within reference range', 'Tech Anne', '2026-03-13 14:15:00', '', 0, NULL, '', JSON_OBJECT('hemoglobin', '14.2')),
  (1303, 'VISIT-2026-2106', 'PAT-1009', 'Ana Perez', 'student', 19, 'Female', 'Urinalysis', 'Normal', 'Completed', '2026-03-13 16:20:00', 'Dr. Humour', 'General Medicine', 'Routine urinalysis.', JSON_ARRAY('Urinalysis Routine', 'Microscopy'), 'Urine', 'Urine', '2026-03-13 16:30:00', 'Persistent cough', 'Standard processing.', 'INS-1303', 'BILL-LAB-1303', 'Tech Anne', 1, '2026-03-13 16:30:00', '2026-03-13 16:40:00', '2026-03-13 17:10:00', 'Reference range text', 'Tech Anne', '2026-03-13 17:15:00', '', 0, '2026-03-13 17:20:00', '', JSON_OBJECT('rbc', '0-2'))
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  status = VALUES(status),
  assigned_lab_staff = VALUES(assigned_lab_staff);

INSERT INTO laboratory_activity_logs (request_id, action, details, actor, created_at)
SELECT 1301, 'Sample Collected', 'Sample received for urgent blood test.', 'Tech Anne', '2026-03-13 13:19:00'
WHERE NOT EXISTS (
  SELECT 1 FROM laboratory_activity_logs
  WHERE request_id = 1301 AND action = 'Sample Collected' AND created_at = '2026-03-13 13:19:00'
);

INSERT INTO laboratory_activity_logs (request_id, action, details, actor, created_at)
SELECT 1302, 'Result Verified', 'CBC result verified and ready for release.', 'Tech Anne', '2026-03-13 14:15:00'
WHERE NOT EXISTS (
  SELECT 1 FROM laboratory_activity_logs
  WHERE request_id = 1302 AND action = 'Result Verified' AND created_at = '2026-03-13 14:15:00'
);

INSERT INTO pharmacy_medicines (
  medicine_code, sku, medicine_name, brand_name, generic_name, category, medicine_type, dosage_strength,
  unit_of_measure, supplier_name, purchase_cost, selling_price, batch_lot_no, manufacturing_date,
  expiry_date, storage_requirements, reorder_level, low_stock_threshold, stock_capacity, stock_on_hand,
  stock_location, barcode, is_archived
)
VALUES
  ('MED-00036', 'MED-MTF-036', 'Metformin', 'Glucophage', 'Metformin', 'Tablet', 'Diabetes', '500mg', 'tabs', 'Healix Pharma', 2.20, 4.70, 'MTF-11', '2025-02-18', '2026-11-22', 'Room temperature', 40, 35, 150, 48, 'Warehouse A / Shelf A1', '4800010000364', 0),
  ('MED-00043', 'MED-OMP-043', 'Omeprazole', 'Losec', 'Omeprazole', 'Capsule', 'Antacid', '20mg', 'caps', 'MediCore Supply', 4.80, 8.50, 'OMP-52', '2025-01-05', '2026-05-01', 'Store below 25C, dry area', 35, 30, 200, 23, 'Warehouse A / Shelf C2', '4800010000432', 0),
  ('MED-00050', 'MED-PAR-050', 'Paracetamol', 'Biogesic', 'Paracetamol', 'Tablet', 'Analgesic', '500mg', 'tabs', 'MediCore Supply', 1.10, 2.50, 'PAR-21', '2025-03-01', '2027-03-01', 'Room temperature', 50, 40, 500, 220, 'Warehouse B / Shelf B1', '4800010000500', 0)
ON DUPLICATE KEY UPDATE
  medicine_name = VALUES(medicine_name),
  stock_on_hand = VALUES(stock_on_hand),
  selling_price = VALUES(selling_price);

INSERT INTO pharmacy_dispense_requests (
  request_code, medicine_id, patient_name, quantity, notes, prescription_reference, dispense_reason,
  status, requested_at, fulfilled_at, fulfilled_by
)
SELECT 'RX-20260313-1001', m.id, 'Ana Perez', 10, 'Take after meals.', 'PRX-1001', 'Respiratory infection medication', 'Fulfilled', '2026-03-13 16:35:00', '2026-03-13 16:45:00', 'Pharmacist Ana'
FROM pharmacy_medicines m
WHERE m.sku = 'MED-PAR-050'
  AND NOT EXISTS (SELECT 1 FROM pharmacy_dispense_requests WHERE request_code = 'RX-20260313-1001');

INSERT INTO pharmacy_dispense_requests (
  request_code, medicine_id, patient_name, quantity, notes, prescription_reference, dispense_reason,
  status, requested_at, fulfilled_at, fulfilled_by
)
SELECT 'RX-20260313-1002', m.id, 'Paolo Lim', 14, '7-day course.', 'PRX-1002', 'Gastric acid management', 'Pending', '2026-03-13 15:30:00', NULL, NULL
FROM pharmacy_medicines m
WHERE m.sku = 'MED-OMP-043'
  AND NOT EXISTS (SELECT 1 FROM pharmacy_dispense_requests WHERE request_code = 'RX-20260313-1002');

INSERT INTO pharmacy_stock_movements (
  medicine_id, movement_type, quantity_change, quantity_before, quantity_after, reason, batch_lot_no,
  stock_location, actor, created_at
)
SELECT m.id, 'dispense', -10, 230, 220, 'Dispensed to Ana Perez for PRX-1001', 'PAR-21', 'Warehouse B / Shelf B1', 'Pharmacist Ana', '2026-03-13 16:45:00'
FROM pharmacy_medicines m
WHERE m.sku = 'MED-PAR-050'
  AND NOT EXISTS (
    SELECT 1 FROM pharmacy_stock_movements
    WHERE medicine_id = m.id AND movement_type = 'dispense' AND created_at = '2026-03-13 16:45:00'
  );

INSERT INTO pharmacy_activity_logs (action, detail, actor, tone, created_at)
SELECT 'Dispense', 'Prescription RX-20260313-1001 released to Ana Perez.', 'Pharmacist Ana', 'success', '2026-03-13 16:45:00'
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_activity_logs
  WHERE action = 'Dispense' AND created_at = '2026-03-13 16:45:00'
);

INSERT INTO pharmacy_activity_logs (action, detail, actor, tone, created_at)
SELECT 'Low Stock', 'Metformin is approaching low stock threshold.', 'System', 'warning', '2026-03-13 08:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_activity_logs
  WHERE action = 'Low Stock' AND created_at = '2026-03-13 08:00:00'
);

INSERT INTO mental_health_patients (
  patient_id, patient_name, patient_type, date_of_birth, sex, contact_number, guardian_contact
)
VALUES
  ('MHP-7001', 'Ella Tan', 'student', '2006-01-14', 'Female', '0917-300-1001', 'Mila Tan - 0918-300-1001'),
  ('MHP-7002', 'John Reyes', 'teacher', '1989-10-05', 'Male', '0917-300-1002', 'Luz Reyes - 0918-300-1002')
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type);

INSERT INTO mental_health_sessions (
  case_reference, patient_id, patient_name, patient_type, counselor, session_type, status, risk_level,
  diagnosis_condition, treatment_plan, session_goals, session_duration_minutes, session_mode, location_room,
  guardian_contact, emergency_contact, medication_reference, follow_up_frequency, escalation_reason,
  outcome_result, assessment_score, assessment_tool, appointment_at, next_follow_up_at, created_by_role,
  is_draft, archived_at
)
VALUES
  ('MHS-20260313-1001', 'MHP-7001', 'Ella Tan', 'student', 'Dr. S. Villaraza', 'Counseling', 'follow_up', 'medium', 'Stress-related symptoms', 'Weekly counseling and sleep hygiene plan', 'Improve sleep quality and coping skills', 45, 'in_person', 'Room 201', 'Mila Tan - 0918-300-1001', '0918-300-9001', '', 'Weekly', '', 'Stable after session', 12, 'PHQ-9', '2026-03-13 14:00:00', '2026-03-20 14:00:00', 'Admin', 0, NULL),
  ('MHS-20260313-1002', 'MHP-7002', 'John Reyes', 'teacher', 'Dr. Rivera', 'Assessment', 'at_risk', 'high', 'Work-related burnout', 'Structured therapy and monitoring', 'Reduce acute stress symptoms', 60, 'online', 'Virtual Room A', 'Luz Reyes - 0918-300-1002', '0918-300-9002', '', 'Bi-weekly', 'High-risk indicators observed', '', 18, 'GAD-7', '2026-03-13 16:00:00', '2026-03-18 16:00:00', 'Admin', 0, NULL)
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  status = VALUES(status),
  risk_level = VALUES(risk_level);

INSERT INTO mental_health_notes (
  session_id, note_type, note_content, clinical_score, attachment_name, attachment_url, created_by_role, created_at
)
SELECT s.id, 'progress', 'Patient reported improved coping after guided counseling.', 12, '', '', 'Admin', '2026-03-13 15:00:00'
FROM mental_health_sessions s
WHERE s.case_reference = 'MHS-20260313-1001'
  AND NOT EXISTS (
    SELECT 1 FROM mental_health_notes
    WHERE session_id = s.id AND note_type = 'progress' AND created_at = '2026-03-13 15:00:00'
  );

INSERT INTO mental_health_notes (
  session_id, note_type, note_content, clinical_score, attachment_name, attachment_url, created_by_role, created_at
)
SELECT s.id, 'risk', 'Teacher flagged for closer monitoring due to elevated assessment score.', 18, '', '', 'Admin', '2026-03-13 16:30:00'
FROM mental_health_sessions s
WHERE s.case_reference = 'MHS-20260313-1002'
  AND NOT EXISTS (
    SELECT 1 FROM mental_health_notes
    WHERE session_id = s.id AND note_type = 'risk' AND created_at = '2026-03-13 16:30:00'
  );

INSERT INTO mental_health_activity_logs (session_id, action, detail, actor_role, created_at)
SELECT s.id, 'FOLLOW_UP_SET', 'Follow-up session scheduled for Ella Tan.', 'Admin', '2026-03-13 15:05:00'
FROM mental_health_sessions s
WHERE s.case_reference = 'MHS-20260313-1001'
  AND NOT EXISTS (
    SELECT 1 FROM mental_health_activity_logs
    WHERE session_id = s.id AND action = 'FOLLOW_UP_SET' AND created_at = '2026-03-13 15:05:00'
  );

INSERT INTO mental_health_activity_logs (session_id, action, detail, actor_role, created_at)
SELECT s.id, 'RISK_ESCALATED', 'High-risk teacher case escalated for monitoring.', 'Admin', '2026-03-13 16:35:00'
FROM mental_health_sessions s
WHERE s.case_reference = 'MHS-20260313-1002'
  AND NOT EXISTS (
    SELECT 1 FROM mental_health_activity_logs
    WHERE session_id = s.id AND action = 'RISK_ESCALATED' AND created_at = '2026-03-13 16:35:00'
  );

INSERT INTO patient_master (
  patient_code, patient_name, identity_key, patient_type, email, contact, sex, date_of_birth, age,
  emergency_contact, guardian_contact, latest_status, risk_level, appointment_count, walkin_count,
  checkup_count, mental_count, pharmacy_count, source_tags, last_seen_at
)
VALUES
  ('PAT-1001', 'Maria Santos', 'maria.santos@bcpclinic.test', 'student', 'maria.santos@bcpclinic.test', '0917-100-1001', 'Female', '2005-03-14', 21, '0918-100-1001', '', 'active', 'low', 1, 0, 1, 0, 0, JSON_ARRAY('appointments', 'checkup'), '2026-03-14 09:00:00'),
  ('PAT-1003', 'Anne Dela Cruz', 'anne.delacruz@bcpclinic.test', 'teacher', 'anne.delacruz@bcpclinic.test', '0917-100-1003', 'Female', '2002-11-10', 24, '0918-100-1003', '', 'active', 'low', 1, 0, 0, 0, 0, JSON_ARRAY('appointments', 'registration'), '2026-03-15 08:30:00'),
  ('PAT-2003', 'Carlo Diaz', 'carlo.diaz@bcpclinic.test', 'teacher', 'carlo.diaz@bcpclinic.test', '0917-200-1003', 'Male', '1985-06-03', 41, '0918-200-1003', '', 'active', 'medium', 0, 1, 1, 0, 0, JSON_ARRAY('walkin', 'checkup', 'laboratory'), '2026-03-13 13:05:00'),
  ('PAT-7001', 'Ella Tan', 'ella.tan@bcpclinic.test', 'student', 'ella.tan@bcpclinic.test', '0917-100-1006', 'Female', '2006-01-14', 20, '0918-100-1006', 'Mila Tan - 0918-300-1001', 'active', 'medium', 1, 0, 0, 1, 0, JSON_ARRAY('appointments', 'mental_health'), '2026-03-20 14:00:00')
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  latest_status = VALUES(latest_status),
  risk_level = VALUES(risk_level),
  source_tags = VALUES(source_tags);

INSERT INTO admin_profiles (
  username, full_name, email, role, department, access_exemptions, is_super_admin, password_hash, status, phone
)
VALUES
  ('joecelgarcia1@gmail.com', 'BCP Clinic Admin', 'joecelgarcia1@gmail.com', 'admin', 'Administration', JSON_ARRAY('reports', 'inventory'), 1, 'cde0553cf35289cc5af02775cf34251e:47f56b286c1ee7d6f28858fd098f716e83187c5af24f68b71f7f83d0875ce4c1fdd122f5a8e3cd8ab5c54031a01c03d40db2b7bf5ea0fc4bc4a0296a0345c024', 'active', '+63 912 345 6789'),
  ('clinic.supervisor@bcpclinic.test', 'Clinic Supervisor', 'clinic.supervisor@bcpclinic.test', 'supervisor', 'Operations', JSON_ARRAY('appointments'), 0, 'cde0553cf35289cc5af02775cf34251e:47f56b286c1ee7d6f28858fd098f716e83187c5af24f68b71f7f83d0875ce4c1fdd122f5a8e3cd8ab5c54031a01c03d40db2b7bf5ea0fc4bc4a0296a0345c024', 'active', '+63 917 456 7890')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  email = VALUES(email),
  department = VALUES(department),
  status = VALUES(status);

INSERT INTO admin_activity_logs (username, action, raw_action, description, ip_address, created_at)
SELECT 'joecelgarcia1@gmail.com', 'Login', 'LOGIN', 'Admin signed in to the MySQL-backed dashboard.', '127.0.0.1', '2026-03-13 08:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_activity_logs
  WHERE username = 'joecelgarcia1@gmail.com' AND raw_action = 'LOGIN' AND created_at = '2026-03-13 08:00:00'
);

INSERT INTO admin_activity_logs (username, action, raw_action, description, ip_address, created_at)
SELECT 'clinic.supervisor@bcpclinic.test', 'Profile Updated', 'PROFILE_UPDATED', 'Supervisor updated notification preferences.', '127.0.0.1', '2026-03-13 09:10:00'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_activity_logs
  WHERE username = 'clinic.supervisor@bcpclinic.test' AND raw_action = 'PROFILE_UPDATED' AND created_at = '2026-03-13 09:10:00'
);

INSERT INTO admin_sessions (session_token_hash, admin_profile_id, ip_address, user_agent, expires_at, revoked_at, created_at)
SELECT
  'seed-expired-admin-session',
  p.id,
  '127.0.0.1',
  'MySQL seed session',
  '2026-03-13 06:00:00',
  '2026-03-13 06:05:00',
  '2026-03-13 05:00:00'
FROM admin_profiles p
WHERE p.username = 'joecelgarcia1@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM admin_sessions WHERE session_token_hash = 'seed-expired-admin-session');

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'appointments', 'BOOKING_CONFIRMED', 'Appointment BK-20260313-1001 confirmed for Maria Santos.', 'BCP Clinic Admin', 'appointment', 'BK-20260313-1001', JSON_OBJECT('status', 'Confirmed', 'patient_type', 'student'), '2026-03-13 09:15:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'appointments' AND entity_key = 'BK-20260313-1001' AND created_at = '2026-03-13 09:15:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'registration', 'REGISTRATION_CREATED', 'Registration REG-20260313-1002 created for Anne Dela Cruz.', 'Registrar Ben', 'registration', 'REG-20260313-1002', JSON_OBJECT('status', 'Review', 'patient_type', 'teacher'), '2026-03-13 09:20:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'registration' AND entity_key = 'REG-20260313-1002' AND created_at = '2026-03-13 09:20:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'walkin', 'TRIAGE_STARTED', 'Walk-in case WLK-20260313-1001 moved to triage.', 'Nurse Triage', 'walkin', 'WLK-20260313-1001', JSON_OBJECT('severity', 'Moderate', 'patient_type', 'teacher'), '2026-03-13 09:11:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'walkin' AND entity_key = 'WLK-20260313-1001' AND created_at = '2026-03-13 09:11:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'checkup', 'CONSULTATION_STARTED', 'Check-up visit VISIT-2026-2101 started consultation.', 'Dr. Humour', 'checkup', 'VISIT-2026-2101', JSON_OBJECT('status', 'in_consultation', 'patient_type', 'student'), '2026-03-13 13:05:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'checkup' AND entity_key = 'VISIT-2026-2101' AND created_at = '2026-03-13 13:05:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'laboratory', 'RESULT_READY', 'Laboratory request 1302 is ready for doctor review.', 'Tech Anne', 'laboratory', '1302', JSON_OBJECT('status', 'Result Ready', 'patient_type', 'student'), '2026-03-13 14:15:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'laboratory' AND entity_key = '1302' AND created_at = '2026-03-13 14:15:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'pharmacy', 'DISPENSE', 'Prescription RX-20260313-1001 dispensed to Ana Perez.', 'Pharmacist Ana', 'pharmacy', 'RX-20260313-1001', JSON_OBJECT('status', 'Fulfilled', 'patient_type', 'student'), '2026-03-13 16:45:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'pharmacy' AND entity_key = 'RX-20260313-1001' AND created_at = '2026-03-13 16:45:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'mental_health', 'FOLLOW_UP_SET', 'Follow-up session scheduled for Ella Tan.', 'Dr. S. Villaraza', 'mental_session', 'MHS-20260313-1001', JSON_OBJECT('risk_level', 'medium', 'patient_type', 'student'), '2026-03-13 15:05:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'mental_health' AND entity_key = 'MHS-20260313-1001' AND created_at = '2026-03-13 15:05:00'
);

INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata, created_at)
SELECT 'patients', 'PROFILE_SYNCED', 'Patient master profile synchronized for PAT-7001.', 'System', 'patient', 'PAT-7001', JSON_OBJECT('sources', JSON_ARRAY('appointments', 'mental_health'), 'patient_type', 'student'), '2026-03-13 15:10:00'
WHERE NOT EXISTS (
  SELECT 1 FROM module_activity_logs
  WHERE module = 'patients' AND entity_key = 'PAT-7001' AND created_at = '2026-03-13 15:10:00'
);

INSERT INTO cashier_integration_events (
  event_key, source_module, source_entity, source_key, patient_name, patient_type, reference_no,
  amount_due, currency_code, payment_status, sync_status, last_error, synced_at, payload, created_at
)
SELECT
  SHA2('appointments|appointment|BK-20260313-1001|BK-20260313-1001', 256),
  'appointments',
  'appointment',
  'BK-20260313-1001',
  'Maria Santos',
  'student',
  'BK-20260313-1001',
  0.00,
  'PHP',
  'unpaid',
  'pending',
  NULL,
  NULL,
  JSON_OBJECT('department', 'General Medicine', 'doctor', 'Dr. Humour'),
  '2026-03-13 09:15:00'
WHERE NOT EXISTS (
  SELECT 1 FROM cashier_integration_events
  WHERE source_module = 'appointments' AND source_key = 'BK-20260313-1001'
);

INSERT INTO cashier_integration_events (
  event_key, source_module, source_entity, source_key, patient_name, patient_type, reference_no,
  amount_due, currency_code, payment_status, sync_status, last_error, synced_at, payload, created_at
)
SELECT
  SHA2('laboratory|lab_request|1302|BILL-LAB-1302', 256),
  'laboratory',
  'lab_request',
  '1302',
  'Paolo Lim',
  'student',
  'BILL-LAB-1302',
  850.00,
  'PHP',
  'partial',
  'sent',
  NULL,
  '2026-03-13 14:20:00',
  JSON_OBJECT('category', 'Blood Test', 'billing_reference', 'BILL-LAB-1302'),
  '2026-03-13 14:15:00'
WHERE NOT EXISTS (
  SELECT 1 FROM cashier_integration_events
  WHERE source_module = 'laboratory' AND source_key = '1302'
);

INSERT INTO cashier_integration_events (
  event_key, source_module, source_entity, source_key, patient_name, patient_type, reference_no,
  amount_due, currency_code, payment_status, sync_status, last_error, synced_at, payload, created_at
)
SELECT
  SHA2('pharmacy|dispense_request|RX-20260313-1001|PRX-1001', 256),
  'pharmacy',
  'dispense_request',
  'RX-20260313-1001',
  'Ana Perez',
  'student',
  'PRX-1001',
  25.00,
  'PHP',
  'paid',
  'acknowledged',
  NULL,
  '2026-03-13 16:50:00',
  JSON_OBJECT('medicine', 'Paracetamol', 'quantity', 10),
  '2026-03-13 16:45:00'
WHERE NOT EXISTS (
  SELECT 1 FROM cashier_integration_events
  WHERE source_module = 'pharmacy' AND source_key = 'RX-20260313-1001'
);

INSERT INTO cashier_payment_links (
  source_module, source_key, cashier_reference, invoice_number, official_receipt,
  amount_due, amount_paid, balance_due, payment_status, paid_at, metadata
)
VALUES
  ('pharmacy', 'RX-20260313-1001', 'CASHIER-20260313-5001', 'INV-20260313-5001', 'OR-20260313-5001', 25.00, 25.00, 0.00, 'paid', '2026-03-13 16:50:00', JSON_OBJECT('cashier_user', 'Cashier Admin')),
  ('laboratory', '1302', 'CASHIER-20260313-5002', 'INV-20260313-5002', NULL, 850.00, 300.00, 550.00, 'partial', NULL, JSON_OBJECT('cashier_user', 'Cashier Admin'))
ON DUPLICATE KEY UPDATE
  cashier_reference = VALUES(cashier_reference),
  invoice_number = VALUES(invoice_number),
  official_receipt = VALUES(official_receipt),
  amount_due = VALUES(amount_due),
  amount_paid = VALUES(amount_paid),
  balance_due = VALUES(balance_due),
  payment_status = VALUES(payment_status),
  paid_at = VALUES(paid_at),
  metadata = VALUES(metadata);

INSERT INTO department_clearance_records (
  clearance_reference, patient_id, patient_code, patient_name, patient_type,
  department_key, department_name, stage_order, status, remarks, requested_by, metadata
)
VALUES
  ('HR-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'hr', 'HR', 1, 'approved', 'Employment verification cleared.', 'System Seed', JSON_OBJECT('purpose', 'Employment and staff clearance verification')),
  ('PMED-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'pmed', 'PMED', 2, 'approved', 'Initial compliance completed.', 'System Seed', JSON_OBJECT('purpose', 'Pre-medical evaluation compliance')),
  ('CLINIC-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'clinic', 'Clinic', 3, 'pending', 'Awaiting final health clearance validation.', 'System Seed', JSON_OBJECT('purpose', 'Health clearance validation')),
  ('GUIDANCE-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'guidance', 'Guidance', 4, 'pending', '', 'System Seed', JSON_OBJECT('purpose', 'Behavioral and records validation')),
  ('PREFECT-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'prefect', 'Prefect', 5, 'pending', '', 'System Seed', JSON_OBJECT('purpose', 'Discipline clearance')),
  ('COMLAB-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'comlab', 'Comlab', 6, 'pending', '', 'System Seed', JSON_OBJECT('purpose', 'Operational and asset clearance')),
  ('CRAD-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'crad', 'CRAD', 7, 'pending', '', 'System Seed', JSON_OBJECT('purpose', 'Records and documentation validation')),
  ('CASHIER-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'cashier', 'Cashier', 8, 'pending', 'Waiting for financial settlement.', 'System Seed', JSON_OBJECT('purpose', 'Financial settlement')),
  ('REGISTRAR-PAT-1001', 'PAT-1001', 'PAT-1001', 'Maria Santos', 'student', 'registrar', 'Registrar', 9, 'pending', 'Final release is locked until all prior departments approve.', 'System Seed', JSON_OBJECT('purpose', 'Final approval and documentation release'))
ON DUPLICATE KEY UPDATE
  patient_name = VALUES(patient_name),
  patient_type = VALUES(patient_type),
  status = VALUES(status),
  remarks = VALUES(remarks),
  metadata = VALUES(metadata);

COMMIT;
