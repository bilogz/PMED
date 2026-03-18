# Department Integration Map

This clinic system is now prepared for PHP-based integration across the BPM flow:

1. HR
2. PMED
3. Clinic
4. Guidance
5. Prefect
6. Comlab
7. CRAD
8. Cashier
9. Registrar

The clinic side now exposes:

- `GET /api/integrations/departments/map`
- `GET /api/integrations/departments/records`
- `POST /api/integrations/departments/records`

And the PHP integration files are ready in:

- [backend/integrations/departments/hr.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/hr.php)
- [backend/integrations/departments/pmed.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/pmed.php)
- [backend/integrations/departments/clinic.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/clinic.php)
- [backend/integrations/departments/guidance.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/guidance.php)
- [backend/integrations/departments/prefect.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/prefect.php)
- [backend/integrations/departments/comlab.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/comlab.php)
- [backend/integrations/departments/crad.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/crad.php)
- [backend/integrations/departments/cashier.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/cashier.php)
- [backend/integrations/departments/registrar.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/registrar.php)
- [backend/integrations/departments/seed_clearance_flow.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/seed_clearance_flow.php)

## Connection Analysis Per Department

### 1. HR

Purpose:
- verify employment or staff clearance status

Best clinic-side connection:
- `/api/patients`
- `/api/module-activity`
- `/api/integrations/departments/records?department=hr`

Why:
- HR usually does not need deep clinical data
- patient/staff identity, latest status, and activity audit are enough for clearance checkpoints

Recommended PHP behavior:
- read pending HR clearance records
- approve/reject/hold through `POST /api/integrations/departments/records`

### 2. PMED

Purpose:
- initial compliance requirement and pre-evaluation

Best clinic-side connection:
- `/api/registrations`
- `/api/patients`
- `/api/integrations/departments/records?department=pmed`

Why:
- PMED fits best with intake and registration validation
- registration concerns and patient type are already available

Recommended PHP behavior:
- read registration-linked clearances
- mark pending, approved, rejected, or hold

### 3. Clinic

Purpose:
- health clearance validation

Best clinic-side connection:
- `/api/appointments`
- `/api/checkups`
- `/api/patients`
- `/api/integrations/departments/records?department=clinic`

Why:
- clinic validation depends on active appointment and check-up outcomes
- this is the closest department to the main operational health data

Recommended PHP behavior:
- verify patient appointment/check-up status
- issue approval only when the health workflow is completed

### 4. Guidance

Purpose:
- behavioral and records validation

Best clinic-side connection:
- `/api/mental-health`
- `/api/patients`
- `/api/module-activity`
- `/api/integrations/departments/records?department=guidance`

Why:
- guidance may need counseling/behavior-related status, but should still remain separate from direct clinical management

Recommended PHP behavior:
- check if a student has pending guidance issues
- post guidance approval or hold with remarks

### 5. Prefect

Purpose:
- discipline clearance

Best clinic-side connection:
- `/api/module-activity`
- `/api/patients`
- `/api/integrations/departments/records?department=prefect`

Why:
- prefect usually depends more on administrative discipline data than clinical records
- clinic should only hold the clearance status and audit trail

Recommended PHP behavior:
- keep the prefect system as source of truth
- push only the clearance result into the clinic system

### 6. Comlab

Purpose:
- operational or departmental asset clearance

Best clinic-side connection:
- `/api/module-activity`
- `/api/patients`
- `/api/integrations/departments/records?department=comlab`

Why:
- Comlab is operational, not clinical
- the clinic system should store clearance stage and remarks, not own the equipment logic

Recommended PHP behavior:
- comlab system checks asset/accountability state
- PHP bridge submits result back into clinic clearance records

### 7. CRAD

Purpose:
- records and documentation validation

Best clinic-side connection:
- `/api/patients`
- `/api/module-activity`
- `/api/integrations/departments/records?department=crad`

Why:
- CRAD mainly needs identity, record presence, and document status markers

Recommended PHP behavior:
- validate records in the CRAD system
- update clinic clearance stage after completion

### 8. Cashier

Purpose:
- financial settlement and payment processing

Best clinic-side connection:
- `/api/integrations/cashier/status`
- `/api/integrations/cashier/queue`
- `/api/integrations/cashier/sync`
- `/api/integrations/cashier/payment-status`
- `/api/integrations/departments/records?department=cashier`

Why:
- cashier already has dedicated event queue and payment-link support
- this is the most mature external integration in the clinic system right now

Recommended PHP behavior:
- fetch billing queue
- process payment in cashier system
- push payment result back to clinic
- optionally mark cashier department clearance approved after settlement

### 9. Registrar

Purpose:
- final approval and official documentation release

Best clinic-side connection:
- `/api/integrations/departments/records?department=registrar`
- `/api/patients`
- `/api/registrations`

Why:
- registrar is the final gate, so it should read the combined clearance state from all previous departments

Recommended PHP behavior:
- confirm all prior stages are approved
- mark final registrar decision as approved
- use this as the final release checkpoint

## Shared Data Model

All departments can write into the same clinic-side table:

- `department_clearance_records`

Important fields:
- `clearance_reference`
- `patient_id`
- `patient_code`
- `patient_name`
- `patient_type`
- `department_key`
- `department_name`
- `stage_order`
- `status`
- `remarks`
- `approver_name`
- `approver_role`
- `external_reference`

This lets the clinic system act as the BPM status board while each department still keeps its own internal system.

## Recommended Flow

1. Use [seed_clearance_flow.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/departments/seed_clearance_flow.php) to create one pending clearance row for each department.
2. Each department’s PHP app reads only its own file, like `guidance.php` or `registrar.php`.
3. Each department updates only its own decision.
4. Registrar checks that all previous stages are approved before final release.

## Example POST Payload For Any Department

```json
{
  "clearance_reference": "GUIDANCE-PAT-2026-0001",
  "status": "approved",
  "remarks": "No pending behavioral case.",
  "approver_name": "Guidance Officer",
  "approver_role": "Department Head",
  "external_reference": "GUIDE-2026-991"
}
```

## Practical Advice

- Keep each department system as source of truth for its own rules.
- Use the clinic system as the shared BPM checkpoint board.
- Do not force every department to write directly into clinic module tables.
- Use the department PHP files as controlled bridge endpoints.
