# PHP Integration Kit

This project now includes a small PHP bridge kit for departments that use XAMPP / PHP and need to integrate with the clinic system without touching the Vue frontend.

Files:

- [config.example.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/config.example.php)
- [bootstrap.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/bootstrap.php)
- [ClinicSystemClient.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/ClinicSystemClient.php)
- [pull_clinic_cashier_queue.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/pull_clinic_cashier_queue.php)
- [push_payment_status.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/push_payment_status.php)
- [receive_clinic_event.php](/c:/Users/Bilog/Projects/clinicsystem/backend/integrations/receive_clinic_event.php)

## What Each File Does

- `ClinicSystemClient.php`
  A reusable PHP client for calling the clinic system API.

- `pull_clinic_cashier_queue.php`
  Example PHP endpoint/script that reads pending cashier sync items from the clinic system.

- `push_payment_status.php`
  Example PHP endpoint/script that sends payment results back to the clinic system.

- `receive_clinic_event.php`
  Example inbound webhook receiver if the clinic system pushes events to another PHP system.

## Setup

1. Copy `backend/integrations/config.example.php` to `backend/integrations/config.php`.

2. Edit the values:

```php
<?php

return [
    'clinic_system' => [
        'base_url' => 'http://localhost:5173',
        'shared_token' => 'your-shared-secret',
        'timeout_seconds' => 20,
    ],
    'cashier_system' => [
        'module_name' => 'cashier',
        'log_file' => __DIR__ . '/logs/cashier-integration.log',
    ],
];
```

3. In the clinic system `.env`, use the same token:

```env
CASHIER_SHARED_TOKEN=your-shared-secret
```

4. Restart the clinic dev server:

```powershell
npm run dev
```

## Common Integration Flows

### Flow A: PHP cashier system pulls clinic billing queue

Request from PHP:

```php
$client = new ClinicSystemClient($config['clinic_system']);
$queue = $client->get('/api/integrations/cashier/queue', [
    'sync_status' => 'pending',
    'page' => 1,
    'per_page' => 20,
]);
```

Use this when the PHP system wants to decide when to import clinic billing events.

### Flow B: PHP cashier system sends payment result to clinic

POST JSON to `push_payment_status.php`:

```json
{
  "source_module": "laboratory",
  "source_key": "1302",
  "cashier_reference": "CASHIER-20260313-5002",
  "invoice_number": "INV-20260313-5002",
  "official_receipt": "OR-20260313-5002",
  "amount_due": 850,
  "amount_paid": 850,
  "balance_due": 0,
  "payment_status": "paid",
  "paid_at": "2026-03-13 16:30:00",
  "actor": "Cashier Admin",
  "metadata": {
    "counter": "Window 2"
  }
}
```

### Flow C: Clinic pushes events into a PHP system

Point the clinic integration target to the PHP app and expose:

- `receive_clinic_event.php`

That receiver validates `X-Shared-Token` and logs the payload so the other department can process it safely.

## Suggested XAMPP Location

If another department uses XAMPP, these files can live under something like:

```text
htdocs/clinic-bridge/
```

Then they can call:

- `http://localhost/clinic-bridge/pull_clinic_cashier_queue.php`
- `http://localhost/clinic-bridge/push_payment_status.php`
- `http://localhost/clinic-bridge/receive_clinic_event.php`

## Recommended Next Step

For a real department integration, create one PHP file per department:

- `cashier_sync.php`
- `registrar_sync.php`
- `sis_sync.php`

Each one can reuse `ClinicSystemClient.php` and keep its own mapping rules cleanly separated.
