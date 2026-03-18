-- Master seed runner for all modules
-- Run with:
-- psql "$DATABASE_URL" -f database/seeds/all_modules_seed.sql

\i database/seeds/admin_accounts_seed.sql
\i database/seeds/doctors_seed.sql
\i database/seeds/appointments_seed.sql
\i database/seeds/patients_database_seed.sql
\i database/seeds/registration_seed.sql
\i database/seeds/walkin_seed.sql
\i database/seeds/checkup_seed.sql
\i database/seeds/laboratory_seed.sql
\i database/seeds/pharmacy_inventory_seed.sql
\i database/seeds/mental_health_seed.sql
\i database/seeds/reports_seed.sql

-- Optional one-time cleanup for old appointment rows:
-- \i database/seeds/appointments_backfill_types.sql
