# PMED System Local Setup Guide

This project is a PMED-focused admin UI with a Supabase/PostgreSQL-backed API served via the Vite dev server (see `server/supabaseApi.ts`).

## Requirements

- Node.js + npm
- A Supabase project (PostgreSQL)

## 1) Install dependencies

```powershell
npm install
```

## 2) Create the database

In the Supabase SQL editor, run:

- `supabase/schema.sql`
- `supabase/seed.sql`

## 3) Configure environment

Copy `.env.example` → `.env`, then set either:

- `DATABASE_URL=postgresql://...` (recommended), or
- `SUPABASE_DB_HOST` + `SUPABASE_DB_PASS` (+ other `SUPABASE_DB_*` fields)

## 4) Run the app

```powershell
npm run dev
```

Open:

- `http://localhost:5173/admin/login`

## Default admin account

- `admin@pmed.local` / `Admin#123`

## Demo account summary

- Admin: `admin@pmed.local` / `Admin#123`

## What to test

- PMED dashboard: `http://localhost:5173/pmed/dashboard`
- PMED modules:
  - `/pmed/planning`
  - `/pmed/data-collection`
  - `/pmed/monitoring`
  - `/pmed/evaluation`
  - `/pmed/reporting`
