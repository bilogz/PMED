# Cashier System Clone-to-Test Guide

This guide covers the full local setup flow for the `cashier-system` project on Windows, from cloning the repository to testing the cashier workflow and optional clinic integration.

## What you need

- `Git`
- `Node.js` and `npm`
- `XAMPP`
- `MySQL` from XAMPP
- PowerShell or VS Code terminal

## 1. Clone the repository

```powershell
git clone <your-repository-url> cashier-system
cd cashier-system
```

If you already have the project folder, just open:

```

## 2. Install dependencies

```powershell
npm install
```

## 3. Start XAMPP

Open the `XAMPP Control Panel` and start:

- `MySQL`
- `Apache`

`Apache` is optional for the Vue + Node app itself, but useful for:

- `phpMyAdmin`
- PHP integration endpoints
- clinic callback testing

## 4. Create the database

This project uses:

- Database: `cashier_system`
- Host: `127.0.0.1`
- Port: `3306`
- User: `root`
- Password: blank by default in XAMPP

Use one of these setup methods.

### Option A: Import the ready SQL file

```powershell
"C:\xampp\mysql\bin\mysql.exe" -u root < database\mysql\cashier_system_mysql.sql
```

If your MySQL root user has a password:

```powershell
"C:\xampp\mysql\bin\mysql.exe" -u root -p < database\mysql\cashier_system_mysql.sql
```

### Option B: Seed an empty database with the Node script

First create an empty `cashier_system` database in phpMyAdmin, then run:

```powershell
npm run db:seed
```

Use only one approach.

## 5. Configure the backend

The project root should contain `.env.server`.

Recommended contents:

```env
API_PORT=3001
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5174

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=cashier_system

CLINIC_CALLBACK_URL=http://localhost/clinicsystem/backend/integrations/receive_cashier_payment_callback.php
CLINIC_CALLBACK_TOKEN=replace-with-a-strong-shared-token
CLINIC_CALLBACK_TIMEOUT_MS=8000

SEED_ADMIN_USERNAME=admin@cashier.local
SEED_ADMIN_PASSWORD=admin123
```

You can also copy from:

```text
server/.env.example
```

## 6. Configure the frontend

The root `.env` should contain:

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## 7. Verify MySQL first

Before running the app, check the connection:

```powershell
npm run db:ping
```

Expected result:

```text
MySQL connection successful.
Database: cashier_system
```

If this fails, fix MySQL first before starting the frontend.

## 8. Start the cashier backend

Open a terminal in the project root:

```powershell
npm run server:dev
```

Keep this terminal open.

Test the backend:

```text
http://localhost:3001/api/health
```

Do not use just `http://localhost:3001` because the API health route is under `/api/health`.

## 9. Start the cashier frontend

Open a second terminal:

```powershell
npm run dev
```

Open the URL printed by Vite, usually:

- `http://localhost:5174`
- or `http://localhost:5173`

## 10. Default accounts

Use these demo credentials:

- Admin: `admin@cashier.local` / `admin123`
- Faculty or Staff: `staff@cashier.local` / `staff123`
- Compliance: `compliance@cashier.local` / `compliance123`
- Student Portal: `2024-0001` / `student123`

## 11. What to test first

After login, test the main BPA flow:

1. `Student Portal & Billing`
2. `Pay Bills`
3. `Payment Processing & Gateway`
4. `Compliance & Documentation`
5. `Completed Transactions`

You can use the seeded demo records to test:

- verify billing
- approve payment
- installment setup
- authorize transaction
- confirm paid
- generate receipt
- verify proof
- complete documentation
- reconcile/archive

## 12. Optional clinic integration setup

If you are also using the separate `clinicsystem` project:

### Clinic project expected path

```text
C:\Users\Bilog\Projects\clinicsystem
```

### Important note

The clinic project must point to a real cashier backend URL. If the clinic `.env` contains:

```env
CASHIER_SYSTEM_BASE_URL=http://127.0.0.1:8091
```

and nothing is running there, the clinic app will show:

```text
connect ETIMEDOUT
```

Use the cashier backend instead:

```env
CASHIER_SYSTEM_BASE_URL=http://localhost:3001
```

or disable clinic integration temporarily:

```env
CASHIER_INTEGRATION_ENABLED=false
```

Then restart the clinic dev server.

## 13. Testing clinic-linked records in cashier

The seeded cashier demo includes clinic-origin mock records.

To see them:

1. run `npm run db:seed`
2. run `npm run server:dev`
3. hard refresh the cashier frontend
4. open:

```text
/modules/billing-verification
```

Clinic-linked records are labeled in the billing queue and should move through the workflow just like normal cashier records.

## 14. Typical daily startup order

Use this order every time:

1. Start `MySQL` in XAMPP
2. Run:

open project

3. In another terminal:

```powershell
cd C:\Users\Bilog\Projects\cashier-system
npm run dev
```

4. Open the frontend URL

## 15. Common errors

### `ERR_CONNECTION_REFUSED` on `localhost:3001`

The backend is not running.

Run:

```powershell
npm run server:dev
```

Then test:

```text
http://localhost:3001/api/health
```

### `connect ETIMEDOUT`

Usually means:

- the clinic app is trying to call a cashier URL that is not running
- or the backend URL in `.env` is wrong

Check the clinic `.env` and make sure `CASHIER_SYSTEM_BASE_URL` points to a live cashier backend.

### `Failed to fetch`

Usually means:

- backend not running
- wrong `VITE_API_BASE_URL`
- CORS mismatch

Make sure:

- cashier backend is running on `3001`
- frontend uses `VITE_API_BASE_URL=http://localhost:3001/api`

### Login page loads but cannot sign in

Check:

1. `npm run db:ping`
2. `http://localhost:3001/api/health`
3. `npm run server:dev`
4. that the database was imported or seeded

## 16. Useful commands

```powershell
npm install
npm run db:ping
npm run db:seed
npm run server:dev
npm run dev
npm run build
```

## 17. Related docs

- [local-development-setup.md](/C:/Users/Bilog/Projects/cashier-system/docs/local-development-setup.md)
- [xampp-mysql-backend-setup.md](/C:/Users/Bilog/Projects/cashier-system/docs/xampp-mysql-backend-setup.md)
- [php-integration-setup.md](/C:/Users/Bilog/Projects/cashier-system/docs/php-integration-setup.md)
