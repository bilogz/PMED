# MySQL Setup

This project can now run in MySQL-only mode for the app data API. When `DB_CLIENT=mysql`, the Vite middleware uses MySQL and does not load the Neon API middleware.

## 1. Create the schema

```sql
SOURCE database/mysql/appointments_mysql_bootstrap.sql;
```

## 2. Load seed data for all tables

```sql
SOURCE database/mysql/all_tables_seed.sql;
```

This seed file covers all current MySQL-backed tables:

- `doctors`
- `doctor_availability`
- `patient_appointments`
- `patient_registrations`
- `patient_walkins`
- `checkup_visits`
- `laboratory_requests`
- `laboratory_activity_logs`
- `pharmacy_medicines`
- `pharmacy_dispense_requests`
- `pharmacy_stock_movements`
- `pharmacy_activity_logs`
- `mental_health_patients`
- `mental_health_sessions`
- `mental_health_notes`
- `mental_health_activity_logs`
- `patient_master`
- `admin_profiles`
- `admin_activity_logs`
- `admin_sessions`
- `module_activity_logs`
- `cashier_integration_events`
- `cashier_payment_links`

## 3. Update `.env`

```env
DB_CLIENT=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=clinic_system
MYSQL_USER=root
MYSQL_PASSWORD=
CASHIER_INTEGRATION_ENABLED=false
CASHIER_SYSTEM_BASE_URL=http://localhost:5174
CASHIER_SHARED_TOKEN=
CASHIER_SYNC_MODE=queue
CASHIER_SYSTEM_INBOUND_PATH=/api/integrations/clinic-events
```

## 4. Restart the dev server

```powershell
npm run dev
```

## Notes

- Frontend stack stays the same.
- API routes stay the same.
- The default admin seed is `joecelgarcia1@gmail.com / Admin#123`.
- `all_tables_seed.sql` is idempotent, so it can be re-run safely for local refreshes.
- Cashier integration is queue-first by default. Clinic billing events are written into `cashier_integration_events` until you enable outbound delivery.

## Cashier Integration Endpoints

These MySQL-backed endpoints are now available for cashier-system integration:

```text
GET  /api/integrations/cashier/status
GET  /api/integrations/cashier/queue
POST /api/integrations/cashier/sync
POST /api/integrations/cashier/payment-status
```

Typical usage:

1. Keep `CASHIER_SYNC_MODE=queue` while testing.
2. Let the clinic system enqueue appointment, laboratory, and pharmacy billing events.
3. Have the cashier system either:
   - poll `/api/integrations/cashier/queue`, or
   - receive pushed events when `CASHIER_INTEGRATION_ENABLED=true` and `POST /api/integrations/cashier/sync` is called with `action=dispatch_pending`.
4. Send payment updates back to the clinic system through `/api/integrations/cashier/payment-status`.
