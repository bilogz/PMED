# Clinic to Cashier API Integration

This integration lets the Clinic System create billable service records in the Cashier System through PHP internal API calls.

## Flow

1. Clinic creates a billable service record.
2. Clinic validates the amount and shared payload.
3. Clinic sends `POST /api/cashier/billing/create` to the Cashier PHP bridge.
4. Cashier validates, creates the billing, and returns:
   - `billing_id`
   - `billing_no`
   - `status`
5. Clinic stores the returned `cashier_billing_id` and `cashier_reference` in:
   - `cashier_payment_links`
   - the originating module record when supported
6. Before a booking, laboratory release, pharmacy release, or consultation proceeds, Clinic verifies payment through:
   `GET /api/cashier/billing/verify-proceed/{billing_id}`
7. Clinic can still poll `GET /api/cashier/billing/status/{billing_id}` for full payment updates.
8. Cashier can also push a live callback to the clinic payment callback endpoint whenever payment, receipt, or documentation status changes.

## Shared payload format

```json
{
  "student_id": "2024-0001",
  "patient_id": "PAT-1001",
  "source_type": "laboratory_fee",
  "source_module": "laboratory",
  "source_id": "LAB-REQ-1302",
  "fee_type": "Laboratory Fee",
  "description": "CBC and Urinalysis",
  "amount": 850,
  "due_date": "2026-03-20",
  "created_by": "Clinic Admin",
  "student_name": "Maria Santos",
  "program": "BS Information Technology | 2nd Year",
  "semester": "2nd Semester 2025-2026",
  "academic_year": "2025-2026"
}
```

## Endpoint mapping

- `POST /api/cashier/billing/create`
- `GET /api/cashier/billing/verify-proceed/{billing_id}`
- `GET /api/cashier/billing/status/{billing_id}`
- `POST /backend/integrations/sync_billable_to_cashier.php`
- `GET /backend/integrations/poll_cashier_billing_status.php?billing_id={id}&source_module={module}&source_id={source_id}`
- `POST /backend/integrations/receive_cashier_payment_callback.php`

## Request example using PHP cURL

```php
<?php
$payload = [
    'student_id' => '2024-0001',
    'patient_id' => 'PAT-1001',
    'source_type' => 'laboratory_fee',
    'source_module' => 'laboratory',
    'source_id' => 'LAB-REQ-1302',
    'fee_type' => 'Laboratory Fee',
    'description' => 'CBC and Urinalysis',
    'amount' => 850,
    'due_date' => '2026-03-20',
    'created_by' => 'Clinic Admin',
];

$ch = curl_init('http://localhost/cashier-integration/api/cashier/billing/create');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'X-Integration-Token: replace-with-a-strong-shared-token',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);

$response = curl_exec($ch);
curl_close($ch);
echo $response;
```

## Response example

```json
{
  "ok": true,
  "message": "Cashier billing created successfully.",
  "data": {
    "billing_id": 25,
    "billing_no": "CLN-20260314-REQ1302",
    "status": "created"
  }
}
```

## Billing status response example

```json
{
  "ok": true,
  "message": "Billing status fetched successfully.",
  "data": {
    "billing_id": 25,
    "billing_no": "CLN-20260314-REQ1302",
    "status": "unpaid",
    "workflow_stage": "pay_bills",
    "amount": 850,
    "paid_amount": 300,
    "remaining_balance": 550,
    "payment_status": "partial",
    "latest_payment_reference": "PAY-2026-0025",
    "latest_payment_method": "Cash",
    "receipt_number": null,
    "receipt_status": null
  }
}
```

## Proceed verification response example

Use this before allowing the clinic booking or service to continue:

```json
{
  "ok": true,
  "message": "Payment verified. Clinic booking may proceed.",
  "data": {
    "billing_id": 25,
    "billing_no": "CLN-20260314-REQ1302",
    "status": "paid",
    "workflow_stage": "completed",
    "payment_status": "paid",
    "latest_payment_method": "HMA",
    "latest_payment_reference": "PAY-2026-0025",
    "remaining_balance": 0,
    "verification": {
      "can_proceed": true,
      "verification_status": "verified",
      "label": "Payment verified via HMA.",
      "blocking_reason": null
    }
  }
}
```

If payment is not yet complete, Clinic should keep the booking or release on hold.

## Callback payload example

```json
{
  "billing_id": 25,
  "billing_no": "CLN-20260314-REQ1302",
  "source_module": "laboratory",
  "source_type": "laboratory_fee",
  "source_id": "1302",
  "patient_id": "PAT-1001",
  "student_id": "2024-0001",
  "status": "partial",
  "workflow_stage": "pay_bills",
  "amount": 850,
  "paid_amount": 300,
  "remaining_balance": 550,
  "payment_status": "partial",
  "latest_payment_reference": "PAY-2026-0025",
  "latest_payment_method": "Cash",
  "receipt_number": null,
  "receipt_status": null,
  "actor": "Cashier System"
}
```

## Live callback setup

Set these values in the cashier project so the Node cashier runtime can push updates directly back to clinic:

```text
CLINIC_CALLBACK_URL=http://localhost/clinicsystem/backend/integrations/receive_cashier_payment_callback.php
CLINIC_CALLBACK_TOKEN=replace-with-a-strong-shared-token
```

Use the same shared token in the clinic integration config:

```text
backend/integrations/config.php
```

Live callback flow:

1. Clinic creates a billable appointment, laboratory, pharmacy, or consultation charge.
2. Clinic syncs that charge to cashier and stores `cashier_billing_id`.
3. Cashier payment actions update the real cashier workflow.
4. Cashier automatically posts status updates back to:
   `backend/integrations/receive_cashier_payment_callback.php`
5. Clinic updates its local source tables and `cashier_payment_links`.

## Added clinic integration files

- `backend/integrations/CashierApiClient.php`
- `backend/integrations/CashierBillingIntegrationService.php`
- `backend/integrations/sync_billable_to_cashier.php`
- `backend/integrations/poll_cashier_billing_status.php`
- `backend/integrations/receive_cashier_payment_callback.php`
- `database/mysql/clinic_cashier_integration.sql`

Recommended clinic-side usage:

- sync the billable record to cashier
- store `cashier_billing_id`
- call `verifyClinicBookingPayment(...)` before proceeding with the clinic service
- only continue when `verification.can_proceed === true`

## Authentication

Use a shared token in both systems:

- clinic config: `backend/integrations/config.php`
- cashier PHP bridge: env var `CASHIER_INTEGRATION_TOKEN`

The cashier bridge accepts:

- `X-Integration-Token`
- or `Authorization: Bearer <token>`

## Retry behavior

The clinic service retries failed sync attempts up to `max_retries`.

Each attempt is written to:

- `clinic_cashier_sync_logs`
- `clinic_cashier_audit_logs`

## Supported clinic billable sources

- laboratory fees
- pharmacy charges
- consultation/service fees
- medical certificate fees
- other clinic-related charges

## Local clinic tables stamped by the integration

- `patient_appointments`
- `checkup_visits`
- `laboratory_requests`
- `pharmacy_dispense_requests`
- `cashier_payment_links`
