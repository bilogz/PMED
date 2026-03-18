import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';
import type { Plugin } from 'vite';

type MysqlApiOptions = {
  dbClient?: string;
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
  cashierEnabled?: string;
  cashierBaseUrl?: string;
  cashierSharedToken?: string;
  cashierSyncMode?: string;
  cashierInboundPath?: string;
};

type JsonRecord = Record<string, unknown>;

let mysqlPool: Pool | null = null;

function parseCookieHeader(rawCookie: string | undefined): Record<string, string> {
  if (!rawCookie) return {};
  return rawCookie.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

function writeJson(res: any, statusCode: number, payload: JsonRecord): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: any): Promise<JsonRecord> {
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer | string) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(typeof parsed === 'object' && parsed !== null ? parsed : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function toSafeText(value: unknown): string {
  return String(value ?? '').trim();
}

function toSafeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toSafeMoney(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100) / 100;
}

function normalizeDoctorFilter(value: string): string {
  return value.replace(/^doctor:\s*/i, '').trim();
}

function normalizePatientType(value: unknown): 'student' | 'teacher' | 'unknown' {
  const normalized = toSafeText(value).toLowerCase();
  if (normalized === 'student' || normalized === 'teacher') return normalized;
  return 'unknown';
}

function inferPatientType(input: {
  patientType?: unknown;
  actorRole?: unknown;
  patientName?: unknown;
  patientEmail?: unknown;
  concern?: unknown;
  visitType?: unknown;
  patientId?: unknown;
  age?: unknown;
}): 'student' | 'teacher' | 'unknown' {
  const explicitType = normalizePatientType(input.patientType);
  if (explicitType !== 'unknown') return explicitType;

  const actorType = normalizePatientType(input.actorRole);
  if (actorType !== 'unknown') return actorType;

  const haystack = [
    input.patientName,
    input.patientEmail,
    input.concern,
    input.visitType,
    input.patientId
  ]
    .map((value) => toSafeText(value).toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (/(teacher|faculty|professor|prof\.|instructor|staff)/i.test(haystack)) return 'teacher';
  if (/(student|learner|pupil)/i.test(haystack)) return 'student';

  const numericAge = Number(input.age ?? 0);
  if (Number.isFinite(numericAge) && numericAge > 0) {
    if (numericAge <= 23) return 'student';
    if (numericAge >= 24) return 'teacher';
  }

  return 'unknown';
}

function currentDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function toMysqlDate(value: unknown): string | null {
  const text = toSafeText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toMysqlDateTime(value: unknown): string | null {
  const text = toSafeText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

function formatDateCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return toSafeText(value);
}

function formatDateTimeCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = toSafeText(value);
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  const text = toSafeText(value);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  const text = toSafeText(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function toBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = toSafeText(value).toLowerCase();
  return normalized === '1' || normalized === 'true';
}

function buildDateSeries(fromDate: string, toDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function buildRecentMonthSeries(totalMonths: number): Array<{ key: string; label: string; start: string; end: string }> {
  const series: Array<{ key: string; label: string; start: string; end: string }> = [];
  const now = new Date();
  for (let offset = totalMonths - 1; offset >= 0; offset -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const label = monthStart.toLocaleString('en-US', { month: 'short' });
    series.push({
      key: label.toLowerCase(),
      label,
      start: monthStart.toISOString().slice(0, 10),
      end: nextMonthStart.toISOString().slice(0, 10)
    });
  }
  return series;
}

function matchesDateRange(period: string): { sql: string; params: string[] } | null {
  const today = new Date();
  const yyyyMmDd = (value: Date) => value.toISOString().slice(0, 10);

  if (period === 'today') {
    const date = yyyyMmDd(today);
    return { sql: 'appointment_date = ?', params: [date] };
  }
  if (period === 'period: upcoming' || period === 'upcoming') {
    return { sql: 'appointment_date >= ?', params: [yyyyMmDd(today)] };
  }
  if (period === 'this week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { sql: 'appointment_date >= ? AND appointment_date < ?', params: [yyyyMmDd(start), yyyyMmDd(end)] };
  }
  if (period === 'this month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return { sql: 'appointment_date >= ? AND appointment_date < ?', params: [yyyyMmDd(start), yyyyMmDd(end)] };
  }
  return null;
}

async function getPool(options: MysqlApiOptions): Promise<Pool | null> {
  if ((options.dbClient || '').trim().toLowerCase() !== 'mysql') return null;
  if (!options.host || !options.database || !options.user) return null;
  if (!mysqlPool) {
    mysqlPool = createPool({
      host: options.host,
      port: Number(options.port || '3306'),
      database: options.database,
      user: options.user,
      password: options.password || '',
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return mysqlPool;
}

async function ensureModuleActivityLogsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS module_activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      module VARCHAR(60) NOT NULL,
      action VARCHAR(120) NOT NULL,
      detail TEXT NOT NULL,
      actor VARCHAR(120) NOT NULL DEFAULT 'System',
      entity_type VARCHAR(60) NULL,
      entity_key VARCHAR(120) NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function insertModuleActivity(
  pool: Pool,
  moduleName: string,
  action: string,
  detail: string,
  actor: string,
  entityType: string | null,
  entityKey: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await ensureModuleActivityLogsTable(pool);
  await pool.query(
    `INSERT INTO module_activity_logs (module, action, detail, actor, entity_type, entity_key, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [moduleName, action, detail, actor || 'System', entityType, entityKey, JSON.stringify(metadata)]
  );
}

function cashierIntegrationEnabled(options: MysqlApiOptions): boolean {
  return toSafeText(options.cashierEnabled).toLowerCase() === 'true';
}

function cashierSyncMode(options: MysqlApiOptions): 'queue' | 'auto' {
  return toSafeText(options.cashierSyncMode).toLowerCase() === 'auto' ? 'auto' : 'queue';
}

function normalizePaymentStatus(value: unknown): 'unpaid' | 'partial' | 'paid' | 'void' {
  const normalized = toSafeText(value).toLowerCase();
  if (normalized === 'paid' || normalized === 'partial' || normalized === 'void') return normalized;
  return 'unpaid';
}

function normalizeCashierPaymentMethod(value: unknown): string | null {
  const normalized = toSafeText(value);
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (upper === 'HMA') return 'HMA';
  if (upper === 'HMO') return 'HMO';
  if (upper === 'CASH') return 'Cash';
  if (upper === 'CARD') return 'Card';
  if (upper === 'ONLINE') return 'Online';
  return normalized;
}

function appointmentRequiresCashierVerification(input: {
  cashierBillingId?: unknown;
  cashierReference?: unknown;
  amountDue?: unknown;
}): boolean {
  return toSafeInt(input.cashierBillingId, 0) > 0 || toSafeText(input.cashierReference) !== '' || toSafeMoney(input.amountDue, 0) > 0;
}

function appointmentCanProceedByCashier(input: {
  cashierBillingId?: unknown;
  cashierReference?: unknown;
  amountDue?: unknown;
  cashierPaymentStatus?: unknown;
}): boolean {
  if (!appointmentRequiresCashierVerification(input)) return true;
  return normalizePaymentStatus(input.cashierPaymentStatus) === 'paid';
}

function buildCashierEventKey(parts: Array<string | number | null | undefined>): string {
  return createHash('sha256')
    .update(parts.map((part) => toSafeText(part)).join('|'))
    .digest('hex');
}

async function ensureCashierIntegrationTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashier_integration_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_key VARCHAR(128) NOT NULL UNIQUE,
      source_module VARCHAR(60) NOT NULL,
      source_entity VARCHAR(60) NOT NULL,
      source_key VARCHAR(120) NOT NULL,
      patient_name VARCHAR(150) NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      reference_no VARCHAR(120) NULL,
      amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency_code VARCHAR(10) NOT NULL DEFAULT 'PHP',
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
      sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      last_error TEXT NULL,
      synced_at DATETIME NULL,
      payload JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_cashier_sync_status (sync_status, created_at),
      KEY idx_cashier_source_lookup (source_module, source_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashier_payment_links (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source_module VARCHAR(60) NOT NULL,
      source_key VARCHAR(120) NOT NULL,
      cashier_reference VARCHAR(120) NULL,
      cashier_billing_id BIGINT NULL,
      invoice_number VARCHAR(120) NULL,
      official_receipt VARCHAR(120) NULL,
      amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
      balance_due DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
      latest_payment_method VARCHAR(40) NULL,
      paid_at DATETIME NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cashier_payment_link (source_module, source_key),
      KEY idx_cashier_reference (cashier_reference)
    )
  `);

  try {
    await pool.query(`ALTER TABLE cashier_payment_links ADD COLUMN cashier_billing_id BIGINT NULL AFTER cashier_reference`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE cashier_payment_links ADD COLUMN latest_payment_method VARCHAR(40) NULL AFTER payment_status`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE patient_appointments ADD COLUMN cashier_billing_id BIGINT NULL AFTER payment_method`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE patient_appointments ADD COLUMN cashier_billing_no VARCHAR(120) NULL AFTER cashier_billing_id`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE patient_appointments ADD COLUMN cashier_payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER cashier_billing_no`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE patient_appointments ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER cashier_payment_status`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE patient_appointments ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed`);
  } catch {}
}

async function syncAppointmentCashierColumnsFromLinks(pool: Pool, bookingId?: string): Promise<void> {
  await ensureCashierIntegrationTables(pool);

  const filters = [`p.source_module = 'appointments'`];
  const params: Array<string | number> = [];

  if (bookingId && bookingId.trim() !== '') {
    filters.push('a.booking_id = ?');
    params.push(bookingId.trim());
  }

  await pool.query(
    `UPDATE patient_appointments a
     INNER JOIN cashier_payment_links p
       ON p.source_module = 'appointments'
      AND p.source_key = a.booking_id
     SET a.cashier_billing_id = p.cashier_billing_id,
         a.cashier_billing_no = COALESCE(NULLIF(p.invoice_number, ''), NULLIF(p.cashier_reference, ''), a.cashier_billing_no),
         a.cashier_payment_status = COALESCE(NULLIF(p.payment_status, ''), a.cashier_payment_status),
         a.cashier_can_proceed = CASE WHEN COALESCE(NULLIF(p.payment_status, ''), 'unpaid') = 'paid' THEN 1 ELSE 0 END,
         a.cashier_verified_at = CASE
           WHEN COALESCE(NULLIF(p.payment_status, ''), 'unpaid') = 'paid' THEN COALESCE(p.paid_at, a.cashier_verified_at, CURRENT_TIMESTAMP)
           ELSE a.cashier_verified_at
         END,
         a.updated_at = CURRENT_TIMESTAMP
     WHERE ${filters.join(' AND ')}`,
    params
  );
}

async function queueCashierIntegrationEvent(
  pool: Pool,
  params: {
    sourceModule: string;
    sourceEntity: string;
    sourceKey: string;
    patientName?: string | null;
    patientType?: string | null;
    referenceNo?: string | null;
    amountDue?: number;
    currencyCode?: string;
    paymentStatus?: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await ensureCashierIntegrationTables(pool);
  const eventKey = buildCashierEventKey([params.sourceModule, params.sourceEntity, params.sourceKey, params.referenceNo]);
  await pool.query(
    `INSERT INTO cashier_integration_events (
      event_key, source_module, source_entity, source_key, patient_name, patient_type,
      reference_no, amount_due, currency_code, payment_status, sync_status, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    ON DUPLICATE KEY UPDATE
      patient_name = VALUES(patient_name),
      patient_type = VALUES(patient_type),
      reference_no = VALUES(reference_no),
      amount_due = VALUES(amount_due),
      currency_code = VALUES(currency_code),
      payment_status = VALUES(payment_status),
      sync_status = 'pending',
      last_error = NULL,
      payload = VALUES(payload),
      updated_at = CURRENT_TIMESTAMP`,
    [
      eventKey,
      params.sourceModule,
      params.sourceEntity,
      params.sourceKey,
      params.patientName || null,
      normalizePatientType(params.patientType),
      params.referenceNo || null,
      toSafeMoney(params.amountDue, 0),
      toSafeText(params.currencyCode) || 'PHP',
      normalizePaymentStatus(params.paymentStatus),
      JSON.stringify(params.payload || {})
    ]
  );
}

async function backfillAppointmentCashierEvents(pool: Pool, options: MysqlApiOptions, limit = 50): Promise<void> {
  await ensureCashierIntegrationTables(pool);
  const [missingRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.booking_id, a.patient_id, a.patient_name, a.patient_email, a.patient_type, a.phone_number, a.doctor_name,
            a.department_name, a.visit_type, a.appointment_date, a.preferred_time, a.payment_method, a.status
     FROM patient_appointments a
     LEFT JOIN cashier_integration_events e
       ON e.source_module = 'appointments'
      AND e.source_key = a.booking_id
     WHERE e.id IS NULL
     ORDER BY a.created_at ASC
     LIMIT ?`,
    [Math.max(1, limit)]
  );

  for (const row of missingRows) {
    const bookingId = toSafeText(row.booking_id);
    if (!bookingId) continue;

    await queueCashierIntegrationEvent(pool, {
      sourceModule: 'appointments',
      sourceEntity: 'appointment',
      sourceKey: bookingId,
      patientName: toSafeText(row.patient_name) || null,
      patientType: toSafeText(row.patient_type) || null,
      referenceNo: bookingId,
      amountDue: 0,
      paymentStatus: normalizePaymentStatus(row.payment_status),
      payload: {
        bookingId,
        student_id: toSafeText(row.patient_id) || null,
        patient_id: toSafeText(row.patient_id) || null,
        student_name: toSafeText(row.patient_name) || null,
        patient_email: toSafeText(row.patient_email) || null,
        phone_number: toSafeText(row.phone_number) || null,
        due_date: formatDateCell(row.appointment_date) || currentDateString(),
        created_by: 'Clinic System Backfill',
        fee_type: toSafeText(row.visit_type) || toSafeText(row.department_name) || 'Appointment',
        description: toSafeText(row.visit_type) || toSafeText(row.department_name) || 'Appointment',
        doctorName: toSafeText(row.doctor_name) || null,
        departmentName: toSafeText(row.department_name) || null,
        department_name: toSafeText(row.department_name) || null,
        visitType: toSafeText(row.visit_type) || null,
        program: toSafeText(row.department_name) || null,
        appointmentDate: formatDateCell(row.appointment_date) || null,
        preferredTime: toSafeText(row.preferred_time) || null,
        status: toSafeText(row.status) || null,
        paymentMethod: toSafeText(row.payment_method) || null
      }
    });

    if (cashierIntegrationEnabled(options) && cashierSyncMode(options) === 'auto') {
      const [eventRows] = await pool.query<RowDataPacket[]>(
        `SELECT *
         FROM cashier_integration_events
         WHERE source_module = 'appointments' AND source_key = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [bookingId]
      );
      if (eventRows[0]) {
        await dispatchCashierEvent(pool, options, eventRows[0]);
      }
    }
  }
}

async function ensureDepartmentClearanceTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS department_clearance_records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      clearance_reference VARCHAR(120) NOT NULL UNIQUE,
      patient_id VARCHAR(120) NULL,
      patient_code VARCHAR(120) NULL,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      department_key VARCHAR(40) NOT NULL,
      department_name VARCHAR(120) NOT NULL,
      stage_order INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      remarks TEXT NULL,
      approver_name VARCHAR(150) NULL,
      approver_role VARCHAR(120) NULL,
      external_reference VARCHAR(120) NULL,
      requested_by VARCHAR(150) NULL,
      decided_at DATETIME NULL,
      metadata JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_clearance_department (department_key, status, created_at),
      KEY idx_clearance_patient (patient_name, patient_code)
    )
  `);
}

function departmentIntegrationMap(): Array<{
  key: string;
  name: string;
  stageOrder: number;
  purpose: string;
  recommendedEndpoint: string;
  clinicDataSources: string[];
}> {
  return [
    { key: 'hr', name: 'HR', stageOrder: 1, purpose: 'Employment and staff clearance verification', recommendedEndpoint: '/api/patients', clinicDataSources: ['patient_master', 'module_activity_logs'] },
    { key: 'pmed', name: 'PMED', stageOrder: 2, purpose: 'Pre-medical evaluation compliance', recommendedEndpoint: '/api/registrations', clinicDataSources: ['patient_registrations', 'patient_master'] },
    { key: 'clinic', name: 'Clinic', stageOrder: 3, purpose: 'Health clearance validation', recommendedEndpoint: '/api/checkups', clinicDataSources: ['patient_appointments', 'checkup_visits', 'patient_master'] },
    { key: 'guidance', name: 'Guidance', stageOrder: 4, purpose: 'Behavioral and records validation', recommendedEndpoint: '/api/mental-health', clinicDataSources: ['mental_health_sessions', 'module_activity_logs', 'patient_master'] },
    { key: 'prefect', name: 'Prefect', stageOrder: 5, purpose: 'Discipline clearance validation', recommendedEndpoint: '/api/module-activity', clinicDataSources: ['module_activity_logs', 'patient_master'] },
    { key: 'comlab', name: 'Comlab', stageOrder: 6, purpose: 'Operational and asset clearance', recommendedEndpoint: '/api/module-activity', clinicDataSources: ['module_activity_logs', 'patient_master'] },
    { key: 'crad', name: 'CRAD', stageOrder: 7, purpose: 'Records and documentation validation', recommendedEndpoint: '/api/patients', clinicDataSources: ['patient_master', 'module_activity_logs'] },
    { key: 'cashier', name: 'Cashier', stageOrder: 8, purpose: 'Financial settlement and payment processing', recommendedEndpoint: '/api/integrations/cashier/status', clinicDataSources: ['cashier_integration_events', 'cashier_payment_links'] },
    { key: 'registrar', name: 'Registrar', stageOrder: 9, purpose: 'Final approval and official document release', recommendedEndpoint: '/api/integrations/departments/records', clinicDataSources: ['department_clearance_records', 'patient_master'] },
  ];
}

async function upsertCashierPaymentLink(
  pool: Pool,
  params: {
    sourceModule: string;
    sourceKey: string;
    cashierReference?: string | null;
    cashierBillingId?: number | null;
    invoiceNumber?: string | null;
    officialReceipt?: string | null;
    amountDue?: number;
    amountPaid?: number;
    balanceDue?: number;
    paymentStatus?: string;
    latestPaymentMethod?: string | null;
    paidAt?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await ensureCashierIntegrationTables(pool);
  await pool.query(
    `INSERT INTO cashier_payment_links (
      source_module, source_key, cashier_reference, cashier_billing_id, invoice_number, official_receipt,
      amount_due, amount_paid, balance_due, payment_status, latest_payment_method, paid_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      cashier_reference = VALUES(cashier_reference),
      cashier_billing_id = VALUES(cashier_billing_id),
      invoice_number = VALUES(invoice_number),
      official_receipt = VALUES(official_receipt),
      amount_due = VALUES(amount_due),
      amount_paid = VALUES(amount_paid),
      balance_due = VALUES(balance_due),
      payment_status = VALUES(payment_status),
      latest_payment_method = VALUES(latest_payment_method),
      paid_at = VALUES(paid_at),
      metadata = VALUES(metadata),
      updated_at = CURRENT_TIMESTAMP`,
    [
      params.sourceModule,
      params.sourceKey,
      params.cashierReference || null,
      params.cashierBillingId == null ? null : toSafeInt(params.cashierBillingId, 0),
      params.invoiceNumber || null,
      params.officialReceipt || null,
      toSafeMoney(params.amountDue, 0),
      toSafeMoney(params.amountPaid, 0),
      toSafeMoney(params.balanceDue, 0),
      normalizePaymentStatus(params.paymentStatus),
      normalizeCashierPaymentMethod(params.latestPaymentMethod),
      toMysqlDateTime(params.paidAt),
      JSON.stringify(params.metadata || {})
    ]
  );
}

async function dispatchCashierEvent(
  pool: Pool,
  options: MysqlApiOptions,
  eventRow: RowDataPacket
): Promise<{ ok: boolean; statusCode?: number; message: string }> {
  const baseUrl = toSafeText(options.cashierBaseUrl).replace(/\/+$/, '');
  if (!cashierIntegrationEnabled(options) || !baseUrl) {
    return { ok: false, message: 'Cashier integration is disabled or missing base URL.' };
  }
  const eventPayload = parseJsonRecord(eventRow.payload);
  const studentId = toSafeText(eventPayload.student_id || eventPayload.patient_id);
  const studentName = toSafeText(eventPayload.student_name || eventRow.patient_name);
  const studentSyncEndpoint = `${baseUrl}/clinic/student/sync`;
  const billingEndpoint = `${baseUrl}/cashier/billing/create`;
  await ensureCashierIntegrationTables(pool);
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(toSafeText(options.cashierSharedToken) ? { 'X-Integration-Token': toSafeText(options.cashierSharedToken) } : {})
    };

    if (studentId && studentName) {
      const studentResponse = await fetch(studentSyncEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          student_id: studentId,
          full_name: studentName,
          email: toSafeText(eventPayload.patient_email || ''),
          phone: toSafeText(eventPayload.phone_number || ''),
          course: toSafeText(eventPayload.program || eventPayload.department_name || ''),
          year_level: toSafeText(eventPayload.year_level || ''),
          status: 'active'
        })
      });

      if (!studentResponse.ok) {
        const message = `Cashier student sync responded with ${studentResponse.status}.`;
        await pool.query(
          `UPDATE cashier_integration_events SET sync_status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [message, Number(eventRow.id || 0)]
        );
        return { ok: false, statusCode: studentResponse.status, message };
      }
    }

    const [existingLinkRows] = await pool.query<RowDataPacket[]>(
      `SELECT cashier_billing_id, cashier_reference, amount_due, amount_paid, balance_due, payment_status, latest_payment_method, paid_at
       FROM cashier_payment_links
       WHERE source_module = ? AND source_key = ?
       LIMIT 1`,
      [String(eventRow.source_module || ''), String(eventRow.source_key || '')]
    );
    const existingLink = existingLinkRows[0];

    let responseStatus = 200;
    if (Number(eventRow.amount_due || 0) > 0 && studentId && studentName && !toSafeInt(existingLink?.cashier_billing_id, 0)) {
      const billingResponse = await fetch(billingEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          student_id: studentId,
          patient_id: toSafeText(eventPayload.patient_id || studentId),
          source_type: String(eventRow.source_entity || 'record'),
          source_module: String(eventRow.source_module || ''),
          source_id: String(eventRow.source_key || ''),
          fee_type: toSafeText(eventPayload.fee_type || eventPayload.visit_type || eventRow.source_entity || 'clinic_fee'),
          description: toSafeText(eventPayload.description || eventPayload.visit_type || eventRow.reference_no || 'Clinic charge'),
          amount: Number(eventRow.amount_due || 0),
          due_date: toSafeText(eventPayload.due_date || formatDateCell(eventRow.created_at) || currentDateString()),
          created_by: toSafeText(eventPayload.created_by || 'Clinic System'),
          student_name: studentName,
          program: toSafeText(eventPayload.program || eventPayload.department_name || ''),
          year_level: toSafeText(eventPayload.year_level || ''),
          metadata: {
            booking_id: toSafeText(eventPayload.bookingId || eventRow.source_key),
            patient_email: toSafeText(eventPayload.patient_email || ''),
            phone_number: toSafeText(eventPayload.phone_number || ''),
            doctor_name: toSafeText(eventPayload.doctorName || ''),
            department_name: toSafeText(eventPayload.departmentName || '')
          }
        })
      });

      responseStatus = billingResponse.status;
      if (!billingResponse.ok) {
        const message = `Cashier billing sync responded with ${billingResponse.status}.`;
        await pool.query(
          `UPDATE cashier_integration_events SET sync_status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [message, Number(eventRow.id || 0)]
        );
        return { ok: false, statusCode: billingResponse.status, message };
      }

      const billingPayload = await billingResponse.json().catch(() => ({} as Record<string, unknown>));
      const billingData = parseJsonRecord((billingPayload as Record<string, unknown>).data);
      await upsertCashierPaymentLink(pool, {
        sourceModule: String(eventRow.source_module || ''),
        sourceKey: String(eventRow.source_key || ''),
        cashierReference: toSafeText(billingData.billing_no) || null,
        cashierBillingId: toSafeInt(billingData.billing_id, 0) || null,
        amountDue: Number(eventRow.amount_due || 0),
        amountPaid: 0,
        balanceDue: Number(eventRow.amount_due || 0),
        paymentStatus: 'unpaid',
        latestPaymentMethod: null,
        metadata: {
          source: 'cashier_billing_create',
          student_id: studentId,
          student_name: studentName
        }
      });
    } else if (existingLink) {
      await upsertCashierPaymentLink(pool, {
        sourceModule: String(eventRow.source_module || ''),
        sourceKey: String(eventRow.source_key || ''),
        cashierReference: toSafeText(existingLink.cashier_reference) || null,
        cashierBillingId: toSafeInt(existingLink.cashier_billing_id, 0) || null,
        amountDue: Number(eventRow.amount_due || existingLink.amount_due || 0),
        amountPaid: Number(existingLink.amount_paid || 0),
        balanceDue: Number(existingLink.balance_due || eventRow.amount_due || 0),
        paymentStatus: toSafeText(existingLink.payment_status) || 'unpaid',
        latestPaymentMethod: toSafeText(existingLink.latest_payment_method) || null,
        paidAt: toSafeText(existingLink.paid_at) || null,
        metadata: {
          source: 'cashier_billing_existing',
          student_id: studentId,
          student_name: studentName
        }
      });
    }

    if (String(eventRow.source_module || '') === 'appointments') {
      await syncAppointmentCashierColumnsFromLinks(pool, String(eventRow.source_key || ''));
    }

    await pool.query(
      `UPDATE cashier_integration_events SET sync_status = 'sent', synced_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [Number(eventRow.id || 0)]
    );
    return { ok: true, statusCode: responseStatus, message: 'Dispatched to cashier system.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cashier dispatch failed.';
    await pool.query(
      `UPDATE cashier_integration_events SET sync_status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [message, Number(eventRow.id || 0)]
    );
    return { ok: false, message };
  }
}

async function ensureDoctorsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      doctor_name VARCHAR(120) NOT NULL UNIQUE,
      department_name VARCHAR(120) NOT NULL,
      specialization VARCHAR(160) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
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
      is_active = VALUES(is_active)
  `);
}

async function ensureDoctorAvailabilityTables(pool: Pool): Promise<void> {
  await ensureDoctorsTable(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_availability (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      doctor_name VARCHAR(120) NOT NULL,
      department_name VARCHAR(120) NOT NULL,
      day_of_week SMALLINT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      max_appointments INT NOT NULL DEFAULT 8,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_doctor_slot (doctor_name, department_name, day_of_week, start_time, end_time)
    )
  `);

  await pool.query(`
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
      is_active = VALUES(is_active)
  `);
}

async function ensurePatientAppointmentsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_appointments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      booking_id VARCHAR(40) NOT NULL UNIQUE,
      patient_id VARCHAR(60) NULL,
      patient_name VARCHAR(150) NOT NULL,
      patient_age SMALLINT NULL,
      patient_email VARCHAR(190) NULL,
      patient_gender VARCHAR(30) NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      guardian_name VARCHAR(150) NULL,
      phone_number VARCHAR(60) NOT NULL,
      emergency_contact VARCHAR(120) NULL,
      insurance_provider VARCHAR(120) NULL,
      payment_method VARCHAR(40) NULL,
      actor_role VARCHAR(20) NOT NULL DEFAULT 'unknown',
      appointment_priority VARCHAR(20) NOT NULL DEFAULT 'Routine',
      symptoms_summary TEXT NULL,
      doctor_notes TEXT NULL,
      doctor_name VARCHAR(120) NOT NULL,
      department_name VARCHAR(120) NOT NULL,
      visit_type VARCHAR(120) NULL,
      appointment_date DATE NOT NULL,
      preferred_time VARCHAR(20) NULL,
      visit_reason TEXT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensurePatientRegistrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_registrations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      case_id VARCHAR(40) NOT NULL UNIQUE,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      patient_email VARCHAR(190) NULL,
      age SMALLINT NULL,
      concern TEXT NULL,
      intake_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      booked_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      assigned_to VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensurePatientWalkinsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_walkins (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      case_id VARCHAR(40) NOT NULL UNIQUE,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      age SMALLINT NULL,
      sex VARCHAR(12) NULL,
      date_of_birth DATE NULL,
      contact VARCHAR(60) NULL,
      address TEXT NULL,
      emergency_contact VARCHAR(120) NULL,
      patient_ref VARCHAR(60) NULL,
      visit_department VARCHAR(80) NULL,
      checkin_time DATETIME NULL,
      pain_scale SMALLINT NULL,
      temperature_c DECIMAL(4,1) NULL,
      blood_pressure VARCHAR(20) NULL,
      pulse_bpm SMALLINT NULL,
      weight_kg DECIMAL(5,2) NULL,
      chief_complaint TEXT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'Low',
      intake_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      assigned_doctor VARCHAR(120) NOT NULL DEFAULT 'Nurse Triage',
      status VARCHAR(40) NOT NULL DEFAULT 'waiting',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureCheckupVisitsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkup_visits (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      visit_id VARCHAR(40) NOT NULL UNIQUE,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      assigned_doctor VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
      source VARCHAR(50) NOT NULL DEFAULT 'appointment_confirmed',
      status VARCHAR(40) NOT NULL DEFAULT 'intake',
      chief_complaint TEXT NULL,
      diagnosis TEXT NULL,
      clinical_notes TEXT NULL,
      consultation_started_at DATETIME NULL,
      lab_requested TINYINT(1) NOT NULL DEFAULT 0,
      lab_result_ready TINYINT(1) NOT NULL DEFAULT 0,
      prescription_created TINYINT(1) NOT NULL DEFAULT 0,
      prescription_dispensed TINYINT(1) NOT NULL DEFAULT 0,
      follow_up_date DATE NULL,
      is_emergency TINYINT(1) NOT NULL DEFAULT 0,
      version INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [seedRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits`);
  if (Number(seedRows[0]?.total || 0) > 0) return;

  await pool.query(`
    INSERT INTO checkup_visits (
      visit_id, patient_name, patient_type, assigned_doctor, source, status, chief_complaint,
      diagnosis, clinical_notes, lab_requested, lab_result_ready, prescription_created, prescription_dispensed
    ) VALUES
      ('VISIT-2026-2001', 'Maria Santos', 'student', 'Dr. Humour', 'appointment_confirmed', 'queue', 'Fever with sore throat', NULL, NULL, 0, 0, 0, 0),
      ('VISIT-2026-2002', 'Rico Dela Cruz', 'teacher', 'Dr. Humour', 'walkin_triage_completed', 'doctor_assigned', 'Persistent headache', NULL, NULL, 0, 0, 0, 0),
      ('VISIT-2026-2003', 'Juana Reyes', 'student', 'Dr. Jenni', 'waiting_for_doctor', 'in_consultation', 'Back pain', 'Muscle strain', 'Pain localized at lower back, no neuro deficits.', 1, 0, 0, 0)
    ON DUPLICATE KEY UPDATE visit_id = VALUES(visit_id)
  `);
}

async function ensureLaboratoryTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS laboratory_requests (
      request_id BIGINT PRIMARY KEY,
      visit_id VARCHAR(60) NOT NULL,
      patient_id VARCHAR(60) NOT NULL,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      age SMALLINT NULL,
      sex VARCHAR(20) NULL,
      category VARCHAR(80) NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
      status VARCHAR(30) NOT NULL DEFAULT 'Pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      requested_by_doctor VARCHAR(120) NOT NULL,
      doctor_department VARCHAR(120) NULL,
      notes TEXT NULL,
      tests JSON NULL,
      specimen_type VARCHAR(80) NULL,
      sample_source VARCHAR(80) NULL,
      collection_date_time DATETIME NULL,
      clinical_diagnosis TEXT NULL,
      lab_instructions TEXT NULL,
      insurance_reference VARCHAR(120) NULL,
      billing_reference VARCHAR(120) NULL,
      assigned_lab_staff VARCHAR(120) NULL,
      sample_collected TINYINT(1) NOT NULL DEFAULT 0,
      sample_collected_at DATETIME NULL,
      processing_started_at DATETIME NULL,
      result_encoded_at DATETIME NULL,
      result_reference_range TEXT NULL,
      verified_by VARCHAR(120) NULL,
      verified_at DATETIME NULL,
      rejection_reason TEXT NULL,
      resample_flag TINYINT(1) NOT NULL DEFAULT 0,
      released_at DATETIME NULL,
      raw_attachment_name VARCHAR(255) NULL,
      encoded_values JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS laboratory_activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      request_id BIGINT NOT NULL,
      action VARCHAR(120) NOT NULL,
      details TEXT NOT NULL,
      actor VARCHAR(120) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensurePharmacyInventoryTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_medicines (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      medicine_code VARCHAR(40) NOT NULL,
      sku VARCHAR(60) NOT NULL UNIQUE,
      medicine_name VARCHAR(150) NOT NULL,
      brand_name VARCHAR(150) NULL,
      generic_name VARCHAR(150) NULL,
      category VARCHAR(80) NULL,
      medicine_type VARCHAR(80) NULL,
      dosage_strength VARCHAR(80) NULL,
      unit_of_measure VARCHAR(40) NULL,
      supplier_name VARCHAR(120) NULL,
      purchase_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      batch_lot_no VARCHAR(80) NULL,
      manufacturing_date DATE NULL,
      expiry_date DATE NULL,
      storage_requirements TEXT NULL,
      reorder_level INT NOT NULL DEFAULT 20,
      low_stock_threshold INT NOT NULL DEFAULT 20,
      stock_capacity INT NOT NULL DEFAULT 100,
      stock_on_hand INT NOT NULL DEFAULT 0,
      stock_location VARCHAR(120) NULL,
      barcode VARCHAR(120) NULL,
      is_archived TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_dispense_requests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      request_code VARCHAR(60) NOT NULL UNIQUE,
      medicine_id BIGINT NOT NULL,
      patient_name VARCHAR(150) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      notes TEXT NULL,
      prescription_reference VARCHAR(120) NOT NULL,
      dispense_reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fulfilled_at DATETIME NULL,
      fulfilled_by VARCHAR(120) NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_stock_movements (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      medicine_id BIGINT NOT NULL,
      movement_type VARCHAR(40) NOT NULL,
      quantity_change INT NOT NULL,
      quantity_before INT NOT NULL,
      quantity_after INT NOT NULL,
      reason TEXT NOT NULL,
      batch_lot_no VARCHAR(80) NULL,
      stock_location VARCHAR(120) NULL,
      actor VARCHAR(120) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(80) NOT NULL,
      detail TEXT NOT NULL,
      actor VARCHAR(120) NOT NULL,
      tone VARCHAR(20) NOT NULL DEFAULT 'info',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureMentalHealthTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mental_health_patients (
      patient_id VARCHAR(40) PRIMARY KEY,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      date_of_birth DATE NULL,
      sex VARCHAR(20) NULL,
      contact_number VARCHAR(60) NULL,
      guardian_contact VARCHAR(120) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mental_health_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      case_reference VARCHAR(60) NOT NULL UNIQUE,
      patient_id VARCHAR(40) NOT NULL,
      patient_name VARCHAR(150) NOT NULL,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      counselor VARCHAR(120) NOT NULL,
      session_type VARCHAR(120) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'create',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
      diagnosis_condition TEXT NULL,
      treatment_plan TEXT NULL,
      session_goals TEXT NULL,
      session_duration_minutes INT NOT NULL DEFAULT 45,
      session_mode VARCHAR(20) NOT NULL DEFAULT 'in_person',
      location_room VARCHAR(120) NULL,
      guardian_contact VARCHAR(120) NULL,
      emergency_contact VARCHAR(120) NULL,
      medication_reference VARCHAR(120) NULL,
      follow_up_frequency VARCHAR(80) NULL,
      escalation_reason TEXT NULL,
      outcome_result TEXT NULL,
      assessment_score INT NULL,
      assessment_tool VARCHAR(80) NULL,
      appointment_at DATETIME NOT NULL,
      next_follow_up_at DATETIME NULL,
      created_by_role VARCHAR(80) NOT NULL,
      is_draft TINYINT(1) NOT NULL DEFAULT 0,
      archived_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mental_health_notes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_id BIGINT NOT NULL,
      note_type VARCHAR(80) NOT NULL,
      note_content TEXT NOT NULL,
      clinical_score INT NULL,
      attachment_name VARCHAR(255) NULL,
      attachment_url VARCHAR(255) NULL,
      created_by_role VARCHAR(80) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mental_health_activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_id BIGINT NULL,
      action VARCHAR(120) NOT NULL,
      detail TEXT NOT NULL,
      actor_role VARCHAR(80) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensurePatientMasterTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_master (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_code VARCHAR(60) NOT NULL,
      patient_name VARCHAR(150) NOT NULL,
      identity_key VARCHAR(220) NOT NULL UNIQUE,
      patient_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
      email VARCHAR(190) NULL,
      contact VARCHAR(60) NULL,
      sex VARCHAR(20) NULL,
      date_of_birth DATE NULL,
      age SMALLINT NULL,
      emergency_contact VARCHAR(120) NULL,
      guardian_contact VARCHAR(120) NULL,
      latest_status VARCHAR(60) NOT NULL DEFAULT 'active',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
      appointment_count INT NOT NULL DEFAULT 0,
      walkin_count INT NOT NULL DEFAULT 0,
      checkup_count INT NOT NULL DEFAULT 0,
      mental_count INT NOT NULL DEFAULT 0,
      pharmacy_count INT NOT NULL DEFAULT 0,
      source_tags JSON NULL,
      last_seen_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureAdminProfileTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_profiles (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(190) NOT NULL UNIQUE,
      full_name VARCHAR(190) NOT NULL,
      email VARCHAR(190) NOT NULL,
      role VARCHAR(80) NOT NULL DEFAULT 'admin',
      department VARCHAR(120) NOT NULL DEFAULT 'Administration',
      access_exemptions JSON NULL,
      is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
      password_hash TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      phone VARCHAR(80) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      email_notifications TINYINT(1) NOT NULL DEFAULT 1,
      in_app_notifications TINYINT(1) NOT NULL DEFAULT 1,
      dark_mode TINYINT(1) NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(190) NOT NULL,
      action VARCHAR(100) NOT NULL,
      raw_action VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      ip_address VARCHAR(80) NOT NULL DEFAULT '127.0.0.1',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_token_hash VARCHAR(128) NOT NULL UNIQUE,
      admin_profile_id BIGINT NOT NULL,
      ip_address VARCHAR(80) NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await pool.query<RowDataPacket[]>(`SELECT id FROM admin_profiles WHERE LOWER(username) = 'joecelgarcia1@gmail.com' LIMIT 1`);
  if (rows[0]) return;

  await pool.query(
    `INSERT INTO admin_profiles (username, full_name, email, role, department, access_exemptions, is_super_admin, password_hash, status, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'joecelgarcia1@gmail.com',
      'BCP Clinic Admin',
      'joecelgarcia1@gmail.com',
      'admin',
      'Administration',
      JSON.stringify([]),
      1,
      hashPassword('Admin#123'),
      'active',
      '+63 912 345 6789'
    ]
  );
}

async function getDoctorAvailabilitySnapshot(
  pool: Pool,
  doctorName: string,
  departmentName: string,
  appointmentDate: string,
  preferredTime?: string,
  excludeBookingId?: string
): Promise<Record<string, unknown>> {
  await ensureDoctorAvailabilityTables(pool);
  await ensurePatientAppointmentsTable(pool);

  const requestedDate = toMysqlDate(appointmentDate);
  if (!requestedDate) {
    return { doctorName, departmentName, appointmentDate, isDoctorAvailable: false, reason: 'Invalid appointment date.', slots: [], recommendedTimes: [] };
  }

  const dayOfWeek = new Date(`${requestedDate}T00:00:00`).getDay();
  const [slotsRaw] = await pool.query<RowDataPacket[]>(
    `SELECT id, start_time, end_time, max_appointments
     FROM doctor_availability
     WHERE doctor_name = ? AND department_name = ? AND day_of_week = ? AND is_active = 1
     ORDER BY start_time ASC`,
    [doctorName, departmentName, dayOfWeek]
  );

  const slots = await Promise.all(
    slotsRaw.map(async (slot) => {
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM patient_appointments
         WHERE doctor_name = ?
           AND department_name = ?
           AND appointment_date = ?
           AND (? IS NULL OR booking_id <> ?)
           AND (preferred_time IS NULL OR (TIME(preferred_time) >= ? AND TIME(preferred_time) < ?))
           AND LOWER(COALESCE(status, '')) <> 'canceled'`,
        [doctorName, departmentName, requestedDate, excludeBookingId || null, excludeBookingId || null, slot.start_time, slot.end_time]
      );
      const booked = Number(countRows[0]?.total || 0);
      const maxAppointments = Number(slot.max_appointments || 0);
      return {
        id: Number(slot.id || 0),
        startTime: String(slot.start_time || '').slice(0, 5),
        endTime: String(slot.end_time || '').slice(0, 5),
        maxAppointments,
        bookedAppointments: booked,
        remainingAppointments: Math.max(0, maxAppointments - booked),
        isOpen: maxAppointments - booked > 0
      };
    })
  );

  const preferred = toSafeText(preferredTime);
  const preferredSlot = preferred ? slots.find((slot) => preferred >= slot.startTime && preferred < slot.endTime) : null;
  const recommendedTimes = slots.filter((slot) => slot.isOpen).map((slot) => slot.startTime);
  const isDoctorAvailable = preferred ? Boolean(preferredSlot?.isOpen) : slots.some((slot) => slot.isOpen);
  const reason = isDoctorAvailable
    ? preferred ? 'Doctor available.' : 'Doctor has available schedule.'
    : preferred ? 'Selected doctor/time slot is already full or unavailable.' : 'Doctor has no remaining available schedule for the selected date.';

  return { doctorName, departmentName, appointmentDate: requestedDate, isDoctorAvailable, reason, slots, recommendedTimes };
}

function mapAppointmentRow(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    booking_id: String(row.booking_id || ''),
    patient_id: row.patient_id == null ? null : String(row.patient_id),
    patient_name: String(row.patient_name || ''),
    patient_email: row.patient_email == null ? null : String(row.patient_email),
    patient_type: String(row.patient_type || 'unknown'),
    phone_number: String(row.phone_number || ''),
    emergency_contact: row.emergency_contact == null ? null : String(row.emergency_contact),
    insurance_provider: row.insurance_provider == null ? null : String(row.insurance_provider),
    payment_method: row.payment_method == null ? null : String(row.payment_method),
    cashier_billing_id: row.cashier_billing_id == null ? null : Number(row.cashier_billing_id),
    cashier_billing_no: row.cashier_billing_no == null ? (row.cashier_reference == null ? null : String(row.cashier_reference)) : String(row.cashier_billing_no),
    cashier_reference: row.cashier_reference == null ? null : String(row.cashier_reference),
    cashier_payment_status: normalizePaymentStatus(row.cashier_payment_status || row.payment_status),
    cashier_payment_method: normalizeCashierPaymentMethod(row.cashier_payment_method || row.latest_payment_method),
    cashier_can_proceed: toBooleanFlag(row.cashier_can_proceed),
    cashier_verified_at: row.cashier_verified_at == null ? null : formatDateTimeCell(row.cashier_verified_at),
    cashier_sync_status: row.cashier_sync_status == null ? '' : String(row.cashier_sync_status),
    amount_due: Number(row.amount_due || 0),
    amount_paid: Number(row.amount_paid || 0),
    balance_due: Number(row.balance_due || 0),
    official_receipt: row.official_receipt == null ? null : String(row.official_receipt),
    paid_at: row.paid_at == null ? null : formatDateTimeCell(row.paid_at),
    actor_role: String(row.actor_role || 'unknown'),
    appointment_priority: String(row.appointment_priority || 'Routine'),
    doctor_name: String(row.doctor_name || ''),
    service_name: String(row.service_name || row.department_name || 'General Check-Up'),
    department_name: String(row.department_name || ''),
    appointment_date: row.appointment_date instanceof Date ? row.appointment_date.toISOString().slice(0, 10) : String(row.appointment_date || ''),
    preferred_time: row.preferred_time == null ? null : String(row.preferred_time),
    status: String(row.status || ''),
    symptoms_summary: row.symptoms_summary == null ? null : String(row.symptoms_summary),
    doctor_notes: row.doctor_notes == null ? null : String(row.doctor_notes),
    visit_reason: row.visit_reason == null ? null : String(row.visit_reason),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ''),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || '')
  };
}

function mapRegistrationRow(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    case_id: String(row.case_id || ''),
    patient_name: String(row.patient_name || ''),
    patient_type: String(row.patient_type || 'unknown'),
    patient_email: row.patient_email == null ? '' : String(row.patient_email),
    age: Number(row.age || 0),
    concern: row.concern == null ? '' : String(row.concern),
    intake_time: formatDateTimeCell(row.intake_time),
    booked_time: formatDateTimeCell(row.booked_time),
    status: String(row.status || 'Pending'),
    assigned_to: String(row.assigned_to || 'Unassigned')
  };
}

function mapWalkinRow(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    case_id: String(row.case_id || ''),
    patient_name: String(row.patient_name || ''),
    patient_type: String(row.patient_type || 'unknown'),
    age: Number(row.age || 0),
    sex: row.sex == null ? '' : String(row.sex),
    date_of_birth: row.date_of_birth == null ? '' : formatDateCell(row.date_of_birth),
    contact: row.contact == null ? '' : String(row.contact),
    address: row.address == null ? '' : String(row.address),
    emergency_contact: row.emergency_contact == null ? '' : String(row.emergency_contact),
    patient_ref: row.patient_ref == null ? '' : String(row.patient_ref),
    visit_department: row.visit_department == null ? '' : String(row.visit_department),
    checkin_time: row.checkin_time == null ? '' : formatDateTimeCell(row.checkin_time),
    pain_scale: row.pain_scale == null ? null : Number(row.pain_scale),
    temperature_c: row.temperature_c == null ? null : Number(row.temperature_c),
    blood_pressure: row.blood_pressure == null ? '' : String(row.blood_pressure),
    pulse_bpm: row.pulse_bpm == null ? null : Number(row.pulse_bpm),
    weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
    chief_complaint: row.chief_complaint == null ? '' : String(row.chief_complaint),
    severity: String(row.severity || 'Low'),
    intake_time: formatDateTimeCell(row.intake_time),
    assigned_doctor: String(row.assigned_doctor || 'Nurse Triage'),
    status: String(row.status || 'waiting')
  };
}

function mapCheckupRow(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    visit_id: String(row.visit_id || ''),
    patient_name: String(row.patient_name || ''),
    patient_type: String(row.patient_type || 'unknown'),
    assigned_doctor: String(row.assigned_doctor || 'Unassigned'),
    source: String(row.source || 'appointment_confirmed'),
    status: String(row.status || 'intake'),
    chief_complaint: row.chief_complaint == null ? '' : String(row.chief_complaint),
    diagnosis: row.diagnosis == null ? '' : String(row.diagnosis),
    clinical_notes: row.clinical_notes == null ? '' : String(row.clinical_notes),
    consultation_started_at: row.consultation_started_at == null ? '' : formatDateTimeCell(row.consultation_started_at),
    lab_requested: toBooleanFlag(row.lab_requested),
    lab_result_ready: toBooleanFlag(row.lab_result_ready),
    prescription_created: toBooleanFlag(row.prescription_created),
    prescription_dispensed: toBooleanFlag(row.prescription_dispensed),
    follow_up_date: row.follow_up_date == null ? '' : formatDateCell(row.follow_up_date),
    is_emergency: toBooleanFlag(row.is_emergency),
    version: Number(row.version || 1),
    updated_at: formatDateTimeCell(row.updated_at)
  };
}

function mapLabDetailRow(row: RowDataPacket): Record<string, unknown> {
  return {
    request_id: Number(row.request_id || 0),
    visit_id: String(row.visit_id || ''),
    patient_id: String(row.patient_id || ''),
    patient_name: String(row.patient_name || ''),
    patient_type: String(row.patient_type || 'unknown'),
    age: row.age == null ? null : Number(row.age),
    sex: row.sex == null ? '' : String(row.sex),
    category: String(row.category || ''),
    priority: String(row.priority || 'Normal'),
    status: String(row.status || 'Pending'),
    requested_at: formatDateTimeCell(row.requested_at),
    requested_by_doctor: String(row.requested_by_doctor || ''),
    doctor_department: row.doctor_department == null ? '' : String(row.doctor_department),
    notes: row.notes == null ? '' : String(row.notes),
    tests: parseJsonArray(row.tests),
    specimen_type: row.specimen_type == null ? '' : String(row.specimen_type),
    sample_source: row.sample_source == null ? '' : String(row.sample_source),
    collection_date_time: row.collection_date_time == null ? null : formatDateTimeCell(row.collection_date_time),
    clinical_diagnosis: row.clinical_diagnosis == null ? '' : String(row.clinical_diagnosis),
    lab_instructions: row.lab_instructions == null ? '' : String(row.lab_instructions),
    insurance_reference: row.insurance_reference == null ? '' : String(row.insurance_reference),
    billing_reference: row.billing_reference == null ? '' : String(row.billing_reference),
    assigned_lab_staff: row.assigned_lab_staff == null ? '' : String(row.assigned_lab_staff),
    sample_collected: toBooleanFlag(row.sample_collected),
    sample_collected_at: row.sample_collected_at == null ? null : formatDateTimeCell(row.sample_collected_at),
    processing_started_at: row.processing_started_at == null ? null : formatDateTimeCell(row.processing_started_at),
    result_encoded_at: row.result_encoded_at == null ? null : formatDateTimeCell(row.result_encoded_at),
    result_reference_range: row.result_reference_range == null ? '' : String(row.result_reference_range),
    verified_by: row.verified_by == null ? '' : String(row.verified_by),
    verified_at: row.verified_at == null ? null : formatDateTimeCell(row.verified_at),
    rejection_reason: row.rejection_reason == null ? '' : String(row.rejection_reason),
    resample_flag: toBooleanFlag(row.resample_flag),
    released_at: row.released_at == null ? null : formatDateTimeCell(row.released_at),
    raw_attachment_name: row.raw_attachment_name == null ? '' : String(row.raw_attachment_name),
    encoded_values: parseJsonRecord(row.encoded_values)
  };
}

function mapPatientRow(row: RowDataPacket): Record<string, unknown> {
  return {
    id: Number(row.id || 0),
    patient_code: String(row.patient_code || ''),
    patient_name: String(row.patient_name || ''),
    patient_type: String(row.patient_type || 'unknown'),
    email: row.email == null ? null : String(row.email),
    contact: row.contact == null ? null : String(row.contact),
    sex: row.sex == null ? null : String(row.sex),
    date_of_birth: row.date_of_birth == null ? null : formatDateCell(row.date_of_birth),
    age: row.age == null ? null : Number(row.age),
    emergency_contact: row.emergency_contact == null ? null : String(row.emergency_contact),
    guardian_contact: row.guardian_contact == null ? null : String(row.guardian_contact),
    latest_status: String(row.latest_status || ''),
    risk_level: String(row.risk_level || 'low'),
    appointment_count: Number(row.appointment_count || 0),
    walkin_count: Number(row.walkin_count || 0),
    checkup_count: Number(row.checkup_count || 0),
    mental_count: Number(row.mental_count || 0),
    pharmacy_count: Number(row.pharmacy_count || 0),
    source_tags: parseJsonArray(row.source_tags),
    last_seen_at: row.last_seen_at == null ? null : formatDateTimeCell(row.last_seen_at),
    created_at: formatDateTimeCell(row.created_at),
    updated_at: formatDateTimeCell(row.updated_at)
  };
}

async function selectRegistrationById(pool: Pool, id: number): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, case_id, patient_name, patient_type, patient_email, age, concern, intake_time, booked_time, status, assigned_to
     FROM patient_registrations WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function selectWalkinById(pool: Pool, id: number): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, case_id, patient_name, patient_type, age, sex, date_of_birth, contact, address, emergency_contact, patient_ref, visit_department, checkin_time,
            pain_scale, temperature_c, blood_pressure, pulse_bpm, weight_kg, chief_complaint, severity, intake_time, assigned_doctor, status
     FROM patient_walkins WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function selectCheckupById(pool: Pool, id: number): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, visit_id, patient_name, patient_type, assigned_doctor, source, status, chief_complaint, diagnosis, clinical_notes, consultation_started_at,
            lab_requested, lab_result_ready, prescription_created, prescription_dispensed, follow_up_date, is_emergency, version, created_at, updated_at
     FROM checkup_visits WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function rebuildPatientMaster(pool: Pool): Promise<void> {
  await ensurePatientMasterTables(pool);
  await pool.query(`DELETE FROM patient_master`);

  await pool.query(`
    INSERT INTO patient_master (
      patient_code, patient_name, identity_key, patient_type, email, contact, sex, age, emergency_contact, latest_status, risk_level, source_tags, last_seen_at
    )
    SELECT
      COALESCE(NULLIF(TRIM(COALESCE(patient_id, '')), ''), CONCAT('PAT-A-', id)),
      patient_name,
      CONCAT(LOWER(TRIM(patient_name)), '|', COALESCE(phone_number, '')),
      patient_type,
      NULLIF(TRIM(COALESCE(patient_email, '')), ''),
      NULLIF(TRIM(COALESCE(phone_number, '')), ''),
      NULLIF(TRIM(COALESCE(patient_gender, '')), ''),
      patient_age,
      NULLIF(TRIM(COALESCE(emergency_contact, '')), ''),
      LOWER(COALESCE(status, 'pending')),
      CASE WHEN LOWER(COALESCE(appointment_priority, 'routine')) = 'urgent' THEN 'medium' ELSE 'low' END,
      JSON_ARRAY('appointments'),
      COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    FROM patient_appointments
  `);

  await pool.query(`
    INSERT INTO patient_master (
      patient_code, patient_name, identity_key, patient_type, contact, sex, date_of_birth, age, emergency_contact, latest_status, risk_level, source_tags, last_seen_at
    )
    SELECT
      COALESCE(NULLIF(TRIM(COALESCE(patient_ref, '')), ''), CONCAT('PAT-W-', id)),
      patient_name,
      CONCAT(LOWER(TRIM(patient_name)), '|', COALESCE(contact, '')),
      patient_type,
      NULLIF(TRIM(COALESCE(contact, '')), ''),
      NULLIF(TRIM(COALESCE(sex, '')), ''),
      date_of_birth,
      age,
      NULLIF(TRIM(COALESCE(emergency_contact, '')), ''),
      LOWER(COALESCE(status, 'waiting')),
      CASE WHEN LOWER(COALESCE(severity, 'low')) = 'emergency' THEN 'high' WHEN LOWER(COALESCE(severity, 'low')) = 'moderate' THEN 'medium' ELSE 'low' END,
      JSON_ARRAY('walkin'),
      COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    FROM patient_walkins
  `);

  await pool.query(`
    INSERT INTO patient_master (
      patient_code, patient_name, identity_key, patient_type, latest_status, risk_level, source_tags, last_seen_at
    )
    SELECT
      CONCAT('PAT-C-', id),
      patient_name,
      CONCAT(LOWER(TRIM(patient_name)), '|'),
      patient_type,
      LOWER(COALESCE(status, 'intake')),
      CASE WHEN is_emergency = 1 THEN 'high' ELSE 'low' END,
      JSON_ARRAY('checkup'),
      COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
    FROM checkup_visits
  `);

  await pool.query(`
    INSERT INTO patient_master (
      patient_code, patient_name, identity_key, patient_type, contact, sex, date_of_birth, guardian_contact, latest_status, risk_level, source_tags, last_seen_at
    )
    SELECT
      patient_id,
      patient_name,
      CONCAT(LOWER(TRIM(patient_name)), '|', COALESCE(contact_number, '')),
      patient_type,
      NULLIF(TRIM(COALESCE(contact_number, '')), ''),
      NULLIF(TRIM(COALESCE(sex, '')), ''),
      date_of_birth,
      NULLIF(TRIM(COALESCE(guardian_contact, '')), ''),
      'active',
      'low',
      JSON_ARRAY('mental'),
      CURRENT_TIMESTAMP
    FROM mental_health_patients
  `);

  const [appointmentCounts] = await pool.query<RowDataPacket[]>(`SELECT CONCAT(LOWER(TRIM(patient_name)), '|', COALESCE(phone_number, '')) AS identity_key, COUNT(*) AS total FROM patient_appointments GROUP BY 1`);
  for (const row of appointmentCounts) {
    await pool.query(`UPDATE patient_master SET appointment_count = ? WHERE identity_key = ?`, [Number(row.total || 0), String(row.identity_key || '')]);
  }
  const [walkinCounts] = await pool.query<RowDataPacket[]>(`SELECT CONCAT(LOWER(TRIM(patient_name)), '|', COALESCE(contact, '')) AS identity_key, COUNT(*) AS total FROM patient_walkins GROUP BY 1`);
  for (const row of walkinCounts) {
    await pool.query(`UPDATE patient_master SET walkin_count = ? WHERE identity_key = ?`, [Number(row.total || 0), String(row.identity_key || '')]);
  }
  const [checkupCounts] = await pool.query<RowDataPacket[]>(`SELECT CONCAT(LOWER(TRIM(patient_name)), '|') AS identity_key, COUNT(*) AS total, MAX(CASE WHEN is_emergency = 1 THEN 1 ELSE 0 END) AS high_risk FROM checkup_visits GROUP BY 1`);
  for (const row of checkupCounts) {
    await pool.query(`UPDATE patient_master SET checkup_count = ?, risk_level = CASE WHEN ? = 1 THEN 'high' ELSE risk_level END WHERE identity_key = ?`, [Number(row.total || 0), Number(row.high_risk || 0), String(row.identity_key || '')]);
  }
  const [mentalCounts] = await pool.query<RowDataPacket[]>(`SELECT CONCAT(LOWER(TRIM(patient_name)), '|') AS identity_key, COUNT(*) AS total, MAX(CASE risk_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END) AS risk_rank, SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY updated_at DESC), ',', 1) AS latest_status FROM mental_health_sessions GROUP BY 1`);
  for (const row of mentalCounts) {
    const riskLevel = Number(row.risk_rank || 1) >= 3 ? 'high' : Number(row.risk_rank || 1) === 2 ? 'medium' : 'low';
    await pool.query(`UPDATE patient_master SET mental_count = ?, risk_level = CASE WHEN ? = 'high' OR risk_level <> 'high' THEN ? ELSE risk_level END, latest_status = COALESCE(?, latest_status) WHERE identity_key = ?`, [Number(row.total || 0), riskLevel, riskLevel, toSafeText(row.latest_status) || null, String(row.identity_key || '')]);
  }
  const [pharmacyCounts] = await pool.query<RowDataPacket[]>(`SELECT CONCAT(LOWER(TRIM(patient_name)), '|') AS identity_key, COUNT(*) AS total FROM pharmacy_dispense_requests GROUP BY 1`);
  for (const row of pharmacyCounts) {
    await pool.query(`UPDATE patient_master SET pharmacy_count = ? WHERE identity_key = ?`, [Number(row.total || 0), String(row.identity_key || '')]);
  }
}

async function resolveMysqlAdminSession(pool: Pool, req: any): Promise<RowDataPacket | null> {
  const cookies = parseCookieHeader(String(req.headers?.cookie || ''));
  const sessionToken = toSafeText(cookies.admin_session);
  if (!sessionToken) return null;
  const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id AS admin_profile_id, p.username, p.full_name, p.email, p.role, p.department, p.access_exemptions, p.is_super_admin
     FROM admin_sessions s
     JOIN admin_profiles p ON p.id = s.admin_profile_id
     WHERE s.session_token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP
       AND LOWER(COALESCE(p.status, '')) = 'active'
     LIMIT 1`,
    [sessionHash]
  );
  return rows[0] || null;
}

export function mysqlCompatibilityApiPlugin(options: MysqlApiOptions): Plugin {
  return {
    name: 'mysql-compatibility-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pool = await getPool(options);
        const url = new URL(req.url || '', 'http://localhost');

        if (!pool || !['/api/appointments', '/api/doctors', '/api/doctor-availability', '/api/registrations', '/api/walk-ins', '/api/checkups', '/api/laboratory', '/api/pharmacy', '/api/mental-health', '/api/patients', '/api/admin-auth', '/api/admin-profile', '/api/module-activity', '/api/reports', '/api/dashboard', '/api/integrations/cashier/status', '/api/integrations/cashier/queue', '/api/integrations/cashier/sync', '/api/integrations/cashier/payment-status', '/api/integrations/departments/map', '/api/integrations/departments/records'].includes(url.pathname)) {
          next();
          return;
        }

        try {
          if (url.pathname === '/api/doctors') {
            await ensureDoctorsTable(pool);
            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const department = toSafeText(url.searchParams.get('department'));
              const includeInactive = toSafeText(url.searchParams.get('include_inactive')).toLowerCase() === 'true';
              const where: string[] = [];
              const params: unknown[] = [];
              if (department) {
                where.push('department_name = ?');
                params.push(department);
              }
              if (!includeInactive) where.push('is_active = 1');
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id, doctor_name, department_name, specialization, is_active, created_at, updated_at
                 FROM doctors${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY doctor_name ASC`,
                params
              );
              writeJson(res, 200, { ok: true, data: rows });
              return;
            }
            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const doctorName = toSafeText(body.doctor_name);
              const departmentName = toSafeText(body.department_name);
              if (toSafeText(body.action).toLowerCase() !== 'upsert' || !doctorName || !departmentName) {
                writeJson(res, 422, { ok: false, message: 'doctor_name and department_name are required.' });
                return;
              }
              await pool.query(
                `INSERT INTO doctors (doctor_name, department_name, specialization, is_active)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   department_name = VALUES(department_name),
                   specialization = VALUES(specialization),
                   is_active = VALUES(is_active)`,
                [doctorName, departmentName, toSafeText(body.specialization) || null, body.is_active === false ? 0 : 1]
              );
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id, doctor_name, department_name, specialization, is_active, created_at, updated_at
                 FROM doctors WHERE doctor_name = ? LIMIT 1`,
                [doctorName]
              );
              writeJson(res, 200, { ok: true, data: rows[0] || null });
              return;
            }
          }

          if (url.pathname === '/api/doctor-availability') {
            await ensureDoctorAvailabilityTables(pool);
            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const mode = toSafeText(url.searchParams.get('mode')).toLowerCase();
              const doctor = normalizeDoctorFilter(toSafeText(url.searchParams.get('doctor')));
              const department = toSafeText(url.searchParams.get('department'));
              const appointmentDate = toSafeText(url.searchParams.get('date'));
              const preferredTime = toSafeText(url.searchParams.get('preferred_time'));

              if (mode === 'raw') {
                const where: string[] = [];
                const params: unknown[] = [];
                if (doctor) {
                  where.push('doctor_name = ?');
                  params.push(doctor);
                }
                if (department) {
                  where.push('department_name = ?');
                  params.push(department);
                }
                const [rows] = await pool.query<RowDataPacket[]>(
                  `SELECT id, doctor_name, department_name, day_of_week, start_time, end_time, max_appointments, is_active, created_at, updated_at
                   FROM doctor_availability${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
                   ORDER BY doctor_name ASC, day_of_week ASC, start_time ASC`,
                  params
                );
                writeJson(res, 200, { ok: true, data: rows });
                return;
              }

              if (mode === 'times') {
                if (!department || !appointmentDate) {
                  writeJson(res, 422, { ok: false, message: 'department and date are required for times mode.' });
                  return;
                }
                const [doctorRows] = await pool.query<RowDataPacket[]>(
                  `SELECT doctor_name, department_name
                   FROM doctors
                   WHERE department_name = ? AND is_active = 1${doctor ? ' AND doctor_name = ?' : ''}
                   ORDER BY doctor_name ASC`,
                  doctor ? [department, doctor] : [department]
                );
                const snapshots = await Promise.all(doctorRows.map((row) => getDoctorAvailabilitySnapshot(pool, String(row.doctor_name), String(row.department_name), appointmentDate)));
                const allowedTimes = Array.from(new Set(snapshots.flatMap((item) => (item.recommendedTimes as string[]) || []))).sort();
                writeJson(res, 200, { ok: true, data: { appointmentDate, departmentName: department, allowedTimes, doctors: snapshots } });
                return;
              }

              if (!doctor || !department || !appointmentDate) {
                writeJson(res, 422, { ok: false, message: 'doctor, department, and date are required.' });
                return;
              }
              writeJson(res, 200, { ok: true, data: await getDoctorAvailabilitySnapshot(pool, doctor, department, appointmentDate, preferredTime || undefined) });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              if (action === 'upsert') {
                await pool.query(
                  `INSERT INTO doctor_availability (doctor_name, department_name, day_of_week, start_time, end_time, max_appointments, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE max_appointments = VALUES(max_appointments), is_active = VALUES(is_active)`,
                  [
                    toSafeText(body.doctor_name),
                    toSafeText(body.department_name),
                    toSafeInt(body.day_of_week, 0),
                    `${toSafeText(body.start_time).slice(0, 5)}:00`,
                    `${toSafeText(body.end_time).slice(0, 5)}:00`,
                    Math.max(1, toSafeInt(body.max_appointments, 8)),
                    body.is_active === false ? 0 : 1
                  ]
                );
                const [rows] = await pool.query<RowDataPacket[]>(
                  `SELECT id, doctor_name, department_name, day_of_week, start_time, end_time, max_appointments, is_active, created_at, updated_at
                   FROM doctor_availability
                   WHERE doctor_name = ? AND department_name = ? AND day_of_week = ? AND start_time = ? AND end_time = ?
                   LIMIT 1`,
                  [
                    toSafeText(body.doctor_name),
                    toSafeText(body.department_name),
                    toSafeInt(body.day_of_week, 0),
                    `${toSafeText(body.start_time).slice(0, 5)}:00`,
                    `${toSafeText(body.end_time).slice(0, 5)}:00`
                  ]
                );
                writeJson(res, 200, { ok: true, data: rows[0] || null });
                return;
              }
              if (action === 'delete') {
                await pool.query('DELETE FROM doctor_availability WHERE id = ? LIMIT 1', [toSafeInt(body.id, 0)]);
                writeJson(res, 200, { ok: true, data: { id: toSafeInt(body.id, 0) } });
                return;
              }
            }
          }

          if (url.pathname === '/api/admin-auth') {
            await ensureAdminProfileTables(pool);

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const session = await resolveMysqlAdminSession(pool, req);
              writeJson(res, 200, {
                ok: true,
                data: {
                  authenticated: Boolean(session),
                  user: session
                    ? {
                        id: Number(session.admin_profile_id || 0),
                        username: String(session.username || ''),
                        fullName: String(session.full_name || ''),
                        email: String(session.email || ''),
                        role: String(session.role || ''),
                        department: String(session.department || ''),
                        accessExemptions: parseJsonArray(session.access_exemptions),
                        isSuperAdmin: toBooleanFlag(session.is_super_admin)
                      }
                    : null
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const appendSetCookie = (cookieValue: string): void => {
                const existing = res.getHeader('Set-Cookie');
                const cookies = Array.isArray(existing) ? existing.concat(cookieValue) : existing ? [String(existing), cookieValue] : [cookieValue];
                res.setHeader('Set-Cookie', cookies);
              };

              if (action === 'logout') {
                const cookies = parseCookieHeader(String(req.headers?.cookie || ''));
                const token = toSafeText(cookies.admin_session);
                if (token) {
                  const tokenHash = createHash('sha256').update(token).digest('hex');
                  await pool.query(`UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE session_token_hash = ? AND revoked_at IS NULL`, [tokenHash]);
                }
                appendSetCookie('admin_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/');
                writeJson(res, 200, { ok: true, message: 'Signed out.' });
                return;
              }

              if (action === 'login') {
                const username = toSafeText(body.username).toLowerCase();
                const password = toSafeText(body.password);
                if (!username || !password) {
                  writeJson(res, 422, { ok: false, message: 'Username and password are required.' });
                  return;
                }
                const [rows] = await pool.query<RowDataPacket[]>(
                  `SELECT id, username, full_name, email, role, department, access_exemptions, is_super_admin, status, password_hash
                   FROM admin_profiles
                   WHERE LOWER(username) = ? OR LOWER(email) = ?
                   LIMIT 1`,
                  [username, username]
                );
                const account = rows[0];
                if (!account || toSafeText(account.status).toLowerCase() !== 'active' || !toSafeText(account.password_hash) || !verifyPassword(password, String(account.password_hash || ''))) {
                  writeJson(res, 401, { ok: false, message: 'Invalid credentials.' });
                  return;
                }
                const sessionToken = randomBytes(32).toString('hex');
                const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
                await pool.query(`INSERT INTO admin_sessions (session_token_hash, admin_profile_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 12 HOUR))`, [sessionHash, Number(account.id || 0), '127.0.0.1', String(req.headers['user-agent'] || '')]);
                await pool.query(`UPDATE admin_profiles SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [Number(account.id || 0)]);
                await pool.query(`INSERT INTO admin_activity_logs (username, action, raw_action, description, ip_address) VALUES (?, 'Login', 'LOGIN', 'Admin signed in.', '127.0.0.1')`, [String(account.username || '')]);
                appendSetCookie(`admin_session=${sessionToken}; Max-Age=${60 * 60 * 12}; HttpOnly; SameSite=Lax; Path=/`);
                writeJson(res, 200, {
                  ok: true,
                  data: {
                    user: {
                      id: Number(account.id || 0),
                      username: String(account.username || ''),
                      fullName: String(account.full_name || ''),
                      email: String(account.email || ''),
                      role: String(account.role || ''),
                      department: String(account.department || ''),
                      accessExemptions: parseJsonArray(account.access_exemptions),
                      isSuperAdmin: toBooleanFlag(account.is_super_admin)
                    }
                  }
                });
                return;
              }

              if (action === 'create_account') {
                const actor = await resolveMysqlAdminSession(pool, req);
                if (!actor || !toBooleanFlag(actor.is_super_admin)) {
                  writeJson(res, 403, { ok: false, message: 'Only super admin can create admin accounts.' });
                  return;
                }
                const username = toSafeText(body.username).toLowerCase();
                const email = toSafeText(body.email).toLowerCase();
                const fullName = toSafeText(body.full_name);
                const password = toSafeText(body.password);
                if (!username || !email || !fullName || password.length < 8) {
                  writeJson(res, 422, { ok: false, message: 'Full name, username, email, and password (min 8 chars) are required.' });
                  return;
                }
                const [existingRows] = await pool.query<RowDataPacket[]>(`SELECT id FROM admin_profiles WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1`, [username, email]);
                if (existingRows[0]) {
                  writeJson(res, 409, { ok: false, message: 'Admin account already exists for this username/email.' });
                  return;
                }
                await pool.query(`INSERT INTO admin_profiles (username, full_name, email, role, department, access_exemptions, is_super_admin, password_hash, status, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [username, fullName, email, toSafeText(body.role) || 'Admin', toSafeText(body.department) || 'Administration', JSON.stringify(Array.isArray(body.access_exemptions) ? body.access_exemptions : []), toBooleanFlag(body.is_super_admin) ? 1 : 0, hashPassword(password), toSafeText(body.status) || 'active', toSafeText(body.phone) || '']);
                await pool.query(`INSERT INTO admin_activity_logs (username, action, raw_action, description, ip_address) VALUES (?, 'Account Created', 'ACCOUNT_CREATED', ?, '127.0.0.1')`, [String(actor.username || ''), `Created admin account ${username}`]);
                writeJson(res, 200, { ok: true, message: 'Admin account created.' });
                return;
              }

              writeJson(res, 422, { ok: false, message: 'Unsupported admin auth action.' });
              return;
            }
          }

          if (url.pathname === '/api/admin-profile') {
            await ensureAdminProfileTables(pool);
            const adminSession = await resolveMysqlAdminSession(pool, req);
            if (!adminSession) {
              writeJson(res, 401, { ok: false, message: 'Admin authentication required.' });
              return;
            }

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const requestedUsername = toSafeText(url.searchParams.get('username')).toLowerCase();
              const username = requestedUsername && toBooleanFlag(adminSession.is_super_admin) ? requestedUsername : String(adminSession.username || '').toLowerCase();
              const [profileRows] = await pool.query<RowDataPacket[]>(`SELECT username, full_name, email, role, department, is_super_admin, status, phone, created_at, last_login_at, email_notifications, in_app_notifications, dark_mode FROM admin_profiles WHERE username = ? LIMIT 1`, [username]);
              const profile = profileRows[0];
              if (!profile) {
                writeJson(res, 404, { ok: false, message: 'Admin profile not found.' });
                return;
              }
              const [logs] = await pool.query<RowDataPacket[]>(`SELECT action, raw_action, description, ip_address, created_at FROM admin_activity_logs WHERE username = ? ORDER BY created_at DESC LIMIT 50`, [username]);
              writeJson(res, 200, {
                ok: true,
                data: {
                  profile: {
                    fullName: String(profile.full_name || ''),
                    username: String(profile.username || ''),
                    email: String(profile.email || ''),
                    role: String(profile.role || ''),
                    department: String(profile.department || 'Administration'),
                    isSuperAdmin: toBooleanFlag(profile.is_super_admin),
                    status: String(profile.status || ''),
                    phone: String(profile.phone || ''),
                    createdAt: formatDateTimeCell(profile.created_at),
                    lastLoginAt: formatDateTimeCell(profile.last_login_at)
                  },
                  preferences: {
                    emailNotifications: toBooleanFlag(profile.email_notifications),
                    inAppNotifications: toBooleanFlag(profile.in_app_notifications),
                    darkMode: toBooleanFlag(profile.dark_mode)
                  },
                  stats: {
                    totalLogins: logs.filter((item) => String(item.raw_action || '') === 'LOGIN').length,
                    status: String(profile.status || '').toUpperCase()
                  },
                  activityLogs: logs.map((item) => ({ dateTime: formatDateTimeCell(item.created_at), action: String(item.action || ''), rawAction: String(item.raw_action || ''), description: String(item.description || ''), ipAddress: String(item.ip_address || '') })),
                  loginHistory: logs.filter((item) => ['LOGIN', 'LOGOUT'].includes(String(item.raw_action || ''))).map((item) => ({ dateTime: formatDateTimeCell(item.created_at), action: String(item.action || ''), rawAction: String(item.raw_action || ''), description: String(item.description || ''), ipAddress: String(item.ip_address || '') }))
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const requestedUsername = toSafeText(body.username).toLowerCase();
              const username = requestedUsername && toBooleanFlag(adminSession.is_super_admin) ? requestedUsername : String(adminSession.username || '').toLowerCase();
              const preferences = (body.preferences || {}) as Record<string, unknown>;
              await pool.query(`UPDATE admin_profiles SET full_name = COALESCE(NULLIF(?, ''), full_name), phone = COALESCE(NULLIF(?, ''), phone), email_notifications = COALESCE(?, email_notifications), in_app_notifications = COALESCE(?, in_app_notifications), dark_mode = COALESCE(?, dark_mode) WHERE username = ?`, [toSafeText(body.full_name) || null, toSafeText(body.phone) || null, preferences.emailNotifications == null ? null : (toBooleanFlag(preferences.emailNotifications) ? 1 : 0), preferences.inAppNotifications == null ? null : (toBooleanFlag(preferences.inAppNotifications) ? 1 : 0), preferences.darkMode == null ? null : (toBooleanFlag(preferences.darkMode) ? 1 : 0), username]);
              await pool.query(`INSERT INTO admin_activity_logs (username, action, raw_action, description, ip_address) VALUES (?, 'Profile Updated', 'PROFILE_UPDATED', 'Profile settings updated.', '127.0.0.1')`, [username]);
              writeJson(res, 200, { ok: true });
              return;
            }
          }

          if (url.pathname === '/api/integrations/cashier/status' && (req.method || 'GET').toUpperCase() === 'GET') {
            await ensureCashierIntegrationTables(pool);
            const [queueRows] = await pool.query<RowDataPacket[]>(
              `SELECT
                 SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) AS pending_total,
                 SUM(CASE WHEN sync_status = 'sent' THEN 1 ELSE 0 END) AS sent_total,
                 SUM(CASE WHEN sync_status = 'acknowledged' THEN 1 ELSE 0 END) AS acknowledged_total,
                 SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END) AS failed_total
               FROM cashier_integration_events`
            );
            const [recentEvents] = await pool.query<RowDataPacket[]>(
              `SELECT id, source_module, source_entity, source_key, patient_name, patient_type, reference_no, amount_due, currency_code, payment_status, sync_status, last_error, synced_at, created_at
               FROM cashier_integration_events
               ORDER BY created_at DESC
               LIMIT 12`
            );
            const [recentPayments] = await pool.query<RowDataPacket[]>(
              `SELECT id, source_module, source_key, cashier_reference, cashier_billing_id, invoice_number, official_receipt, amount_due, amount_paid, balance_due, payment_status, latest_payment_method, paid_at, updated_at
               FROM cashier_payment_links
               ORDER BY updated_at DESC
               LIMIT 12`
            );
            writeJson(res, 200, {
              ok: true,
              data: {
                enabled: cashierIntegrationEnabled(options),
                syncMode: cashierSyncMode(options),
                baseUrl: toSafeText(options.cashierBaseUrl) || '',
                inboundPath: toSafeText(options.cashierInboundPath) || '/api/integrations/clinic-events',
                queue: {
                  pending: Number(queueRows[0]?.pending_total || 0),
                  sent: Number(queueRows[0]?.sent_total || 0),
                  acknowledged: Number(queueRows[0]?.acknowledged_total || 0),
                  failed: Number(queueRows[0]?.failed_total || 0)
                },
                recentEvents: recentEvents.map((row) => ({
                  ...row,
                  amount_due: Number(row.amount_due || 0),
                  created_at: formatDateTimeCell(row.created_at),
                  synced_at: row.synced_at == null ? null : formatDateTimeCell(row.synced_at)
                })),
                recentPayments: recentPayments.map((row) => ({
                  ...row,
                  amount_due: Number(row.amount_due || 0),
                  amount_paid: Number(row.amount_paid || 0),
                  balance_due: Number(row.balance_due || 0),
                  paid_at: row.paid_at == null ? null : formatDateTimeCell(row.paid_at),
                  updated_at: formatDateTimeCell(row.updated_at)
                }))
              }
            });
            return;
          }

          if (url.pathname === '/api/integrations/cashier/queue' && (req.method || 'GET').toUpperCase() === 'GET') {
            await ensureCashierIntegrationTables(pool);
            const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
            const perPage = Math.min(50, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 10)));
            const offset = (page - 1) * perPage;
            const syncStatus = toSafeText(url.searchParams.get('sync_status')).toLowerCase();
            const sourceModule = toSafeText(url.searchParams.get('source_module')).toLowerCase();
            const where: string[] = [];
            const params: unknown[] = [];
            if (syncStatus) {
              where.push('LOWER(sync_status) = ?');
              params.push(syncStatus);
            }
            if (sourceModule) {
              where.push('LOWER(source_module) = ?');
              params.push(sourceModule);
            }
            const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
            const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM cashier_integration_events${whereSql}`, params);
            const total = Number(countRows[0]?.total || 0);
            const [rows] = await pool.query<RowDataPacket[]>(
              `SELECT id, source_module, source_entity, source_key, patient_name, patient_type, reference_no, amount_due, currency_code, payment_status, sync_status, last_error, synced_at, created_at, updated_at
               FROM cashier_integration_events${whereSql}
               ORDER BY created_at DESC
               LIMIT ? OFFSET ?`,
              [...params, perPage, offset]
            );
            writeJson(res, 200, {
              ok: true,
              data: {
                items: rows.map((row) => ({
                  ...row,
                  amount_due: Number(row.amount_due || 0),
                  created_at: formatDateTimeCell(row.created_at),
                  updated_at: formatDateTimeCell(row.updated_at),
                  synced_at: row.synced_at == null ? null : formatDateTimeCell(row.synced_at)
                })),
                meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }
              }
            });
            return;
          }

          if (url.pathname === '/api/integrations/cashier/sync' && (req.method || '').toUpperCase() === 'POST') {
            await ensureCashierIntegrationTables(pool);
            const body = await readJsonBody(req);
            const action = toSafeText(body.action).toLowerCase();

            if (action === 'enqueue') {
              const sourceModule = toSafeText(body.source_module);
              const sourceEntity = toSafeText(body.source_entity) || 'record';
              const sourceKey = toSafeText(body.source_key);
              if (!sourceModule || !sourceKey) {
                writeJson(res, 422, { ok: false, message: 'source_module and source_key are required.' });
                return;
              }
              await queueCashierIntegrationEvent(pool, {
                sourceModule,
                sourceEntity,
                sourceKey,
                patientName: toSafeText(body.patient_name) || null,
                patientType: toSafeText(body.patient_type) || null,
                referenceNo: toSafeText(body.reference_no) || sourceKey,
                amountDue: toSafeMoney(body.amount_due, 0),
                paymentStatus: toSafeText(body.payment_status) || 'unpaid',
                payload: parseJsonRecord(body.payload)
              });
              await insertModuleActivity(pool, 'cashier_integration', 'Cashier Sync Enqueued', `Queued ${sourceModule} ${sourceKey} for cashier sync.`, toSafeText(body.actor) || 'System', sourceEntity, sourceKey);
              writeJson(res, 200, { ok: true, message: 'Cashier sync queued.' });
              return;
            }

            if (action === 'dispatch_pending') {
              const limit = Math.min(25, Math.max(1, toSafeInt(body.limit, 10)));
              const eventId = toSafeInt(body.event_id, 0);
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT * FROM cashier_integration_events
                 WHERE ${eventId > 0 ? 'id = ?' : `sync_status = 'pending'`}
                 ORDER BY created_at ASC
                 LIMIT ?`,
                eventId > 0 ? [eventId, limit] : [limit]
              );
              const results: Array<Record<string, unknown>> = [];
              for (const row of rows) {
                const result = await dispatchCashierEvent(pool, options, row);
                results.push({ id: Number(row.id || 0), source_key: String(row.source_key || ''), ...result });
              }
              writeJson(res, 200, {
                ok: true,
                data: {
                  enabled: cashierIntegrationEnabled(options),
                  processed: results.length,
                  results
                }
              });
              return;
            }

            if (action === 'acknowledge') {
              const eventId = toSafeInt(body.event_id, 0);
              if (!eventId) {
                writeJson(res, 422, { ok: false, message: 'event_id is required.' });
                return;
              }
              await pool.query(
                `UPDATE cashier_integration_events SET sync_status = 'acknowledged', last_error = NULL, synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [eventId]
              );
              writeJson(res, 200, { ok: true, message: 'Cashier event acknowledged.' });
              return;
            }

            writeJson(res, 422, { ok: false, message: 'Unsupported cashier sync action.' });
            return;
          }

          if (url.pathname === '/api/integrations/cashier/payment-status' && (req.method || '').toUpperCase() === 'POST') {
            await ensureCashierIntegrationTables(pool);
            const body = await readJsonBody(req);
            const sourceModule = toSafeText(body.source_module);
            const sourceKey = toSafeText(body.source_key);
            if (!sourceModule || !sourceKey) {
              writeJson(res, 422, { ok: false, message: 'source_module and source_key are required.' });
              return;
            }
              await upsertCashierPaymentLink(pool, {
                sourceModule,
                sourceKey,
                cashierReference: toSafeText(body.cashier_reference) || null,
                cashierBillingId: toSafeInt(body.cashier_billing_id, 0) || null,
              invoiceNumber: toSafeText(body.invoice_number) || null,
              officialReceipt: toSafeText(body.official_receipt) || null,
              amountDue: toSafeMoney(body.amount_due, 0),
              amountPaid: toSafeMoney(body.amount_paid, 0),
              balanceDue: toSafeMoney(body.balance_due, 0),
              paymentStatus: toSafeText(body.payment_status) || 'unpaid',
              latestPaymentMethod: toSafeText(body.latest_payment_method || body.payment_method) || null,
                paidAt: toSafeText(body.paid_at) || null,
                metadata: parseJsonRecord(body.metadata)
              });
              if (sourceModule === 'appointments') {
                await syncAppointmentCashierColumnsFromLinks(pool, sourceKey);
              }
              await pool.query(
                `UPDATE cashier_integration_events
                 SET payment_status = ?, sync_status = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE source_module = ? AND source_key = ?`,
              [
                normalizePaymentStatus(body.payment_status),
                normalizePaymentStatus(body.payment_status) === 'paid' ? 'acknowledged' : 'sent',
                sourceModule,
                sourceKey
              ]
            );
            await insertModuleActivity(pool, 'cashier_integration', 'Cashier Payment Status Updated', `Received cashier payment status for ${sourceModule} ${sourceKey}.`, toSafeText(body.actor) || 'Cashier System', 'cashier_payment', sourceKey, {
              paymentStatus: normalizePaymentStatus(body.payment_status),
              amountPaid: toSafeMoney(body.amount_paid, 0),
              officialReceipt: toSafeText(body.official_receipt) || null
            });
            writeJson(res, 200, { ok: true, message: 'Cashier payment status recorded.' });
            return;
          }

          if (url.pathname === '/api/integrations/departments/map' && (req.method || 'GET').toUpperCase() === 'GET') {
            writeJson(res, 200, {
              ok: true,
              data: {
                departments: departmentIntegrationMap()
              }
            });
            return;
          }

          if (url.pathname === '/api/integrations/departments/records') {
            await ensureDepartmentClearanceTables(pool);

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const department = toSafeText(url.searchParams.get('department')).toLowerCase();
              const status = toSafeText(url.searchParams.get('status')).toLowerCase();
              const search = toSafeText(url.searchParams.get('search')).toLowerCase();
              const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
              const perPage = Math.min(50, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 15)));
              const offset = (page - 1) * perPage;
              const where: string[] = [];
              const params: unknown[] = [];
              if (department) {
                where.push('LOWER(department_key) = ?');
                params.push(department);
              }
              if (status) {
                where.push('LOWER(status) = ?');
                params.push(status);
              }
              if (search) {
                const like = `%${search}%`;
                where.push('(LOWER(patient_name) LIKE ? OR LOWER(COALESCE(patient_code, \'\')) LIKE ? OR LOWER(COALESCE(clearance_reference, \'\')) LIKE ? OR LOWER(COALESCE(external_reference, \'\')) LIKE ?)');
                params.push(like, like, like, like);
              }
              const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
              const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM department_clearance_records${whereSql}`, params);
              const total = Number(countRows[0]?.total || 0);
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT *
                 FROM department_clearance_records${whereSql}
                 ORDER BY stage_order ASC, created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, perPage, offset]
              );
              writeJson(res, 200, {
                ok: true,
                data: {
                  items: rows.map((row) => ({
                    ...row,
                    metadata: parseJsonRecord(row.metadata),
                    created_at: formatDateTimeCell(row.created_at),
                    updated_at: formatDateTimeCell(row.updated_at),
                    decided_at: row.decided_at == null ? null : formatDateTimeCell(row.decided_at)
                  })),
                  meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
                  departments: departmentIntegrationMap()
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const departmentKey = toSafeText(body.department_key).toLowerCase();
              const departmentDef = departmentIntegrationMap().find((item) => item.key === departmentKey);
              if (!departmentDef && action !== 'seed_defaults') {
                writeJson(res, 422, { ok: false, message: 'Valid department_key is required.' });
                return;
              }

              if (action === 'request_clearance') {
                const patientName = toSafeText(body.patient_name);
                if (!patientName) {
                  writeJson(res, 422, { ok: false, message: 'patient_name is required.' });
                  return;
                }
                const clearanceReference = toSafeText(body.clearance_reference) || `CLR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;
                await pool.query(
                  `INSERT INTO department_clearance_records (
                    clearance_reference, patient_id, patient_code, patient_name, patient_type,
                    department_key, department_name, stage_order, status, remarks, approver_name,
                    approver_role, external_reference, requested_by, metadata
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE
                    patient_id = VALUES(patient_id),
                    patient_code = VALUES(patient_code),
                    patient_name = VALUES(patient_name),
                    patient_type = VALUES(patient_type),
                    department_key = VALUES(department_key),
                    department_name = VALUES(department_name),
                    stage_order = VALUES(stage_order),
                    remarks = VALUES(remarks),
                    approver_name = VALUES(approver_name),
                    approver_role = VALUES(approver_role),
                    external_reference = VALUES(external_reference),
                    requested_by = VALUES(requested_by),
                    metadata = VALUES(metadata),
                    updated_at = CURRENT_TIMESTAMP`,
                  [
                    clearanceReference,
                    toSafeText(body.patient_id) || null,
                    toSafeText(body.patient_code) || null,
                    patientName,
                    normalizePatientType(body.patient_type),
                    departmentDef?.key,
                    departmentDef?.name,
                    Number(departmentDef?.stageOrder || 0),
                    toSafeText(body.status) || 'pending',
                    toSafeText(body.remarks) || null,
                    toSafeText(body.approver_name) || null,
                    toSafeText(body.approver_role) || null,
                    toSafeText(body.external_reference) || null,
                    toSafeText(body.requested_by) || null,
                    JSON.stringify(parseJsonRecord(body.metadata))
                  ]
                );
                await insertModuleActivity(pool, 'department_clearance', 'Clearance Requested', `Clearance requested from ${departmentDef?.name} for ${patientName}.`, toSafeText(body.requested_by) || 'System', 'clearance', clearanceReference, { department: departmentDef?.key });
                writeJson(res, 200, { ok: true, message: 'Department clearance request saved.', data: { clearance_reference: clearanceReference } });
                return;
              }

              if (action === 'submit_decision') {
                const clearanceReference = toSafeText(body.clearance_reference);
                const nextStatus = toSafeText(body.status).toLowerCase();
                if (!clearanceReference || !['approved', 'rejected', 'hold', 'pending'].includes(nextStatus)) {
                  writeJson(res, 422, { ok: false, message: 'clearance_reference and valid status are required.' });
                  return;
                }
                await pool.query(
                  `UPDATE department_clearance_records
                   SET status = ?, remarks = ?, approver_name = ?, approver_role = ?, external_reference = COALESCE(?, external_reference),
                       decided_at = CURRENT_TIMESTAMP, metadata = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE clearance_reference = ?`,
                  [
                    nextStatus,
                    toSafeText(body.remarks) || null,
                    toSafeText(body.approver_name) || null,
                    toSafeText(body.approver_role) || null,
                    toSafeText(body.external_reference) || null,
                    JSON.stringify(parseJsonRecord(body.metadata)),
                    clearanceReference
                  ]
                );
                await insertModuleActivity(pool, 'department_clearance', `Clearance ${nextStatus}`, `${departmentDef?.name} marked ${clearanceReference} as ${nextStatus}.`, toSafeText(body.approver_name) || departmentDef?.name || 'External Department', 'clearance', clearanceReference, { department: departmentDef?.key, status: nextStatus });
                writeJson(res, 200, { ok: true, message: 'Department decision recorded.' });
                return;
              }

              if (action === 'seed_defaults') {
                const patientName = toSafeText(body.patient_name) || 'Integration Test Patient';
                const patientCode = toSafeText(body.patient_code) || 'PAT-INTEGRATION-001';
                const patientType = normalizePatientType(body.patient_type);
                for (const department of departmentIntegrationMap()) {
                  const clearanceReference = `${department.key.toUpperCase()}-${patientCode}`;
                  await pool.query(
                    `INSERT INTO department_clearance_records (
                      clearance_reference, patient_id, patient_code, patient_name, patient_type,
                      department_key, department_name, stage_order, status, requested_by, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                    ON DUPLICATE KEY UPDATE
                      patient_name = VALUES(patient_name),
                      patient_type = VALUES(patient_type),
                      requested_by = VALUES(requested_by),
                      metadata = VALUES(metadata),
                      updated_at = CURRENT_TIMESTAMP`,
                    [
                      clearanceReference,
                      toSafeText(body.patient_id) || null,
                      patientCode,
                      patientName,
                      patientType,
                      department.key,
                      department.name,
                      department.stageOrder,
                      toSafeText(body.requested_by) || 'System',
                      JSON.stringify({ purpose: department.purpose })
                    ]
                  );
                }
                writeJson(res, 200, { ok: true, message: 'Default department clearance records created.' });
                return;
              }

              writeJson(res, 422, { ok: false, message: 'Unsupported department clearance action.' });
              return;
            }
          }

          if (url.pathname === '/api/module-activity' && (req.method || 'GET').toUpperCase() === 'GET') {
            await ensureModuleActivityLogsTable(pool);
            await ensureLaboratoryTables(pool);

            const moduleFilter = toSafeText(url.searchParams.get('module')).toLowerCase();
            const actorFilter = toSafeText(url.searchParams.get('actor')).toLowerCase();
            const search = toSafeText(url.searchParams.get('search')).toLowerCase();
            const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
            const perPage = Math.min(100, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 12)));
            const offset = (page - 1) * perPage;
            const where: string[] = [];
            const params: unknown[] = [];

            if (moduleFilter && moduleFilter !== 'all') {
              where.push('LOWER(module) = ?');
              params.push(moduleFilter);
            }
            if (actorFilter) {
              where.push('LOWER(actor) LIKE ?');
              params.push(`%${actorFilter}%`);
            }
            if (search) {
              where.push('(LOWER(action) LIKE ? OR LOWER(detail) LIKE ? OR LOWER(COALESCE(entity_key, "")) LIKE ?)');
              params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
            const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM module_activity_logs${whereSql}`, params);
            let total = Number(countRows[0]?.total || 0);
            let [rows] = await pool.query<RowDataPacket[]>(
              `SELECT id, module, action, detail, actor, entity_type, entity_key, metadata, created_at
               FROM module_activity_logs${whereSql}
               ORDER BY created_at DESC
               LIMIT ? OFFSET ?`,
              [...params, perPage, offset]
            );

            if ((!rows || rows.length === 0) && moduleFilter === 'laboratory') {
              const labWhere: string[] = [];
              const labParams: unknown[] = [];
              if (actorFilter) {
                labWhere.push('LOWER(actor) LIKE ?');
                labParams.push(`%${actorFilter}%`);
              }
              if (search) {
                labWhere.push('(LOWER(action) LIKE ? OR LOWER(details) LIKE ? OR CAST(request_id AS CHAR) LIKE ?)');
                labParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
              }
              const labWhereSql = labWhere.length ? ` WHERE ${labWhere.join(' AND ')}` : '';
              const [labCountRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM laboratory_activity_logs${labWhereSql}`, labParams);
              total = Number(labCountRows[0]?.total || 0);
              const [labRows] = await pool.query<RowDataPacket[]>(
                `SELECT
                   id,
                   'laboratory' AS module,
                   action,
                   details AS detail,
                   actor,
                   'lab_request' AS entity_type,
                   CAST(request_id AS CHAR) AS entity_key,
                   JSON_OBJECT() AS metadata,
                   created_at
                 FROM laboratory_activity_logs${labWhereSql}
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`,
                [...labParams, perPage, offset]
              );
              rows = labRows;
            }

            writeJson(res, 200, {
              ok: true,
              data: {
                items: (rows || []).map((row) => ({
                  ...row,
                  metadata: parseJsonRecord(row.metadata),
                  created_at: formatDateTimeCell(row.created_at)
                })),
                meta: {
                  page,
                  perPage,
                  total,
                  totalPages: Math.max(1, Math.ceil(total / perPage))
                }
              }
            });
            return;
          }

          if (url.pathname === '/api/reports' && (req.method || 'GET').toUpperCase() === 'GET') {
            await ensureModuleActivityLogsTable(pool);
            await ensurePatientAppointmentsTable(pool);
            await ensurePatientWalkinsTable(pool);
            await ensureCheckupVisitsTable(pool);
            await ensureMentalHealthTables(pool);
            await ensurePharmacyInventoryTables(pool);
            await ensurePatientMasterTables(pool);

            const requestedFrom = toMysqlDate(url.searchParams.get('from')) || '';
            const requestedTo = toMysqlDate(url.searchParams.get('to')) || '';
            const today = new Date();
            const defaultTo = today.toISOString().slice(0, 10);
            const defaultFromDate = new Date(today);
            defaultFromDate.setDate(defaultFromDate.getDate() - 29);
            const fromDate = requestedFrom || defaultFromDate.toISOString().slice(0, 10);
            const toDate = requestedTo || defaultTo;
            const trendDays = buildDateSeries(fromDate, toDate);
            const trendMap = new Map(trendDays.map((day) => [day, { day, appointments: 0, walkin: 0, checkup: 0, mental: 0, pharmacy: 0 }]));

            const [patientTotalsRows] = await pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS total_patients, SUM(CASE WHEN LOWER(COALESCE(risk_level, '')) = 'high' THEN 1 ELSE 0 END) AS high_risk, SUM(CASE WHEN appointment_count > 0 OR walkin_count > 0 OR checkup_count > 0 OR mental_count > 0 OR pharmacy_count > 0 THEN 1 ELSE 0 END) AS active_profiles FROM patient_master`
            );

            const [appointmentsRows] = await pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS total, SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('pending', 'new') THEN 1 ELSE 0 END) AS pending
               FROM patient_appointments
               WHERE appointment_date BETWEEN ? AND ?`,
              [fromDate, toDate]
            );
            const [walkinRows] = await pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS total,
                      SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'emergency' OR LOWER(COALESCE(severity, '')) = 'emergency' THEN 1 ELSE 0 END) AS emergency
               FROM patient_walkins
               WHERE DATE(COALESCE(checkin_time, intake_time, created_at)) BETWEEN ? AND ?`,
              [fromDate, toDate]
            );
            const [checkupRows] = await pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS total,
                      SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'in_consultation' THEN 1 ELSE 0 END) AS in_consultation
               FROM checkup_visits
               WHERE DATE(created_at) BETWEEN ? AND ?`,
              [fromDate, toDate]
            );
            const [mentalRows] = await pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS total,
                      SUM(CASE WHEN LOWER(COALESCE(risk_level, '')) = 'high' OR LOWER(COALESCE(status, '')) IN ('at_risk', 'escalated') THEN 1 ELSE 0 END) AS at_risk
               FROM mental_health_sessions
               WHERE DATE(created_at) BETWEEN ? AND ?`,
              [fromDate, toDate]
            );
            const [pharmacyRows] = await pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS total
               FROM pharmacy_dispense_requests
               WHERE DATE(requested_at) BETWEEN ? AND ?`,
              [fromDate, toDate]
            );

            const trendQueries: Array<[string, string, 'appointments' | 'walkin' | 'checkup' | 'mental' | 'pharmacy']> = [
              [`SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS day, COUNT(*) AS total FROM patient_appointments WHERE appointment_date BETWEEN ? AND ? GROUP BY DATE_FORMAT(appointment_date, '%Y-%m-%d')`, 'appointments', 'appointments'],
              [`SELECT DATE_FORMAT(DATE(COALESCE(checkin_time, intake_time, created_at)), '%Y-%m-%d') AS day, COUNT(*) AS total FROM patient_walkins WHERE DATE(COALESCE(checkin_time, intake_time, created_at)) BETWEEN ? AND ? GROUP BY DATE_FORMAT(DATE(COALESCE(checkin_time, intake_time, created_at)), '%Y-%m-%d')`, 'walkin', 'walkin'],
              [`SELECT DATE_FORMAT(DATE(created_at), '%Y-%m-%d') AS day, COUNT(*) AS total FROM checkup_visits WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE_FORMAT(DATE(created_at), '%Y-%m-%d')`, 'checkup', 'checkup'],
              [`SELECT DATE_FORMAT(DATE(created_at), '%Y-%m-%d') AS day, COUNT(*) AS total FROM mental_health_sessions WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE_FORMAT(DATE(created_at), '%Y-%m-%d')`, 'mental', 'mental'],
              [`SELECT DATE_FORMAT(DATE(requested_at), '%Y-%m-%d') AS day, COUNT(*) AS total FROM pharmacy_dispense_requests WHERE DATE(requested_at) BETWEEN ? AND ? GROUP BY DATE_FORMAT(DATE(requested_at), '%Y-%m-%d')`, 'pharmacy', 'pharmacy']
            ];

            for (const [query, , metricKey] of trendQueries) {
              const [trendRows] = await pool.query<RowDataPacket[]>(query, [fromDate, toDate]);
              for (const row of trendRows) {
                const bucket = trendMap.get(String(row.day || ''));
                if (bucket) bucket[metricKey] = Number(row.total || 0);
              }
            }

            const [activityRows] = await pool.query<RowDataPacket[]>(
              `SELECT module, action, detail, actor, created_at
               FROM module_activity_logs
               ORDER BY created_at DESC
               LIMIT 20`
            );

            writeJson(res, 200, {
              ok: true,
              data: {
                window: { from: fromDate, to: toDate },
                kpis: {
                  totalPatients: Number(patientTotalsRows[0]?.total_patients || 0),
                  activeProfiles: Number(patientTotalsRows[0]?.active_profiles || 0),
                  highRiskPatients: Number(patientTotalsRows[0]?.high_risk || 0),
                  totalVisits: Number(appointmentsRows[0]?.total || 0) + Number(walkinRows[0]?.total || 0) + Number(checkupRows[0]?.total || 0) + Number(mentalRows[0]?.total || 0),
                  pendingQueue: Number(appointmentsRows[0]?.pending || 0) + Number(checkupRows[0]?.in_consultation || 0),
                  emergencyCases: Number(walkinRows[0]?.emergency || 0) + Number(mentalRows[0]?.at_risk || 0),
                  dispensedItems: Number(pharmacyRows[0]?.total || 0)
                },
                moduleTotals: [
                  { module: 'Appointments', total: Number(appointmentsRows[0]?.total || 0) },
                  { module: 'Walk-In', total: Number(walkinRows[0]?.total || 0) },
                  { module: 'Check-Up', total: Number(checkupRows[0]?.total || 0) },
                  { module: 'Mental Health', total: Number(mentalRows[0]?.total || 0) },
                  { module: 'Pharmacy', total: Number(pharmacyRows[0]?.total || 0) }
                ],
                dailyTrend: Array.from(trendMap.values()),
                recentActivity: activityRows.map((row) => ({
                  module: String(row.module || ''),
                  action: String(row.action || ''),
                  detail: String(row.detail || ''),
                  actor: String(row.actor || ''),
                  created_at: formatDateTimeCell(row.created_at)
                }))
              }
            });
            return;
          }

          if (url.pathname === '/api/dashboard' && (req.method || 'GET').toUpperCase() === 'GET') {
            await ensurePatientAppointmentsTable(pool);
            await ensurePatientMasterTables(pool);

            const [summaryRows] = await pool.query<RowDataPacket[]>(
              `SELECT
                 (SELECT COUNT(*) FROM patient_master) AS total_patients,
                 (SELECT COUNT(*) FROM patient_appointments) AS total_appointments,
                 (SELECT COUNT(*) FROM patient_appointments WHERE appointment_date = CURDATE()) AS today_appointments,
                 (SELECT COUNT(*) FROM patient_appointments WHERE LOWER(COALESCE(status, '')) IN ('pending', 'new', 'awaiting')) AS pending_appointments,
                 (SELECT COUNT(*) FROM patient_appointments WHERE LOWER(COALESCE(status, '')) = 'completed' AND DATE(updated_at) = CURDATE()) AS completed_today,
                 (SELECT COUNT(*) FROM patient_master WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS new_patients_month`
            );
            const summary = summaryRows[0] || {};

            const monthSeries = buildRecentMonthSeries(6);
            const monthCounts = new Map(monthSeries.map((item) => [item.key, 0]));
            const [trendRows] = await pool.query<RowDataPacket[]>(
              `SELECT DATE_FORMAT(appointment_date, '%b') AS label, LOWER(DATE_FORMAT(appointment_date, '%b')) AS month_key, COUNT(*) AS total
               FROM patient_appointments
               WHERE appointment_date >= ? AND appointment_date < ?
               GROUP BY DATE_FORMAT(appointment_date, '%Y-%m'), DATE_FORMAT(appointment_date, '%b')
               ORDER BY MIN(appointment_date)`,
              [monthSeries[0]?.start || currentDateString(), monthSeries[monthSeries.length - 1]?.end || currentDateString()]
            );
            trendRows.forEach((row) => {
              monthCounts.set(String(row.month_key || ''), Number(row.total || 0));
            });

            const [statusRows] = await pool.query<RowDataPacket[]>(
              `SELECT COALESCE(NULLIF(TRIM(status), ''), 'Pending') AS label, COUNT(*) AS total
               FROM patient_appointments
               GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'Pending')
               ORDER BY total DESC`
            );
            const [deptRows] = await pool.query<RowDataPacket[]>(
              `SELECT COALESCE(NULLIF(TRIM(department_name), ''), 'General') AS label, COUNT(*) AS total
               FROM patient_appointments
               GROUP BY COALESCE(NULLIF(TRIM(department_name), ''), 'General')
               ORDER BY total DESC
               LIMIT 6`
            );
            const [upcomingRows] = await pool.query<RowDataPacket[]>(
              `SELECT booking_id, patient_name, doctor_name, department_name, appointment_date, preferred_time, status
               FROM patient_appointments
               WHERE appointment_date >= CURDATE()
               ORDER BY appointment_date ASC, COALESCE(preferred_time, '99:99') ASC
               LIMIT 8`
            );
            const [recentRows] = await pool.query<RowDataPacket[]>(
              `SELECT patient_code, patient_name, COALESCE(sex, '') AS sex, created_at
               FROM patient_master
               ORDER BY created_at DESC
               LIMIT 8`
            );

            writeJson(res, 200, {
              ok: true,
              data: {
                generatedAt: new Date().toISOString(),
                summary: {
                  totalPatients: Number(summary.total_patients || 0),
                  totalAppointments: Number(summary.total_appointments || 0),
                  todayAppointments: Number(summary.today_appointments || 0),
                  pendingAppointments: Number(summary.pending_appointments || 0),
                  completedToday: Number(summary.completed_today || 0),
                  newPatientsThisMonth: Number(summary.new_patients_month || 0)
                },
                appointmentsTrend: monthSeries.map((item) => ({
                  key: item.key,
                  label: item.label,
                  total: Number(monthCounts.get(item.key) || 0)
                })),
                statusBreakdown: statusRows.map((row) => ({ label: String(row.label || ''), total: Number(row.total || 0) })),
                departmentBreakdown: deptRows.map((row) => ({ label: String(row.label || ''), total: Number(row.total || 0) })),
                upcomingAppointments: upcomingRows.map((row) => ({
                  bookingId: String(row.booking_id || ''),
                  patientName: String(row.patient_name || ''),
                  doctorName: String(row.doctor_name || ''),
                  department: String(row.department_name || ''),
                  appointmentDate: formatDateCell(row.appointment_date),
                  preferredTime: String(row.preferred_time || ''),
                  status: String(row.status || '')
                })),
                recentPatients: recentRows.map((row) => ({
                  patientId: String(row.patient_code || ''),
                  patientName: String(row.patient_name || ''),
                  patientGender: String(row.sex || ''),
                  createdAt: formatDateTimeCell(row.created_at)
                }))
              }
            });
            return;
          }

          if (url.pathname === '/api/registrations') {
            await ensurePatientRegistrationsTable(pool);

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const search = toSafeText(url.searchParams.get('search'));
              const status = toSafeText(url.searchParams.get('status'));
              const sort = toSafeText(url.searchParams.get('sort') || 'Sort Latest Intake');
              const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
              const perPage = Math.min(50, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 10)));
              const offset = (page - 1) * perPage;
              const where: string[] = [];
              const params: unknown[] = [];

              if (search) {
                const searchLike = `%${search.toLowerCase()}%`;
                where.push('(LOWER(patient_name) LIKE ? OR LOWER(COALESCE(patient_email, "")) LIKE ? OR LOWER(COALESCE(concern, "")) LIKE ? OR LOWER(COALESCE(assigned_to, "")) LIKE ? OR LOWER(case_id) LIKE ?)');
                params.push(searchLike, searchLike, searchLike, searchLike, searchLike);
              }
              if (status && status.toLowerCase() !== 'all statuses') {
                where.push('LOWER(status) = ?');
                params.push(status.toLowerCase());
              }

              let orderBy = ' ORDER BY intake_time DESC';
              if (sort === 'Sort Name A-Z') orderBy = ' ORDER BY patient_name ASC';
              if (sort === 'Sort Name Z-A') orderBy = ' ORDER BY patient_name DESC';
              const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

              const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_registrations${whereSql}`, params);
              const total = Number(countRows[0]?.total || 0);
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id, case_id, patient_name, patient_type, patient_email, age, concern, intake_time, booked_time, status, assigned_to
                 FROM patient_registrations${whereSql}${orderBy}
                 LIMIT ? OFFSET ?`,
                [...params, perPage, offset]
              );
              const [pendingRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_registrations WHERE LOWER(status) = 'pending'`);
              const [activeRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_registrations WHERE LOWER(status) = 'active'`);
              const [concernRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_registrations WHERE COALESCE(TRIM(concern), '') <> ''`);
              const [totalRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_registrations`);
              const active = Number(activeRows[0]?.total || 0);
              const totalAll = Number(totalRows[0]?.total || 0);

              writeJson(res, 200, {
                ok: true,
                data: {
                  analytics: {
                    pending: Number(pendingRows[0]?.total || 0),
                    active,
                    concerns: Number(concernRows[0]?.total || 0),
                    approvalRate: totalAll > 0 ? Math.round((active / totalAll) * 100) : 0
                  },
                  items: rows.map(mapRegistrationRow),
                  meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const id = toSafeInt(body.id, 0);
              const actor = toSafeText(body.actor) || 'System';

              if (action === 'create') {
                const patientName = toSafeText(body.patient_name);
                if (!patientName) {
                  writeJson(res, 422, { ok: false, message: 'patient_name is required.' });
                  return;
                }
                const now = new Date();
                const caseId = `REG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
                await pool.query(
                  `INSERT INTO patient_registrations (case_id, patient_name, patient_type, patient_email, age, concern, intake_time, booked_time, status, assigned_to)
                   VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), ?, ?)`,
                  [
                    caseId,
                    patientName,
                    inferPatientType({ patientType: body.patient_type, patientName, patientEmail: body.patient_email, concern: body.concern, age: body.age }),
                    toSafeText(body.patient_email) || null,
                    body.age ?? null,
                    toSafeText(body.concern) || null,
                    toMysqlDateTime(body.intake_time),
                    toMysqlDateTime(body.booked_time),
                    toSafeText(body.status || 'Pending') || 'Pending',
                    toSafeText(body.assigned_to || 'Unassigned') || 'Unassigned'
                  ]
                );
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM patient_registrations WHERE case_id = ? LIMIT 1`, [caseId]);
                await insertModuleActivity(pool, 'registration', 'Registration Created', `Registration ${caseId} created for ${patientName}.`, actor, 'registration', caseId);
                writeJson(res, 200, { ok: true, message: 'Registration created.', data: rows[0] ? mapRegistrationRow(rows[0]) : null });
                return;
              }

              if (!id) {
                writeJson(res, 422, { ok: false, message: 'id is required.' });
                return;
              }

              if (action === 'update') {
                await pool.query(
                  `UPDATE patient_registrations
                   SET patient_name = COALESCE(?, patient_name),
                       patient_type = COALESCE(NULLIF(?, ''), patient_type),
                       patient_email = ?,
                       age = ?,
                       concern = ?,
                       intake_time = COALESCE(?, intake_time),
                       booked_time = COALESCE(?, booked_time),
                       status = COALESCE(?, status),
                       assigned_to = COALESCE(?, assigned_to),
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [
                    toSafeText(body.patient_name) || null,
                    inferPatientType({ patientType: body.patient_type, patientName: body.patient_name, patientEmail: body.patient_email, concern: body.concern, age: body.age }),
                    toSafeText(body.patient_email) || null,
                    body.age ?? null,
                    toSafeText(body.concern) || null,
                    toMysqlDateTime(body.intake_time),
                    toMysqlDateTime(body.booked_time),
                    toSafeText(body.status) || null,
                    toSafeText(body.assigned_to) || null,
                    id
                  ]
                );
                const updated = await selectRegistrationById(pool, id);
                if (!updated) {
                  writeJson(res, 404, { ok: false, message: 'Registration not found.' });
                  return;
                }
                await insertModuleActivity(pool, 'registration', 'Registration Updated', `Registration ${updated.case_id} updated.`, actor, 'registration', String(updated.case_id));
                writeJson(res, 200, { ok: true, message: 'Registration updated.', data: mapRegistrationRow(updated) });
                return;
              }

              if (action === 'approve' || action === 'set_status') {
                const targetStatus = action === 'approve' ? 'Active' : toSafeText(body.status);
                if (!['pending', 'review', 'active', 'archived'].includes(targetStatus.toLowerCase())) {
                  writeJson(res, 422, { ok: false, message: 'Invalid status transition target.' });
                  return;
                }
                await pool.query(`UPDATE patient_registrations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [targetStatus, id]);
                const updated = await selectRegistrationById(pool, id);
                if (!updated) {
                  writeJson(res, 404, { ok: false, message: 'Registration not found.' });
                  return;
                }
                await insertModuleActivity(pool, 'registration', action === 'approve' ? 'Registration Approved' : 'Registration Status Updated', `Registration ${updated.case_id} status set to ${targetStatus}.`, actor, 'registration', String(updated.case_id));
                writeJson(res, 200, { ok: true, message: `Registration status updated to ${targetStatus}.`, data: mapRegistrationRow(updated) });
                return;
              }

              if (action === 'assign') {
                const assignedTo = toSafeText(body.assigned_to);
                if (!assignedTo) {
                  writeJson(res, 422, { ok: false, message: 'assigned_to is required.' });
                  return;
                }
                await pool.query(`UPDATE patient_registrations SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [assignedTo, id]);
                const updated = await selectRegistrationById(pool, id);
                if (!updated) {
                  writeJson(res, 404, { ok: false, message: 'Registration not found.' });
                  return;
                }
                await insertModuleActivity(pool, 'registration', 'Registration Assigned', `Registration ${updated.case_id} assigned to ${assignedTo}.`, actor, 'registration', String(updated.case_id));
                writeJson(res, 200, { ok: true, message: 'Registration reassigned.', data: mapRegistrationRow(updated) });
                return;
              }

              if (action === 'reject' || action === 'archive') {
                const reason = toSafeText(body.reason);
                if (!reason) {
                  writeJson(res, 422, { ok: false, message: 'reason is required.' });
                  return;
                }
                const existing = await selectRegistrationById(pool, id);
                if (!existing) {
                  writeJson(res, 404, { ok: false, message: 'Registration not found.' });
                  return;
                }
                const reasonLabel = action === 'reject' ? 'Rejection' : 'Archive';
                const nextConcern = `${toSafeText(existing.concern || 'No concern')} | ${reasonLabel}: ${reason}`;
                await pool.query(`UPDATE patient_registrations SET status = 'Archived', concern = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [nextConcern, id]);
                const updated = await selectRegistrationById(pool, id);
                await insertModuleActivity(pool, 'registration', action === 'reject' ? 'Registration Rejected' : 'Registration Archived', `${action === 'reject' ? 'Rejected' : 'Archived'} registration ${existing.case_id}. Reason: ${reason}`, actor, 'registration', String(existing.case_id));
                writeJson(res, 200, { ok: true, message: action === 'reject' ? 'Registration rejected.' : 'Registration archived.', data: updated ? mapRegistrationRow(updated) : null });
                return;
              }

              writeJson(res, 422, { ok: false, message: 'Unsupported action.' });
              return;
            }
          }

          if (url.pathname === '/api/walk-ins') {
            await ensurePatientWalkinsTable(pool);

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const search = toSafeText(url.searchParams.get('search'));
              const status = toSafeText(url.searchParams.get('status'));
              const severity = toSafeText(url.searchParams.get('severity'));
              const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
              const perPage = Math.min(50, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 10)));
              const offset = (page - 1) * perPage;
              const where: string[] = [];
              const params: unknown[] = [];

              if (search) {
                const searchLike = `%${search.toLowerCase()}%`;
                where.push('(LOWER(case_id) LIKE ? OR LOWER(patient_name) LIKE ? OR LOWER(COALESCE(contact, "")) LIKE ? OR LOWER(COALESCE(chief_complaint, "")) LIKE ? OR LOWER(COALESCE(assigned_doctor, "")) LIKE ?)');
                params.push(searchLike, searchLike, searchLike, searchLike, searchLike);
              }
              if (status && status.toLowerCase() !== 'all') {
                where.push('LOWER(status) = ?');
                params.push(status.toLowerCase());
              }
              if (severity && severity.toLowerCase() !== 'all') {
                where.push('LOWER(severity) = ?');
                params.push(severity.toLowerCase());
              }

              const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
              const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_walkins${whereSql}`, params);
              const total = Number(countRows[0]?.total || 0);
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id, case_id, patient_name, patient_type, age, sex, date_of_birth, contact, address, emergency_contact, patient_ref, visit_department, checkin_time,
                        pain_scale, temperature_c, blood_pressure, pulse_bpm, weight_kg, chief_complaint, severity, intake_time, assigned_doctor, status
                 FROM patient_walkins${whereSql}
                 ORDER BY
                   CASE WHEN status = 'emergency' OR severity = 'Emergency' THEN 0 ELSE 1 END ASC,
                   CASE severity WHEN 'Emergency' THEN 0 WHEN 'Moderate' THEN 1 ELSE 2 END ASC,
                   intake_time ASC
                 LIMIT ? OFFSET ?`,
                [...params, perPage, offset]
              );
              const [analyticsRows] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) AS all_count,
                        SUM(CASE WHEN status = 'triage_pending' THEN 1 ELSE 0 END) AS triage_count,
                        SUM(CASE WHEN status = 'waiting_for_doctor' THEN 1 ELSE 0 END) AS doctor_count,
                        SUM(CASE WHEN status = 'emergency' THEN 1 ELSE 0 END) AS emergency_count,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
                 FROM patient_walkins`
              );
              const analytics = analyticsRows[0] || {};

              writeJson(res, 200, {
                ok: true,
                data: {
                  analytics: {
                    all: Number(analytics.all_count || 0),
                    triage: Number(analytics.triage_count || 0),
                    doctor: Number(analytics.doctor_count || 0),
                    emergency: Number(analytics.emergency_count || 0),
                    completed: Number(analytics.completed_count || 0)
                  },
                  items: rows.map(mapWalkinRow),
                  meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const actor = toSafeText(body.actor) || 'System';
              const logWalkin = async (actionLabel: string, detail: string, caseKey: string): Promise<void> => {
                await insertModuleActivity(pool, 'walkin', actionLabel, detail, actor, 'walkin_case', caseKey);
              };

              if (action === 'create') {
                const patientName = toSafeText(body.patient_name);
                if (!patientName) {
                  writeJson(res, 422, { ok: false, message: 'patient_name is required.' });
                  return;
                }
                const now = new Date();
                const caseId = `WALK-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${Math.floor(100 + Math.random() * 900)}`;
                await pool.query(
                  `INSERT INTO patient_walkins (
                     case_id, patient_name, patient_type, age, sex, date_of_birth, contact, address, emergency_contact, patient_ref, visit_department,
                     checkin_time, pain_scale, temperature_c, blood_pressure, pulse_bpm, weight_kg, chief_complaint, severity, intake_time, assigned_doctor, status
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, 'waiting')`,
                  [
                    caseId,
                    patientName,
                    inferPatientType({ patientType: body.patient_type, patientName, patientId: body.patient_ref, age: body.age, concern: body.chief_complaint }),
                    body.age ?? null,
                    toSafeText(body.sex) || null,
                    toMysqlDate(body.date_of_birth),
                    toSafeText(body.contact) || null,
                    toSafeText(body.address) || null,
                    toSafeText(body.emergency_contact) || null,
                    toSafeText(body.patient_ref) || null,
                    toSafeText(body.visit_department) || null,
                    toMysqlDateTime(body.checkin_time),
                    body.pain_scale ?? null,
                    body.temperature_c ?? null,
                    toSafeText(body.blood_pressure) || null,
                    body.pulse_bpm ?? null,
                    body.weight_kg ?? null,
                    toSafeText(body.chief_complaint) || null,
                    toSafeText(body.severity || 'Low') || 'Low',
                    toMysqlDateTime(body.checkin_time),
                    toSafeText(body.assigned_doctor || 'Nurse Triage') || 'Nurse Triage'
                  ]
                );
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM patient_walkins WHERE case_id = ? LIMIT 1`, [caseId]);
                await logWalkin('Walk-In Created', `Walk-in case ${caseId} created for ${patientName}.`, caseId);
                writeJson(res, 200, { ok: true, message: 'Walk-in created.', data: rows[0] ? mapWalkinRow(rows[0]) : null });
                return;
              }

              const id = toSafeInt(body.id, 0);
              if (!id) {
                writeJson(res, 422, { ok: false, message: 'id is required.' });
                return;
              }
              const current = await selectWalkinById(pool, id);
              if (!current) {
                writeJson(res, 404, { ok: false, message: 'Walk-in case not found.' });
                return;
              }
              const currentStatus = String(current.status || '');

              if (action === 'identify') {
                if (currentStatus !== 'waiting') {
                  writeJson(res, 422, { ok: false, message: 'Only waiting patients can be identified.' });
                  return;
                }
                await pool.query(`UPDATE patient_walkins SET status = 'identified', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'queue_triage') {
                if (currentStatus !== 'identified') {
                  writeJson(res, 422, { ok: false, message: 'Only identified patients can be moved to triage_pending.' });
                  return;
                }
                await pool.query(`UPDATE patient_walkins SET status = 'triage_pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'start_triage') {
                if (currentStatus !== 'triage_pending') {
                  writeJson(res, 422, { ok: false, message: 'Start triage is only allowed from triage_pending.' });
                  return;
                }
                await pool.query(`UPDATE patient_walkins SET status = 'in_triage', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'triage') {
                if (currentStatus !== 'in_triage') {
                  writeJson(res, 422, { ok: false, message: 'Save triage is only allowed from in_triage.' });
                  return;
                }
                const severityValue = toSafeText(body.severity || 'Low') || 'Low';
                const nextStatus = severityValue === 'Emergency' ? 'emergency' : 'waiting_for_doctor';
                await pool.query(
                  `UPDATE patient_walkins
                   SET chief_complaint = COALESCE(?, chief_complaint),
                       severity = ?,
                       status = ?,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [toSafeText(body.chief_complaint) || null, severityValue, nextStatus, id]
                );
              } else if (action === 'assign') {
                if (currentStatus !== 'waiting_for_doctor') {
                  writeJson(res, 422, { ok: false, message: 'Doctor assignment requires waiting_for_doctor status.' });
                  return;
                }
                await pool.query(
                  `UPDATE patient_walkins SET assigned_doctor = COALESCE(?, assigned_doctor), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [toSafeText(body.assigned_doctor) || null, id]
                );
              } else if (action === 'complete') {
                if (currentStatus !== 'waiting_for_doctor') {
                  writeJson(res, 422, { ok: false, message: 'Case can only be completed after doctor queue stage.' });
                  return;
                }
                await pool.query(`UPDATE patient_walkins SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'emergency') {
                if (currentStatus === 'completed') {
                  writeJson(res, 422, { ok: false, message: 'Completed case cannot be escalated to emergency.' });
                  return;
                }
                await pool.query(`UPDATE patient_walkins SET status = 'emergency', severity = 'Emergency', assigned_doctor = 'ER Team', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else {
                writeJson(res, 422, { ok: false, message: 'Unsupported action.' });
                return;
              }

              const updated = await selectWalkinById(pool, id);
              const caseKey = toSafeText(updated?.case_id || id);
              await logWalkin(action.replace(/_/g, ' '), `Walk-in action ${action} applied to ${caseKey}.`, caseKey);
              writeJson(res, 200, { ok: true, data: updated ? mapWalkinRow(updated) : null });
              return;
            }
          }

          if (url.pathname === '/api/checkups') {
            await ensureCheckupVisitsTable(pool);

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const search = toSafeText(url.searchParams.get('search'));
              const status = toSafeText(url.searchParams.get('status'));
              const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
              const perPage = Math.min(50, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 10)));
              const offset = (page - 1) * perPage;
              const where: string[] = [];
              const params: unknown[] = [];

              if (search) {
                const searchLike = `%${search.toLowerCase()}%`;
                where.push('(LOWER(visit_id) LIKE ? OR LOWER(patient_name) LIKE ? OR LOWER(COALESCE(chief_complaint, "")) LIKE ? OR LOWER(COALESCE(assigned_doctor, "")) LIKE ?)');
                params.push(searchLike, searchLike, searchLike, searchLike);
              }
              if (status && status.toLowerCase() !== 'all') {
                where.push('LOWER(status) = ?');
                params.push(status.toLowerCase());
              }

              const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
              const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits${whereSql}`, params);
              const total = Number(countRows[0]?.total || 0);
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT id, visit_id, patient_name, patient_type, assigned_doctor, source, status, chief_complaint, diagnosis, clinical_notes, consultation_started_at,
                        lab_requested, lab_result_ready, prescription_created, prescription_dispensed, follow_up_date, is_emergency, version, created_at, updated_at
                 FROM checkup_visits${whereSql}
                 ORDER BY CASE WHEN is_emergency = 1 THEN 0 ELSE 1 END ASC, updated_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, perPage, offset]
              );
              const [intakeRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'intake' AND is_emergency = 0`);
              const [queueRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'queue' AND is_emergency = 0`);
              const [assignedRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'doctor_assigned' AND is_emergency = 0`);
              const [consultRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'in_consultation' AND is_emergency = 0`);
              const [labRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'lab_requested' AND is_emergency = 0`);
              const [pharmacyRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'pharmacy' AND is_emergency = 0`);
              const [completedRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE status = 'completed'`);
              const [emergencyRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkup_visits WHERE is_emergency = 1 AND status <> 'archived'`);

              writeJson(res, 200, {
                ok: true,
                data: {
                  items: rows.map(mapCheckupRow),
                  analytics: {
                    intake: Number(intakeRows[0]?.total || 0),
                    queue: Number(queueRows[0]?.total || 0),
                    doctorAssigned: Number(assignedRows[0]?.total || 0),
                    inConsultation: Number(consultRows[0]?.total || 0),
                    labRequested: Number(labRows[0]?.total || 0),
                    pharmacy: Number(pharmacyRows[0]?.total || 0),
                    completed: Number(completedRows[0]?.total || 0),
                    emergency: Number(emergencyRows[0]?.total || 0)
                  },
                  meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const id = toSafeInt(body.id, 0);
              const expectedVersion = toSafeInt(body.expectedVersion, 0);
              if (!id) {
                writeJson(res, 422, { ok: false, message: 'id is required.' });
                return;
              }
              const current = await selectCheckupById(pool, id);
              if (!current) {
                writeJson(res, 404, { ok: false, message: 'Visit not found.' });
                return;
              }
              const currentStatus = toSafeText(current.status).toLowerCase();
              const currentVersion = Number(current.version || 1);
              if (expectedVersion > 0 && expectedVersion !== currentVersion) {
                writeJson(res, 409, { ok: false, message: 'Visit has been updated by another user. Please refresh.' });
                return;
              }

              const fail = (message: string): void => writeJson(res, 422, { ok: false, message });

              if (action === 'queue') {
                if (currentStatus !== 'intake') return fail('Only intake visits can be queued.');
                await pool.query(`UPDATE checkup_visits SET status = 'queue', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'assign_doctor') {
                const assignedDoctor = toSafeText(body.assigned_doctor);
                if (!assignedDoctor) return fail('assigned_doctor is required.');
                if (!['queue', 'doctor_assigned', 'in_consultation'].includes(currentStatus)) return fail('Doctor assignment is allowed only for queue/assigned/in_consultation states.');
                await pool.query(`UPDATE checkup_visits SET assigned_doctor = ?, status = CASE WHEN status = 'queue' THEN 'doctor_assigned' ELSE status END, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [assignedDoctor, id]);
              } else if (action === 'start_consultation') {
                if (!['doctor_assigned', 'queue'].includes(currentStatus)) return fail('Consultation can start only from doctor_assigned or queue.');
                await pool.query(`UPDATE checkup_visits SET status = 'in_consultation', consultation_started_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'save_consultation') {
                const diagnosis = toSafeText(body.diagnosis);
                const notes = toSafeText(body.clinical_notes);
                if (!diagnosis || !notes) return fail('diagnosis and clinical_notes are required.');
                if (!['in_consultation', 'lab_requested'].includes(currentStatus)) return fail('Consultation save is allowed only during consultation/lab stage.');
                await pool.query(`UPDATE checkup_visits SET diagnosis = ?, clinical_notes = ?, follow_up_date = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [diagnosis, notes, toMysqlDate(body.follow_up_date), id]);
              } else if (action === 'request_lab') {
                if (!['in_consultation', 'doctor_assigned'].includes(currentStatus)) return fail('Lab can only be requested during doctor consultation flow.');
                await pool.query(`UPDATE checkup_visits SET status = 'lab_requested', lab_requested = 1, lab_result_ready = 0, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'mark_lab_ready') {
                if (currentStatus !== 'lab_requested') return fail('Only lab_requested visits can be marked as lab ready.');
                await pool.query(`UPDATE checkup_visits SET status = 'in_consultation', lab_result_ready = 1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'send_pharmacy') {
                if (!['in_consultation', 'doctor_assigned'].includes(currentStatus)) return fail('Pharmacy routing requires active consultation.');
                await pool.query(`UPDATE checkup_visits SET status = 'pharmacy', prescription_created = 1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'mark_dispensed') {
                if (currentStatus !== 'pharmacy') return fail('Only pharmacy state can be dispensed.');
                await pool.query(`UPDATE checkup_visits SET prescription_dispensed = 1, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'complete') {
                if (!['in_consultation', 'pharmacy'].includes(currentStatus)) return fail('Only in_consultation or pharmacy visits can be completed.');
                if (!toSafeText(current.diagnosis) || !toSafeText(current.clinical_notes)) return fail('Diagnosis and clinical notes are required before completion.');
                if (toBooleanFlag(current.lab_requested) && !toBooleanFlag(current.lab_result_ready)) return fail('Lab result must be ready before completion.');
                await pool.query(`UPDATE checkup_visits SET status = 'completed', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'archive') {
                if (currentStatus !== 'completed') return fail('Only completed visits can be archived.');
                await pool.query(`UPDATE checkup_visits SET status = 'archived', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'reopen') {
                if (!['completed', 'archived'].includes(currentStatus)) return fail('Only completed or archived visits can be reopened.');
                await pool.query(`UPDATE checkup_visits SET status = 'in_consultation', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else if (action === 'escalate_emergency') {
                if (currentStatus === 'archived') return fail('Archived visits cannot be escalated.');
                await pool.query(`UPDATE checkup_visits SET is_emergency = 1, status = 'in_consultation', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
              } else {
                return fail('Unsupported check-up action.');
              }

              const updated = await selectCheckupById(pool, id);
              await insertModuleActivity(pool, 'checkup', `Checkup ${action}`, `Check-up action ${action} applied to visit ${toSafeText(updated?.visit_id || id)}.`, toSafeText(body.actor) || 'System', 'checkup_visit', toSafeText(updated?.visit_id || id), { action, id });
              writeJson(res, 200, { ok: true, data: updated ? mapCheckupRow(updated) : null });
              return;
            }
          }

          if (url.pathname === '/api/laboratory') {
            await ensureLaboratoryTables(pool);

            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const requestId = toSafeInt(url.searchParams.get('request_id'), 0);
              const mode = toSafeText(url.searchParams.get('mode')).toLowerCase();
              if (requestId > 0 && mode === 'detail') {
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [requestId]);
                if (!rows[0]) {
                  writeJson(res, 404, { ok: false, message: 'Laboratory request not found.' });
                  return;
                }
                writeJson(res, 200, { ok: true, data: mapLabDetailRow(rows[0]) });
                return;
              }
              if (requestId > 0 && mode === 'activity') {
                const [logs] = await pool.query<RowDataPacket[]>(`SELECT id, request_id, action, details, actor, created_at FROM laboratory_activity_logs WHERE request_id = ? ORDER BY created_at DESC`, [requestId]);
                writeJson(res, 200, { ok: true, data: logs.map((row) => ({ ...row, created_at: formatDateTimeCell(row.created_at) })) });
                return;
              }

              const search = toSafeText(url.searchParams.get('search')).toLowerCase();
              const status = toSafeText(url.searchParams.get('status')).toLowerCase();
              const category = toSafeText(url.searchParams.get('category')).toLowerCase();
              const priority = toSafeText(url.searchParams.get('priority')).toLowerCase();
              const doctor = toSafeText(url.searchParams.get('doctor')).toLowerCase();
              const fromDate = toMysqlDate(url.searchParams.get('fromDate'));
              const toDate = toMysqlDate(url.searchParams.get('toDate'));
              const where: string[] = [];
              const params: unknown[] = [];
              if (search) {
                const like = `%${search}%`;
                where.push('(CAST(request_id AS CHAR) LIKE ? OR LOWER(patient_name) LIKE ? OR LOWER(visit_id) LIKE ? OR LOWER(patient_id) LIKE ? OR LOWER(category) LIKE ? OR LOWER(requested_by_doctor) LIKE ?)');
                params.push(like, like, like, like, like, like);
              }
              if (status && status !== 'all') {
                if (status === 'in_progress') where.push(`status IN ('In Progress', 'Result Ready')`);
                else if (status === 'completed') where.push(`status = 'Completed'`);
                else if (status === 'pending') where.push(`status = 'Pending'`);
              }
              if (category && category !== 'all') {
                where.push('LOWER(category) = ?');
                params.push(category);
              }
              if (priority && priority !== 'all') {
                where.push('LOWER(priority) = ?');
                params.push(priority);
              }
              if (doctor && doctor !== 'all') {
                where.push('LOWER(requested_by_doctor) = ?');
                params.push(doctor);
              }
              if (fromDate) {
                where.push('DATE(requested_at) >= ?');
                params.push(fromDate);
              }
              if (toDate) {
                where.push('DATE(requested_at) <= ?');
                params.push(toDate);
              }
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT request_id, visit_id, patient_id, patient_name, patient_type, category, priority, status, requested_at, requested_by_doctor
                 FROM laboratory_requests${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY requested_at DESC`,
                params
              );
              writeJson(res, 200, { ok: true, data: rows.map((row) => ({ ...row, requested_at: formatDateTimeCell(row.requested_at) })) });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const saveActivity = async (requestId: number, actionLabel: string, details: string, actor: string): Promise<void> => {
                await pool.query(`INSERT INTO laboratory_activity_logs (request_id, action, details, actor) VALUES (?, ?, ?, ?)`, [requestId, actionLabel, details, actor || 'Lab Staff']);
                await insertModuleActivity(pool, 'laboratory', actionLabel, details, actor || 'Lab Staff', 'lab_request', String(requestId));
              };

              if (action === 'create') {
                const patientName = toSafeText(body.patient_name);
                const categoryText = toSafeText(body.category);
                const requestedByDoctor = toSafeText(body.requested_by_doctor);
                if (!patientName || !categoryText || !requestedByDoctor) {
                  writeJson(res, 422, { ok: false, message: 'patient_name, category, requested_by_doctor are required.' });
                  return;
                }
                const [nextRows] = await pool.query<RowDataPacket[]>(`SELECT COALESCE(MAX(request_id), 1200) + 1 AS next_id FROM laboratory_requests`);
                const nextId = Number(nextRows[0]?.next_id || 1201);
                const tests = Array.isArray(body.tests) ? body.tests.map((item) => toSafeText(item)).filter(Boolean) : [`${categoryText} request`];
                await pool.query(
                  `INSERT INTO laboratory_requests (
                    request_id, visit_id, patient_id, patient_name, patient_type, age, sex, category, priority, status, requested_at,
                    requested_by_doctor, doctor_department, notes, tests, specimen_type, sample_source, collection_date_time,
                    clinical_diagnosis, lab_instructions, insurance_reference, billing_reference, assigned_lab_staff,
                    sample_collected, result_reference_range, verified_by, rejection_reason, resample_flag, raw_attachment_name, encoded_values
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '', '', 0, '', ?)` ,
                  [
                    nextId,
                    toSafeText(body.visit_id) || `VISIT-${new Date().getFullYear()}-${nextId}`,
                    toSafeText(body.patient_id) || `PAT-${nextId}`,
                    patientName,
                    inferPatientType({ patientType: body.patient_type, patientName, patientId: body.patient_id, age: body.age }),
                    toSafeInt(body.age, 0) || null,
                    toSafeText(body.sex) || null,
                    categoryText,
                    toSafeText(body.priority) || 'Normal',
                    requestedByDoctor,
                    toSafeText(body.doctor_department) || 'General Medicine',
                    toSafeText(body.notes) || null,
                    JSON.stringify(tests),
                    toSafeText(body.specimen_type) || 'Whole Blood',
                    toSafeText(body.sample_source) || 'Blood',
                    toMysqlDateTime(body.collection_date_time),
                    toSafeText(body.clinical_diagnosis) || null,
                    toSafeText(body.lab_instructions) || null,
                    toSafeText(body.insurance_reference) || null,
                    toSafeText(body.billing_reference) || null,
                    toSafeText(body.assigned_lab_staff) || 'Tech Anne',
                    JSON.stringify({})
                  ]
                );
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [nextId]);
                await saveActivity(nextId, 'Request Created', 'New lab request created from laboratory queue dashboard.', 'Lab Staff');
                await queueCashierIntegrationEvent(pool, {
                  sourceModule: 'laboratory',
                  sourceEntity: 'lab_request',
                  sourceKey: String(nextId),
                  patientName,
                  patientType: inferPatientType({ patientType: body.patient_type, patientName, patientId: body.patient_id, age: body.age }),
                  referenceNo: toSafeText(body.billing_reference) || `BILL-LAB-${nextId}`,
                  amountDue: toSafeMoney(body.amount_due, 0),
                  paymentStatus: normalizePaymentStatus(body.payment_status),
                  payload: {
                    requestId: nextId,
                    category: categoryText,
                    requestedByDoctor,
                    billingReference: toSafeText(body.billing_reference) || null
                  }
                });
                writeJson(res, 200, { ok: true, data: rows[0] ? mapLabDetailRow(rows[0]) : null });
                return;
              }

              const requestId = toSafeInt(body.request_id, 0);
              if (requestId <= 0) {
                writeJson(res, 422, { ok: false, message: 'request_id is required.' });
                return;
              }
              const [existingRows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [requestId]);
              const existing = existingRows[0];
              if (!existing) {
                writeJson(res, 404, { ok: false, message: 'Laboratory request not found.' });
                return;
              }

              if (action === 'start_processing') {
                const staff = toSafeText(body.lab_staff) || toSafeText(existing.assigned_lab_staff) || 'Lab Staff';
                await pool.query(
                  `UPDATE laboratory_requests
                   SET status = 'In Progress', assigned_lab_staff = ?, sample_collected = ?, sample_collected_at = CASE WHEN ? = 1 THEN COALESCE(?, CURRENT_TIMESTAMP) ELSE NULL END,
                       processing_started_at = COALESCE(?, CURRENT_TIMESTAMP), specimen_type = COALESCE(NULLIF(?, ''), specimen_type), sample_source = COALESCE(NULLIF(?, ''), sample_source),
                       collection_date_time = COALESCE(?, collection_date_time), updated_at = CURRENT_TIMESTAMP
                   WHERE request_id = ?`,
                  [staff, toBooleanFlag(body.sample_collected) ? 1 : 0, toBooleanFlag(body.sample_collected) ? 1 : 0, toMysqlDateTime(body.sample_collected_at), toMysqlDateTime(body.processing_started_at), toSafeText(body.specimen_type), toSafeText(body.sample_source), toMysqlDateTime(body.collection_date_time), requestId]
                );
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [requestId]);
                await saveActivity(requestId, 'Processing Started', 'Sample collected and processing started.', staff);
                writeJson(res, 200, { ok: true, data: rows[0] ? mapLabDetailRow(rows[0]) : null });
                return;
              }

              if (action === 'save_results') {
                const finalize = toBooleanFlag(body.finalize);
                const summary = toSafeText(body.summary) || (finalize ? 'Result is now ready for release.' : 'Encoded result draft saved.');
                await pool.query(
                  `UPDATE laboratory_requests
                   SET status = ?, raw_attachment_name = COALESCE(NULLIF(?, ''), raw_attachment_name), encoded_values = ?, result_encoded_at = CASE WHEN ? = 'Result Ready' THEN COALESCE(?, CURRENT_TIMESTAMP) ELSE result_encoded_at END,
                       result_reference_range = COALESCE(NULLIF(?, ''), result_reference_range), verified_by = CASE WHEN ? = 'Result Ready' THEN COALESCE(NULLIF(?, ''), verified_by, assigned_lab_staff) ELSE verified_by END,
                       verified_at = CASE WHEN ? = 'Result Ready' THEN COALESCE(?, CURRENT_TIMESTAMP) ELSE verified_at END, updated_at = CURRENT_TIMESTAMP
                   WHERE request_id = ?`,
                  [finalize ? 'Result Ready' : 'In Progress', toSafeText(body.attachment_name), JSON.stringify(parseJsonRecord(body.encoded_values)), finalize ? 'Result Ready' : 'In Progress', toMysqlDateTime(body.result_encoded_at), toSafeText(body.result_reference_range), finalize ? 'Result Ready' : 'In Progress', toSafeText(body.verified_by), finalize ? 'Result Ready' : 'In Progress', toMysqlDateTime(body.verified_at), requestId]
                );
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [requestId]);
                await saveActivity(requestId, finalize ? 'Result Finalized' : 'Draft Saved', summary, toSafeText(existing.assigned_lab_staff) || 'Lab Staff');
                writeJson(res, 200, { ok: true, data: rows[0] ? mapLabDetailRow(rows[0]) : null });
                return;
              }

              if (action === 'release') {
                if (toSafeText(existing.status) !== 'Result Ready') {
                  writeJson(res, 422, { ok: false, message: 'Only Result Ready requests can be released.' });
                  return;
                }
                await pool.query(`UPDATE laboratory_requests SET status = 'Completed', released_at = COALESCE(?, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [toMysqlDateTime(body.released_at), requestId]);
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [requestId]);
                await saveActivity(requestId, 'Report Released', 'Lab report released to doctor/check-up.', toSafeText(body.released_by) || 'Lab Staff');
                await queueCashierIntegrationEvent(pool, {
                  sourceModule: 'laboratory',
                  sourceEntity: 'lab_request',
                  sourceKey: String(requestId),
                  patientName: toSafeText(rows[0]?.patient_name),
                  patientType: toSafeText(rows[0]?.patient_type),
                  referenceNo: toSafeText(rows[0]?.billing_reference) || `BILL-LAB-${requestId}`,
                  amountDue: toSafeMoney(body.amount_due ?? rows[0]?.amount_due, 0),
                  paymentStatus: normalizePaymentStatus(body.payment_status),
                  payload: {
                    requestId,
                    category: toSafeText(rows[0]?.category),
                    status: 'Completed',
                    releasedAt: toSafeText(rows[0]?.released_at) || null
                  }
                });
                writeJson(res, 200, { ok: true, data: rows[0] ? mapLabDetailRow(rows[0]) : null });
                return;
              }

              if (action === 'reject') {
                const reason = toSafeText(body.reason);
                if (!reason) {
                  writeJson(res, 422, { ok: false, message: 'reason is required.' });
                  return;
                }
                await pool.query(`UPDATE laboratory_requests SET status = 'Cancelled', rejection_reason = ?, resample_flag = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [reason, toBooleanFlag(body.resample_flag) ? 1 : 0, requestId]);
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM laboratory_requests WHERE request_id = ? LIMIT 1`, [requestId]);
                await saveActivity(requestId, toBooleanFlag(body.resample_flag) ? 'Resample Requested' : 'Request Rejected', reason, toSafeText(body.actor) || 'Lab Staff');
                writeJson(res, 200, { ok: true, data: rows[0] ? mapLabDetailRow(rows[0]) : null });
                return;
              }

              writeJson(res, 422, { ok: false, message: 'Unsupported laboratory action.' });
              return;
            }
          }

          if (url.pathname === '/api/pharmacy') {
            await ensurePharmacyInventoryTables(pool);
            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const [medicines] = await pool.query<RowDataPacket[]>(`SELECT * FROM pharmacy_medicines WHERE is_archived = 0 ORDER BY medicine_name ASC`);
              const [requests] = await pool.query<RowDataPacket[]>(`SELECT r.*, m.medicine_name FROM pharmacy_dispense_requests r JOIN pharmacy_medicines m ON m.id = r.medicine_id ORDER BY r.requested_at DESC`);
              const [logs] = await pool.query<RowDataPacket[]>(`SELECT id, detail, actor, tone, created_at FROM pharmacy_activity_logs ORDER BY created_at DESC LIMIT 200`);
              const [movements] = await pool.query<RowDataPacket[]>(`SELECT id, medicine_id, movement_type, quantity_change, quantity_before, quantity_after, reason, batch_lot_no, stock_location, actor, created_at FROM pharmacy_stock_movements ORDER BY created_at DESC LIMIT 600`);
              writeJson(res, 200, { ok: true, data: { medicines, requests, logs, movements } });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const actor = toSafeText(body.role) || 'Pharmacist';
              const medicineId = toSafeInt(body.medicine_id, 0);
              const log = async (actionLabel: string, detail: string, tone = 'info'): Promise<void> => {
                await pool.query(`INSERT INTO pharmacy_activity_logs (action, detail, actor, tone) VALUES (?, ?, ?, ?)`, [actionLabel, detail, actor, tone]);
                await insertModuleActivity(pool, 'pharmacy', actionLabel, detail, actor, 'medicine', medicineId ? String(medicineId) : null);
              };
              const movement = async (id: number, movementType: string, delta: number, before: number, after: number, reason: string, batchLotNo: string | null, stockLocation: string | null): Promise<void> => {
                await pool.query(`INSERT INTO pharmacy_stock_movements (medicine_id, movement_type, quantity_change, quantity_before, quantity_after, reason, batch_lot_no, stock_location, actor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, movementType, delta, before, after, reason, batchLotNo, stockLocation, actor]);
              };

              if (action === 'save_draft') {
                await log('DRAFT', `${toSafeText(body.draft_type) || 'general'}: ${toSafeText(body.notes) || 'Draft saved'}`);
                writeJson(res, 200, { ok: true, message: 'Draft saved.' });
                return;
              }

              if (action === 'create_medicine') {
                const sku = toSafeText(body.sku);
                const medicineName = toSafeText(body.medicine_name);
                const batchLotNo = toSafeText(body.batch_lot_no);
                const expiryDate = toMysqlDate(body.expiry_date);
                if (!sku || !medicineName || !batchLotNo || !expiryDate) {
                  writeJson(res, 422, { ok: false, message: 'sku, medicine_name, batch_lot_no, and expiry_date are required.' });
                  return;
                }
                const [dupes] = await pool.query<RowDataPacket[]>(`SELECT id FROM pharmacy_medicines WHERE sku = ? LIMIT 1`, [sku]);
                if (dupes[0]) {
                  writeJson(res, 409, { ok: false, message: 'SKU already exists.' });
                  return;
                }
                const initialStock = Math.max(0, toSafeInt(body.stock_on_hand, 0));
                await pool.query(
                  `INSERT INTO pharmacy_medicines (medicine_code, sku, medicine_name, brand_name, generic_name, category, medicine_type, dosage_strength, unit_of_measure, supplier_name, purchase_cost, selling_price, batch_lot_no, manufacturing_date, expiry_date, storage_requirements, reorder_level, low_stock_threshold, stock_capacity, stock_on_hand, stock_location, barcode)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [`MED-${Math.floor(10000 + Math.random() * 89999)}`, sku, medicineName, toSafeText(body.brand_name) || null, toSafeText(body.generic_name) || null, toSafeText(body.category) || 'Tablet', toSafeText(body.medicine_type) || 'General', toSafeText(body.dosage_strength) || null, toSafeText(body.unit_of_measure) || 'unit', toSafeText(body.supplier_name) || null, toSafeMoney(body.purchase_cost, 0), toSafeMoney(body.selling_price, 0), batchLotNo, toMysqlDate(body.manufacturing_date), expiryDate, toSafeText(body.storage_requirements) || null, Math.max(0, toSafeInt(body.reorder_level, 20)), Math.max(0, toSafeInt(body.low_stock_threshold, 20)), Math.max(0, toSafeInt(body.stock_capacity, 100)), initialStock, toSafeText(body.stock_location) || null, toSafeText(body.barcode) || null]
                );
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM pharmacy_medicines WHERE sku = ? LIMIT 1`, [sku]);
                const created = rows[0];
                await movement(Number(created.id || 0), 'add', initialStock, 0, initialStock, 'Initial stock added', toSafeText(created.batch_lot_no) || null, toSafeText(created.stock_location) || null);
                await log('ADD_MEDICINE', `${medicineName} created with stock ${initialStock}`, 'success');
                writeJson(res, 200, { ok: true, message: 'Medicine created.' });
                return;
              }

              if (!medicineId && !['fulfill_request'].includes(action)) {
                writeJson(res, 422, { ok: false, message: 'medicine_id is required.' });
                return;
              }

              if (action === 'update_medicine') {
                await pool.query(`UPDATE pharmacy_medicines SET category = COALESCE(?, category), medicine_type = COALESCE(?, medicine_type), supplier_name = COALESCE(?, supplier_name), dosage_strength = COALESCE(?, dosage_strength), unit_of_measure = COALESCE(?, unit_of_measure), stock_capacity = COALESCE(?, stock_capacity), low_stock_threshold = COALESCE(?, low_stock_threshold), reorder_level = COALESCE(?, reorder_level), expiry_date = COALESCE(?, expiry_date), stock_location = COALESCE(?, stock_location), storage_requirements = COALESCE(?, storage_requirements), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_archived = 0`, [toSafeText(body.category) || null, toSafeText(body.medicine_type) || null, toSafeText(body.supplier_name) || null, toSafeText(body.dosage_strength) || null, toSafeText(body.unit_of_measure) || null, Math.max(0, toSafeInt(body.stock_capacity, 0)) || null, Math.max(0, toSafeInt(body.low_stock_threshold, 0)) || null, Math.max(0, toSafeInt(body.reorder_level, 0)) || null, toMysqlDate(body.expiry_date), toSafeText(body.stock_location) || null, toSafeText(body.storage_requirements) || null, medicineId]);
                await log('UPDATE_MEDICINE', `Medicine #${medicineId} updated`, 'success');
                writeJson(res, 200, { ok: true, message: 'Medicine updated.' });
                return;
              }

              const [medicineRows] = await pool.query<RowDataPacket[]>(`SELECT * FROM pharmacy_medicines WHERE id = ? AND is_archived = 0 LIMIT 1`, [medicineId]);
              const medicine = medicineRows[0];
              if (!medicine && action !== 'fulfill_request') {
                writeJson(res, 404, { ok: false, message: 'Medicine not found.' });
                return;
              }

              if (action === 'archive_medicine') {
                await pool.query(`UPDATE pharmacy_medicines SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [medicineId]);
                await movement(medicineId, 'archive', 0, Number(medicine.stock_on_hand || 0), Number(medicine.stock_on_hand || 0), 'Medicine archived', toSafeText(medicine.batch_lot_no) || null, toSafeText(medicine.stock_location) || null);
                await log('ARCHIVE_MEDICINE', `${medicine.medicine_name} archived`);
                writeJson(res, 200, { ok: true, message: 'Medicine archived.' });
                return;
              }

              if (action === 'restock' || action === 'adjust_stock') {
                const before = Number(medicine.stock_on_hand || 0);
                let after = before;
                let delta = 0;
                if (action === 'restock') {
                  const quantity = Math.max(0, toSafeInt(body.quantity, 0));
                  if (!quantity) {
                    writeJson(res, 422, { ok: false, message: 'quantity must be greater than 0.' });
                    return;
                  }
                  after = before + quantity;
                  delta = quantity;
                } else {
                  const mode = toSafeText(body.mode).toLowerCase();
                  const quantity = Math.max(0, toSafeInt(body.quantity, 0));
                  if (!['increase', 'decrease', 'set'].includes(mode)) {
                    writeJson(res, 422, { ok: false, message: 'mode and reason are required.' });
                    return;
                  }
                  if (mode === 'increase') after = before + quantity;
                  if (mode === 'decrease') after = Math.max(0, before - quantity);
                  if (mode === 'set') after = quantity;
                  delta = after - before;
                }
                await pool.query(`UPDATE pharmacy_medicines SET stock_on_hand = ?, supplier_name = COALESCE(?, supplier_name), batch_lot_no = COALESCE(?, batch_lot_no), expiry_date = COALESCE(?, expiry_date), purchase_cost = COALESCE(?, purchase_cost), stock_location = COALESCE(?, stock_location), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [after, toSafeText(body.supplier_name) || null, toSafeText(body.batch_lot_no) || null, toMysqlDate(body.expiry_date), toSafeMoney(body.purchase_cost, 0) || null, toSafeText(body.stock_location) || null, medicineId]);
                await movement(medicineId, action === 'restock' ? 'restock' : 'adjust', delta, before, after, toSafeText(body.reason) || (action === 'restock' ? 'Restocked' : 'Adjusted'), toSafeText(body.batch_lot_no) || toSafeText(medicine.batch_lot_no) || null, toSafeText(body.stock_location) || toSafeText(medicine.stock_location) || null);
                await log(action === 'restock' ? 'RESTOCK' : 'ADJUST', `${medicine.medicine_name} ${action === 'restock' ? `restocked +${delta}` : `adjusted ${before} -> ${after}`}`, action === 'restock' ? 'success' : 'info');
                writeJson(res, 200, { ok: true, message: action === 'restock' ? 'Medicine restocked.' : 'Stock adjusted.' });
                return;
              }

              if (action === 'dispense') {
                const patientName = toSafeText(body.patient_name);
                const prescriptionReference = toSafeText(body.prescription_reference);
                const dispenseReason = toSafeText(body.dispense_reason);
                const quantity = Math.max(0, toSafeInt(body.quantity, 0));
                if (!patientName || !prescriptionReference || !dispenseReason || !quantity) {
                  writeJson(res, 422, { ok: false, message: 'patient_name, quantity, prescription_reference, and dispense_reason are required.' });
                  return;
                }
                const before = Number(medicine.stock_on_hand || 0);
                if (before < quantity) {
                  writeJson(res, 422, { ok: false, message: `Insufficient stock. Available: ${before}` });
                  return;
                }
                const after = before - quantity;
                await pool.query(`UPDATE pharmacy_medicines SET stock_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [after, medicineId]);
                const requestCode = `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                await pool.query(`INSERT INTO pharmacy_dispense_requests (request_code, medicine_id, patient_name, quantity, notes, prescription_reference, dispense_reason, status, requested_at, fulfilled_at, fulfilled_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'Fulfilled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`, [requestCode, medicineId, patientName, quantity, toSafeText(body.notes) || null, prescriptionReference, dispenseReason, actor]);
                await movement(medicineId, 'dispense', -quantity, before, after, `Dispensed for ${patientName}`, toSafeText(medicine.batch_lot_no) || null, toSafeText(medicine.stock_location) || null);
                await log('DISPENSE', `${medicine.medicine_name} dispensed -${quantity} for ${patientName}`);
                await queueCashierIntegrationEvent(pool, {
                  sourceModule: 'pharmacy',
                  sourceEntity: 'dispense_request',
                  sourceKey: requestCode,
                  patientName,
                  patientType: body.patient_type == null ? 'unknown' : toSafeText(body.patient_type),
                  referenceNo: prescriptionReference,
                  amountDue: Number(medicine.selling_price || 0) * quantity,
                  paymentStatus: normalizePaymentStatus(body.payment_status),
                  payload: {
                    requestCode,
                    medicineId,
                    medicineName: toSafeText(medicine.medicine_name),
                    quantity,
                    unitPrice: Number(medicine.selling_price || 0),
                    actor
                  }
                });
                writeJson(res, 200, { ok: true, message: 'Medicine dispensed.' });
                return;
              }

              if (action === 'fulfill_request') {
                const requestId = toSafeInt(body.request_id, 0);
                if (!requestId) {
                  writeJson(res, 422, { ok: false, message: 'request_id is required.' });
                  return;
                }
                const [requestRows] = await pool.query<RowDataPacket[]>(`SELECT r.*, m.medicine_name, m.stock_on_hand, m.batch_lot_no, m.stock_location, m.selling_price FROM pharmacy_dispense_requests r JOIN pharmacy_medicines m ON m.id = r.medicine_id WHERE r.id = ? LIMIT 1`, [requestId]);
                const request = requestRows[0];
                if (!request) {
                  writeJson(res, 404, { ok: false, message: 'Request not found.' });
                  return;
                }
                if (String(request.status) !== 'Pending') {
                  writeJson(res, 422, { ok: false, message: 'Only pending requests can be fulfilled.' });
                  return;
                }
                const before = Number(request.stock_on_hand || 0);
                const qty = Number(request.quantity || 0);
                if (before < qty) {
                  writeJson(res, 422, { ok: false, message: `Insufficient stock. Available: ${before}` });
                  return;
                }
                const after = before - qty;
                await pool.query(`UPDATE pharmacy_medicines SET stock_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [after, Number(request.medicine_id || 0)]);
                await pool.query(`UPDATE pharmacy_dispense_requests SET status = 'Fulfilled', fulfilled_at = CURRENT_TIMESTAMP, fulfilled_by = ? WHERE id = ?`, [actor, requestId]);
                await movement(Number(request.medicine_id || 0), 'dispense', -qty, before, after, `Request #${request.id} fulfilled for ${request.patient_name}`, toSafeText(request.batch_lot_no) || null, toSafeText(request.stock_location) || null);
                await log('FULFILL_REQUEST', `Request #${request.id} fulfilled (${request.medicine_name} -${qty})`, 'success');
                await queueCashierIntegrationEvent(pool, {
                  sourceModule: 'pharmacy',
                  sourceEntity: 'dispense_request',
                  sourceKey: String(request.id),
                  patientName: toSafeText(request.patient_name),
                  patientType: 'unknown',
                  referenceNo: toSafeText(request.prescription_reference) || String(request.id),
                  amountDue: Number(request.selling_price || 0) * qty,
                  paymentStatus: normalizePaymentStatus(body.payment_status),
                  payload: {
                    requestId: Number(request.id || 0),
                    medicineId: Number(request.medicine_id || 0),
                    medicineName: toSafeText(request.medicine_name),
                    quantity: qty,
                    unitPrice: Number(request.selling_price || 0),
                    actor
                  }
                });
                writeJson(res, 200, { ok: true, message: 'Request fulfilled.' });
                return;
              }

              writeJson(res, 422, { ok: false, message: 'Unsupported pharmacy action.' });
              return;
            }
          }

          if (url.pathname === '/api/mental-health') {
            await ensureMentalHealthTables(pool);
            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const [sessions] = await pool.query<RowDataPacket[]>(`SELECT * FROM mental_health_sessions ORDER BY updated_at DESC`);
              const [patients] = await pool.query<RowDataPacket[]>(`SELECT p.patient_id, p.patient_name, p.patient_type, COUNT(s.id) AS previous_sessions, MAX(s.case_reference) AS latest_case_reference FROM mental_health_patients p LEFT JOIN mental_health_sessions s ON s.patient_id = p.patient_id GROUP BY p.patient_id, p.patient_name, p.patient_type ORDER BY p.patient_name ASC`);
              const [notes] = await pool.query<RowDataPacket[]>(`SELECT * FROM mental_health_notes ORDER BY created_at DESC LIMIT 500`);
              const [activities] = await pool.query<RowDataPacket[]>(`SELECT * FROM mental_health_activity_logs ORDER BY created_at DESC LIMIT 500`);
              const [analyticsRows] = await pool.query<RowDataPacket[]>(`SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'follow_up' THEN 1 ELSE 0 END) AS follow_up, SUM(CASE WHEN status = 'at_risk' THEN 1 ELSE 0 END) AS at_risk, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated, SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived FROM mental_health_sessions`);
              writeJson(res, 200, { ok: true, data: { sessions: sessions.map((row) => ({ ...row, appointment_at: formatDateTimeCell(row.appointment_at), next_follow_up_at: row.next_follow_up_at == null ? null : formatDateTimeCell(row.next_follow_up_at), created_at: formatDateTimeCell(row.created_at), updated_at: formatDateTimeCell(row.updated_at), is_draft: toBooleanFlag(row.is_draft) })), patients, notes: notes.map((row) => ({ ...row, created_at: formatDateTimeCell(row.created_at) })), activities: activities.map((row) => ({ ...row, created_at: formatDateTimeCell(row.created_at) })), analytics: analyticsRows[0] || { active: 0, follow_up: 0, at_risk: 0, completed: 0, escalated: 0, archived: 0 } } });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action).toLowerCase();
              const role = toSafeText(body.role) || 'Counselor';
              const sessionId = toSafeInt(body.session_id, 0);
              const saveActivity = async (id: number | null, name: string, detail: string): Promise<void> => {
                await pool.query(`INSERT INTO mental_health_activity_logs (session_id, action, detail, actor_role) VALUES (?, ?, ?, ?)`, [id, name, detail, role]);
                await insertModuleActivity(pool, 'mental_health', name, detail, role, 'mental_session', id ? String(id) : null);
              };

              if (action === 'save_draft') {
                await saveActivity(sessionId || null, 'DRAFT_SAVED', toSafeText(body.detail) || 'Draft saved');
                writeJson(res, 200, { ok: true, message: 'Draft saved.' });
                return;
              }

              if (action === 'create_session') {
                const patientId = toSafeText(body.patient_id);
                const patientName = toSafeText(body.patient_name);
                const counselor = toSafeText(body.counselor);
                const sessionType = toSafeText(body.session_type);
                const appointmentAt = toMysqlDateTime(body.appointment_at);
                if (!patientId || !patientName || !counselor || !sessionType || !appointmentAt) {
                  writeJson(res, 422, { ok: false, message: 'patient_id, patient_name, session_type, counselor, and appointment_at are required.' });
                  return;
                }
                await pool.query(`INSERT INTO mental_health_patients (patient_id, patient_name, patient_type, guardian_contact) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE patient_name = VALUES(patient_name), patient_type = VALUES(patient_type), guardian_contact = COALESCE(VALUES(guardian_contact), guardian_contact)`, [patientId, patientName, inferPatientType({ patientType: body.patient_type, patientName, patientId }), toSafeText(body.guardian_contact) || null]);
                const caseReference = `MHS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                const riskLevel = (toSafeText(body.risk_level) || 'low').toLowerCase();
                const status = toBooleanFlag(body.is_draft) ? 'create' : riskLevel === 'high' ? 'at_risk' : 'active';
                await pool.query(`INSERT INTO mental_health_sessions (case_reference, patient_id, patient_name, patient_type, counselor, session_type, status, risk_level, diagnosis_condition, treatment_plan, session_goals, session_duration_minutes, session_mode, location_room, guardian_contact, emergency_contact, medication_reference, follow_up_frequency, escalation_reason, outcome_result, assessment_score, assessment_tool, appointment_at, next_follow_up_at, created_by_role, is_draft) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [caseReference, patientId, patientName, inferPatientType({ patientType: body.patient_type, patientName, patientId }), counselor, sessionType, status, riskLevel, toSafeText(body.diagnosis_condition) || null, toSafeText(body.treatment_plan) || null, toSafeText(body.session_goals) || null, Math.max(15, toSafeInt(body.session_duration_minutes, 45)), toSafeText(body.session_mode) || 'in_person', toSafeText(body.location_room) || null, toSafeText(body.guardian_contact) || null, toSafeText(body.emergency_contact) || null, toSafeText(body.medication_reference) || null, toSafeText(body.follow_up_frequency) || null, toSafeText(body.escalation_reason) || null, toSafeText(body.outcome_result) || null, body.assessment_score == null ? null : toSafeInt(body.assessment_score, 0), toSafeText(body.assessment_tool) || null, appointmentAt, toMysqlDateTime(body.next_follow_up_at), role, toBooleanFlag(body.is_draft) ? 1 : 0]);
                const [rows] = await pool.query<RowDataPacket[]>(`SELECT id FROM mental_health_sessions WHERE case_reference = ? LIMIT 1`, [caseReference]);
                await saveActivity(Number(rows[0]?.id || 0), 'SESSION_CREATED', `Session ${caseReference} created with status ${status}.`);
                writeJson(res, 200, { ok: true, message: 'Session created.' });
                return;
              }

              const [existingRows] = await pool.query<RowDataPacket[]>(`SELECT * FROM mental_health_sessions WHERE id = ? LIMIT 1`, [sessionId]);
              const existing = existingRows[0];
              if (!existing) {
                writeJson(res, 404, { ok: false, message: 'Session not found.' });
                return;
              }

              if (action === 'update_session') {
                const nextRisk = (toSafeText(body.risk_level) || toSafeText(existing.risk_level) || 'low').toLowerCase();
                const nextStatus = toSafeText(body.status) || (nextRisk === 'high' && ['create', 'active', 'follow_up'].includes(toSafeText(existing.status)) ? 'at_risk' : toSafeText(existing.status));
                await pool.query(`UPDATE mental_health_sessions SET counselor = COALESCE(?, counselor), session_type = COALESCE(?, session_type), status = COALESCE(?, status), risk_level = COALESCE(?, risk_level), diagnosis_condition = COALESCE(?, diagnosis_condition), treatment_plan = COALESCE(?, treatment_plan), session_goals = COALESCE(?, session_goals), session_duration_minutes = COALESCE(?, session_duration_minutes), session_mode = COALESCE(?, session_mode), location_room = COALESCE(?, location_room), guardian_contact = COALESCE(?, guardian_contact), emergency_contact = COALESCE(?, emergency_contact), medication_reference = COALESCE(?, medication_reference), follow_up_frequency = COALESCE(?, follow_up_frequency), assessment_score = COALESCE(?, assessment_score), assessment_tool = COALESCE(?, assessment_tool), escalation_reason = COALESCE(?, escalation_reason), outcome_result = COALESCE(?, outcome_result), appointment_at = COALESCE(?, appointment_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [toSafeText(body.counselor) || null, toSafeText(body.session_type) || null, nextStatus || null, nextRisk || null, toSafeText(body.diagnosis_condition) || null, toSafeText(body.treatment_plan) || null, toSafeText(body.session_goals) || null, toSafeInt(body.session_duration_minutes, 0) || null, toSafeText(body.session_mode) || null, toSafeText(body.location_room) || null, toSafeText(body.guardian_contact) || null, toSafeText(body.emergency_contact) || null, toSafeText(body.medication_reference) || null, toSafeText(body.follow_up_frequency) || null, body.assessment_score == null ? null : toSafeInt(body.assessment_score, 0), toSafeText(body.assessment_tool) || null, toSafeText(body.escalation_reason) || null, toSafeText(body.outcome_result) || null, toMysqlDateTime(body.appointment_at), sessionId]);
                await saveActivity(sessionId, 'SESSION_UPDATED', `Session ${existing.case_reference} updated.`);
                writeJson(res, 200, { ok: true, message: 'Session updated.' });
                return;
              }

              if (action === 'record_note') {
                const noteContent = toSafeText(body.note_content);
                if (!noteContent) {
                  writeJson(res, 422, { ok: false, message: 'note_content is required.' });
                  return;
                }
                await pool.query(`INSERT INTO mental_health_notes (session_id, note_type, note_content, clinical_score, attachment_name, attachment_url, created_by_role) VALUES (?, ?, ?, ?, ?, ?, ?)`, [sessionId, toSafeText(body.note_type) || 'Progress', noteContent, body.clinical_score == null ? null : toSafeInt(body.clinical_score, 0), toSafeText(body.attachment_name) || null, toSafeText(body.attachment_url) || null, role]);
                if (toBooleanFlag(body.mark_at_risk)) {
                  await pool.query(`UPDATE mental_health_sessions SET status = 'at_risk', risk_level = 'high', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);
                }
                await saveActivity(sessionId, 'NOTE_RECORDED', `Structured note recorded: ${toSafeText(body.note_type) || 'Progress'}.`);
                writeJson(res, 200, { ok: true, message: 'Note recorded.' });
                return;
              }

              const actionUpdates: Record<string, { sql: string; params: unknown[]; message: string }> = {
                schedule_followup: { sql: `UPDATE mental_health_sessions SET status = CASE WHEN status IN ('completed', 'archived') THEN status ELSE 'follow_up' END, next_follow_up_at = ?, follow_up_frequency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params: [toMysqlDateTime(body.next_follow_up_at), toSafeText(body.follow_up_frequency), sessionId], message: 'Follow-up scheduled.' },
                set_at_risk: { sql: `UPDATE mental_health_sessions SET status = 'at_risk', risk_level = 'high', escalation_reason = COALESCE(?, escalation_reason), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params: [toSafeText(body.escalation_reason) || null, sessionId], message: 'Session marked as at risk.' },
                complete_session: { sql: `UPDATE mental_health_sessions SET status = 'completed', outcome_result = ?, is_draft = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params: [toSafeText(body.outcome_result), sessionId], message: 'Session completed.' },
                escalate_session: { sql: `UPDATE mental_health_sessions SET status = 'escalated', risk_level = 'high', escalation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params: [toSafeText(body.escalation_reason), sessionId], message: 'Session escalated.' },
                archive_session: { sql: `UPDATE mental_health_sessions SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params: [sessionId], message: 'Session archived.' }
              };
              const target = actionUpdates[action];
              if (!target) {
                writeJson(res, 422, { ok: false, message: 'Unsupported mental health action.' });
                return;
              }
              await pool.query(target.sql, target.params);
              await saveActivity(sessionId, action.toUpperCase(), target.message);
              writeJson(res, 200, { ok: true, message: target.message });
              return;
            }
          }

          if (url.pathname === '/api/patients') {
            await ensurePatientMasterTables(pool);
            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const forceSync = toSafeText(url.searchParams.get('sync')) === '1';
              const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_master`);
              if (forceSync || Number(countRows[0]?.total || 0) === 0) {
                await rebuildPatientMaster(pool);
              }
              const search = toSafeText(url.searchParams.get('search'));
              const moduleFilter = toSafeText(url.searchParams.get('module')).toLowerCase() || 'all';
              const page = Math.max(1, toSafeInt(url.searchParams.get('page'), 1));
              const perPage = Math.min(50, Math.max(1, toSafeInt(url.searchParams.get('per_page'), 10)));
              const offset = (page - 1) * perPage;
              const where: string[] = [];
              const params: unknown[] = [];
              if (search) {
                const like = `%${search.toLowerCase()}%`;
                where.push(`(LOWER(patient_name) LIKE ? OR LOWER(COALESCE(patient_code,'')) LIKE ? OR LOWER(COALESCE(contact,'')) LIKE ? OR LOWER(COALESCE(email,'')) LIKE ?)`);
                params.push(like, like, like, like);
              }
              if (moduleFilter === 'appointments') where.push(`appointment_count > 0`);
              if (moduleFilter === 'walkin') where.push(`walkin_count > 0`);
              if (moduleFilter === 'checkup') where.push(`checkup_count > 0`);
              if (moduleFilter === 'mental') where.push(`mental_count > 0`);
              if (moduleFilter === 'pharmacy') where.push(`pharmacy_count > 0`);
              const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
              const [totalRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_master${whereSql}`, params);
              const total = Number(totalRows[0]?.total || 0);
              const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM patient_master${whereSql} ORDER BY COALESCE(last_seen_at, updated_at, created_at) DESC LIMIT ? OFFSET ?`, [...params, perPage, offset]);
              const [analyticsRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total_patients, SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk, SUM(CASE WHEN appointment_count > 0 OR walkin_count > 0 OR checkup_count > 0 OR mental_count > 0 OR pharmacy_count > 0 THEN 1 ELSE 0 END) AS active_profiles, SUM(CASE WHEN COALESCE(last_seen_at, updated_at, created_at) >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS active_30_days FROM patient_master`);
              writeJson(res, 200, { ok: true, data: { analytics: analyticsRows[0] || { total_patients: 0, high_risk: 0, active_profiles: 0, active_30_days: 0 }, items: rows.map(mapPatientRow), meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) } } });
              return;
            }
            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              if (toSafeText(body.action).toLowerCase() !== 'sync') {
                writeJson(res, 422, { ok: false, message: 'Unsupported patients action.' });
                return;
              }
              await insertModuleActivity(pool, 'patients', 'Patient Master Sync Requested', 'Patient profile sync requested from modules.', toSafeText(body.actor) || 'System', 'patient_master', null);
              await rebuildPatientMaster(pool);
              writeJson(res, 200, { ok: true, message: 'Sync completed.' });
              return;
            }
          }

          if (url.pathname === '/api/appointments') {
            await ensurePatientAppointmentsTable(pool);
            await ensureDoctorAvailabilityTables(pool);
            await ensureCashierIntegrationTables(pool);
            await backfillAppointmentCashierEvents(pool, options, 100);
            if ((req.method || 'GET').toUpperCase() === 'GET') {
              const search = toSafeText(url.searchParams.get('search'));
              const status = toSafeText(url.searchParams.get('status'));
              const service = toSafeText(url.searchParams.get('service'));
              const doctor = normalizeDoctorFilter(toSafeText(url.searchParams.get('doctor')));
              const period = toSafeText(url.searchParams.get('period')).toLowerCase();
              const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
              const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') || '10')));
              const offset = (page - 1) * perPage;

              const where: string[] = [];
              const params: unknown[] = [];
              if (search) {
                const pattern = `%${search.toLowerCase()}%`;
                where.push(`(LOWER(a.patient_name) LIKE ? OR LOWER(COALESCE(a.patient_email, '')) LIKE ? OR LOWER(a.phone_number) LIKE ? OR LOWER(a.booking_id) LIKE ? OR LOWER(COALESCE(a.patient_id, '')) LIKE ? OR LOWER(COALESCE(a.symptoms_summary, '')) LIKE ?)`);
                params.push(pattern, pattern, pattern, pattern, pattern, pattern);
              }
              if (status && status.toLowerCase() !== 'all statuses') {
                where.push('LOWER(a.status) = ?');
                params.push(status.toLowerCase());
              }
              if (service && service.toLowerCase() !== 'all services') {
                where.push('(LOWER(COALESCE(a.visit_type, a.department_name, "")) = ? OR LOWER(a.department_name) = ?)');
                params.push(service.toLowerCase(), service.toLowerCase());
              }
              if (doctor && doctor.toLowerCase() !== 'any') {
                where.push('LOWER(a.doctor_name) = ?');
                params.push(doctor.toLowerCase());
              }
              const periodRange = matchesDateRange(period);
              if (periodRange) {
                where.push(periodRange.sql
                  .replaceAll('appointment_date', 'a.appointment_date')
                  .replaceAll('status', 'a.status'));
                params.push(...periodRange.params);
              }

              const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
              const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM patient_appointments a${whereSql}`, params);
              const total = Number(countRows[0]?.total || 0);
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT a.id, a.booking_id, a.patient_id, a.patient_name, a.patient_email, a.patient_type, a.phone_number, a.emergency_contact, a.insurance_provider,
                        a.payment_method, a.actor_role, a.appointment_priority, a.doctor_name,
                        COALESCE(NULLIF(a.visit_type, ''), a.department_name, 'General Check-Up') AS service_name,
                        a.department_name, a.appointment_date, a.preferred_time, a.status, a.symptoms_summary, a.doctor_notes, a.visit_reason, a.created_at, a.updated_at,
                        p.cashier_billing_id, p.cashier_reference, p.official_receipt, COALESCE(p.amount_due, e.amount_due, 0) AS amount_due, p.amount_paid, p.balance_due, p.paid_at,
                        p.cashier_reference AS cashier_billing_no,
                        COALESCE(NULLIF(p.payment_status, ''), 'unpaid') AS cashier_payment_status,
                        p.latest_payment_method AS cashier_payment_method,
                        a.cashier_can_proceed, a.cashier_verified_at,
                        COALESCE(e.sync_status, '') AS cashier_sync_status
                 FROM patient_appointments a
                 LEFT JOIN cashier_payment_links p
                   ON p.source_module = 'appointments'
                  AND p.source_key = a.booking_id
                 LEFT JOIN (
                   SELECT e1.source_key, e1.sync_status, e1.amount_due, e1.id
                   FROM cashier_integration_events e1
                   INNER JOIN (
                     SELECT source_key, MAX(id) AS max_id
                     FROM cashier_integration_events
                     WHERE source_module = 'appointments'
                     GROUP BY source_key
                   ) latest_event ON latest_event.max_id = e1.id
                 ) e
                   ON e.source_key = a.booking_id${whereSql}
                 ORDER BY a.appointment_date ASC, a.preferred_time ASC
                 LIMIT ? OFFSET ?`,
                [...params, perPage, offset]
              );
              const [analyticsRows] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(patient_email), ''), NULLIF(TRIM(phone_number), ''), patient_name)) AS totalPatients,
                        COUNT(*) AS totalAppointments,
                        SUM(CASE WHEN appointment_date = ? THEN 1 ELSE 0 END) AS todayAppointments,
                        SUM(CASE WHEN LOWER(COALESCE(status, '')) IN ('new', 'pending', 'awaiting') THEN 1 ELSE 0 END) AS pendingQueue
                 FROM patient_appointments`,
                [currentDateString()]
              );
              writeJson(res, 200, {
                ok: true,
                data: {
                  analytics: {
                    totalPatients: Number(analyticsRows[0]?.totalPatients || 0),
                    totalAppointments: Number(analyticsRows[0]?.totalAppointments || 0),
                    todayAppointments: Number(analyticsRows[0]?.todayAppointments || 0),
                    pendingQueue: Number(analyticsRows[0]?.pendingQueue || 0)
                  },
                  items: rows.map(mapAppointmentRow),
                  meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }
                }
              });
              return;
            }

            if ((req.method || '').toUpperCase() === 'POST') {
              const body = await readJsonBody(req);
              const action = toSafeText(body.action || 'update').toLowerCase();

              if (action === 'create') {
                const patientName = toSafeText(body.patient_name);
                const phoneNumber = toSafeText(body.phone_number);
                const doctorName = toSafeText(body.doctor_name);
                const departmentName = toSafeText(body.department_name);
                const visitType = toSafeText(body.visit_type);
                const appointmentDate = toMysqlDate(body.appointment_date);
                const preferredTime = toSafeText(body.preferred_time);
                const requestedStatus = toSafeText(body.status || 'Pending') || 'Pending';
                const priority = toSafeText(body.appointment_priority || 'Routine') || 'Routine';
                const patientId = toSafeText(body.patient_id);
                const patientAge = Number(body.patient_age ?? 0);
                const amountDue = toSafeMoney(body.amount_due, 0);

                if (!patientName || !phoneNumber || !doctorName || !departmentName || !visitType || !appointmentDate) {
                  writeJson(res, 422, { ok: false, message: 'Missing required create fields.' });
                  return;
                }

                const availability = await getDoctorAvailabilitySnapshot(pool, doctorName, departmentName, appointmentDate, preferredTime || undefined);
                if (!Boolean(availability.isDoctorAvailable)) {
                  writeJson(res, 422, { ok: false, message: String(availability.reason || 'Doctor unavailable.') });
                  return;
                }

                const now = new Date();
                const bookingId = `APT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
                const actorRole = ['student', 'teacher', 'admin'].includes(toSafeText(body.actor_role).toLowerCase())
                  ? toSafeText(body.actor_role).toLowerCase()
                  : 'unknown';
                const patientType = inferPatientType({
                  patientType: body.patient_type,
                  actorRole,
                  patientName,
                  patientEmail: body.patient_email,
                  concern: body.visit_reason,
                  visitType,
                  patientId,
                  age: body.patient_age
                });
                const requiresCashierVerification = amountDue > 0;
                const status = requiresCashierVerification && requestedStatus.toLowerCase() !== 'canceled'
                  ? 'Awaiting'
                  : requestedStatus;

                await pool.query(
                  `INSERT INTO patient_appointments (
                    booking_id, patient_id, patient_name, patient_age, patient_email, patient_gender, patient_type, guardian_name,
                    phone_number, emergency_contact, insurance_provider, payment_method, actor_role, appointment_priority,
                    symptoms_summary, doctor_notes, doctor_name, department_name, visit_type, appointment_date, preferred_time, visit_reason, status
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    bookingId,
                    patientId || null,
                    patientName,
                    body.patient_age ?? null,
                    toSafeText(body.patient_email) || null,
                    toSafeText(body.patient_sex || body.patient_gender) || null,
                    patientType,
                    toSafeText(body.guardian_name) || null,
                    phoneNumber,
                    toSafeText(body.emergency_contact) || null,
                    toSafeText(body.insurance_provider) || null,
                    toSafeText(body.payment_method) || null,
                    actorRole,
                    priority,
                    toSafeText(body.symptoms_summary) || null,
                    toSafeText(body.doctor_notes) || null,
                    doctorName,
                    departmentName,
                    visitType,
                    appointmentDate,
                    preferredTime || null,
                    toSafeText(body.visit_reason) || null,
                    status
                  ]
                );

                const [rows] = await pool.query<RowDataPacket[]>(
                  `SELECT a.id, a.booking_id, a.patient_id, a.patient_name, a.patient_email, a.patient_type, a.phone_number, a.emergency_contact, a.insurance_provider,
                          a.payment_method, a.actor_role, a.appointment_priority, a.doctor_name,
                          COALESCE(NULLIF(a.visit_type, ''), a.department_name, 'General Check-Up') AS service_name,
                          a.department_name, a.appointment_date, a.preferred_time, a.status, a.symptoms_summary, a.doctor_notes, a.visit_reason, a.created_at, a.updated_at,
                          p.cashier_billing_id, p.cashier_reference, p.official_receipt, COALESCE(p.amount_due, e.amount_due, 0) AS amount_due, p.amount_paid, p.balance_due, p.paid_at,
                          p.cashier_reference AS cashier_billing_no,
                          COALESCE(NULLIF(p.payment_status, ''), 'unpaid') AS cashier_payment_status,
                          p.latest_payment_method AS cashier_payment_method,
                          a.cashier_can_proceed, a.cashier_verified_at,
                          COALESCE(e.sync_status, '') AS cashier_sync_status
                   FROM patient_appointments a
                   LEFT JOIN cashier_payment_links p
                     ON p.source_module = 'appointments'
                    AND p.source_key = a.booking_id
                   LEFT JOIN (
                     SELECT e1.source_key, e1.sync_status, e1.amount_due, e1.id
                     FROM cashier_integration_events e1
                     INNER JOIN (
                       SELECT source_key, MAX(id) AS max_id
                       FROM cashier_integration_events
                       WHERE source_module = 'appointments'
                       GROUP BY source_key
                     ) latest_event ON latest_event.max_id = e1.id
                   ) e
                     ON e.source_key = a.booking_id
                   WHERE a.booking_id = ? LIMIT 1`,
                  [bookingId]
                );

                await insertModuleActivity(
                  pool,
                  'appointments',
                  'Appointment Created',
                  `Created appointment ${bookingId} for ${patientName} with ${doctorName}.`,
                  toSafeText(body.actor) || 'System',
                  'appointment',
                  bookingId,
                  { doctorName, departmentName, appointmentDate, preferredTime: preferredTime || null, status, patientAge }
                );
                await queueCashierIntegrationEvent(pool, {
                  sourceModule: 'appointments',
                  sourceEntity: 'appointment',
                  sourceKey: bookingId,
                  patientName,
                  patientType,
                  referenceNo: bookingId,
                  amountDue: toSafeMoney(body.amount_due, 0),
                  paymentStatus: normalizePaymentStatus(body.payment_status),
                  payload: {
                    bookingId,
                    student_id: patientId || null,
                    patient_id: patientId || null,
                    student_name: patientName,
                    patient_email: toSafeText(body.patient_email) || null,
                    phone_number: phoneNumber,
                    year_level: toSafeText(body.year_level) || null,
                    due_date: appointmentDate,
                    created_by: toSafeText(body.actor) || 'Clinic System',
                    fee_type: visitType,
                    description: visitType,
                    doctorName,
                    departmentName,
                    department_name: departmentName,
                    visitType,
                    program: departmentName,
                    appointmentDate,
                    preferredTime: preferredTime || null,
                    paymentMethod: toSafeText(body.payment_method) || null
                  }
                });

                if (cashierIntegrationEnabled(options) && cashierSyncMode(options) === 'auto') {
                  const [eventRows] = await pool.query<RowDataPacket[]>(
                    `SELECT *
                     FROM cashier_integration_events
                     WHERE source_module = 'appointments' AND source_key = ?
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [bookingId]
                  );
                  if (eventRows[0]) {
                    await dispatchCashierEvent(pool, options, eventRows[0]);
                    await syncAppointmentCashierColumnsFromLinks(pool, bookingId);
                  }
                }

                const [syncedRows] = await pool.query<RowDataPacket[]>(
                  `SELECT a.id, a.booking_id, a.patient_id, a.patient_name, a.patient_email, a.patient_type, a.phone_number, a.emergency_contact, a.insurance_provider,
                          a.payment_method, a.actor_role, a.appointment_priority, a.doctor_name,
                          COALESCE(NULLIF(a.visit_type, ''), a.department_name, 'General Check-Up') AS service_name,
                          a.department_name, a.appointment_date, a.preferred_time, a.status, a.symptoms_summary, a.doctor_notes, a.visit_reason, a.created_at, a.updated_at,
                          p.cashier_billing_id, p.cashier_reference, p.official_receipt, COALESCE(p.amount_due, e.amount_due, 0) AS amount_due, p.amount_paid, p.balance_due, p.paid_at,
                          COALESCE(NULLIF(a.cashier_billing_no, ''), p.cashier_reference) AS cashier_billing_no,
                          COALESCE(NULLIF(a.cashier_payment_status, ''), NULLIF(p.payment_status, ''), 'unpaid') AS cashier_payment_status,
                          p.latest_payment_method AS cashier_payment_method,
                          a.cashier_can_proceed, a.cashier_verified_at,
                          COALESCE(e.sync_status, '') AS cashier_sync_status
                   FROM patient_appointments a
                   LEFT JOIN cashier_payment_links p
                     ON p.source_module = 'appointments'
                    AND p.source_key = a.booking_id
                   LEFT JOIN (
                     SELECT e1.source_key, e1.sync_status, e1.amount_due, e1.id
                     FROM cashier_integration_events e1
                     INNER JOIN (
                       SELECT source_key, MAX(id) AS max_id
                       FROM cashier_integration_events
                       WHERE source_module = 'appointments'
                       GROUP BY source_key
                     ) latest_event ON latest_event.max_id = e1.id
                   ) e
                     ON e.source_key = a.booking_id
                   WHERE a.booking_id = ? LIMIT 1`,
                  [bookingId]
                );

                writeJson(res, 200, { ok: true, message: 'Appointment created.', data: syncedRows[0] ? mapAppointmentRow(syncedRows[0]) : null });
                return;
              }

              const bookingId = toSafeText(body.booking_id);
              if (!bookingId) {
                writeJson(res, 422, { ok: false, message: 'booking_id is required.' });
                return;
              }

              const [existingRows] = await pool.query<RowDataPacket[]>(
                `SELECT a.booking_id, a.doctor_name, a.department_name, a.appointment_date, a.preferred_time, a.status,
                        p.cashier_billing_id, p.cashier_reference, p.amount_due,
                        COALESCE(NULLIF(p.payment_status, ''), 'unpaid') AS cashier_payment_status
                 FROM patient_appointments a
                 LEFT JOIN cashier_payment_links p
                   ON p.source_module = 'appointments'
                  AND p.source_key = a.booking_id
                 WHERE a.booking_id = ? LIMIT 1`,
                [bookingId]
              );
              const existing = existingRows[0];
              if (!existing) {
                writeJson(res, 404, { ok: false, message: 'Appointment not found.' });
                return;
              }

              const nextDoctorName = 'doctor_name' in body ? toSafeText(body.doctor_name) : String(existing.doctor_name || '');
              const nextDepartmentName = 'department_name' in body ? toSafeText(body.department_name) : String(existing.department_name || '');
              const nextAppointmentDate = 'appointment_date' in body ? toMysqlDate(body.appointment_date) : toMysqlDate(existing.appointment_date);
              const nextPreferredTime = 'preferred_time' in body ? toSafeText(body.preferred_time) : String(existing.preferred_time || '');
              const nextStatus = 'status' in body ? toSafeText(body.status).toLowerCase() : '';
              const requiresCashierVerification = appointmentRequiresCashierVerification({
                cashierBillingId: existing.cashier_billing_id,
                cashierReference: existing.cashier_reference,
                amountDue: existing.amount_due
              });
              const canProceedByCashier = appointmentCanProceedByCashier({
                cashierBillingId: existing.cashier_billing_id,
                cashierReference: existing.cashier_reference,
                amountDue: existing.amount_due,
                cashierPaymentStatus: existing.cashier_payment_status
              });
              if (requiresCashierVerification && !canProceedByCashier && ['confirmed', 'accepted', 'appointed'].includes(nextStatus)) {
                writeJson(res, 422, {
                  ok: false,
                  message: 'This appointment is still waiting for cashier payment verification. Keep it on Awaiting until payment is verified as paid.'
                });
                return;
              }
              if (nextStatus !== 'canceled' && nextAppointmentDate) {
                const availability = await getDoctorAvailabilitySnapshot(pool, nextDoctorName, nextDepartmentName, nextAppointmentDate, nextPreferredTime || undefined, bookingId);
                if (!Boolean(availability.isDoctorAvailable)) {
                  writeJson(res, 422, { ok: false, message: String(availability.reason || 'Doctor unavailable.') });
                  return;
                }
              }

              const fieldMap: Array<[string, string, unknown]> = [
                ['status', 'status', body.status],
                ['patient_id', 'patient_id', body.patient_id],
                ['patient_gender', 'patient_gender', body.patient_gender ?? body.patient_sex],
                ['patient_type', 'patient_type', inferPatientType({
                  patientType: body.patient_type,
                  actorRole: body.actor_role,
                  patientName: body.patient_name,
                  patientEmail: body.patient_email,
                  concern: body.visit_reason,
                  visitType: body.visit_type,
                  patientId: body.patient_id,
                  age: body.patient_age
                })],
                ['guardian_name', 'guardian_name', body.guardian_name],
                ['emergency_contact', 'emergency_contact', body.emergency_contact],
                ['insurance_provider', 'insurance_provider', body.insurance_provider],
                ['payment_method', 'payment_method', body.payment_method],
                ['actor_role', 'actor_role', body.actor_role],
                ['appointment_priority', 'appointment_priority', body.appointment_priority],
                ['symptoms_summary', 'symptoms_summary', body.symptoms_summary],
                ['doctor_notes', 'doctor_notes', body.doctor_notes],
                ['doctor_name', 'doctor_name', body.doctor_name],
                ['department_name', 'department_name', body.department_name],
                ['visit_type', 'visit_type', body.visit_type],
                ['appointment_date', 'appointment_date', toMysqlDate(body.appointment_date)],
                ['preferred_time', 'preferred_time', body.preferred_time],
                ['visit_reason', 'visit_reason', body.visit_reason]
              ];

              const setParts: string[] = [];
              const values: unknown[] = [];
              fieldMap.forEach(([inputKey, column, value]) => {
                if (!(inputKey in body)) return;
                setParts.push(`${column} = ?`);
                values.push(typeof value === 'string' && value.trim() === '' ? null : value);
              });
              if (!setParts.length) {
                writeJson(res, 422, { ok: false, message: 'No fields to update.' });
                return;
              }

              values.push(bookingId);
              await pool.query(`UPDATE patient_appointments SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?`, values);

              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT a.id, a.booking_id, a.patient_id, a.patient_name, a.patient_email, a.patient_type, a.phone_number, a.emergency_contact, a.insurance_provider,
                        a.payment_method, a.actor_role, a.appointment_priority, a.doctor_name,
                        COALESCE(NULLIF(a.visit_type, ''), a.department_name, 'General Check-Up') AS service_name,
                        a.department_name, a.appointment_date, a.preferred_time, a.status, a.symptoms_summary, a.doctor_notes, a.visit_reason, a.created_at, a.updated_at,
                        p.cashier_billing_id, p.cashier_reference, p.official_receipt, COALESCE(p.amount_due, e.amount_due, 0) AS amount_due, p.amount_paid, p.balance_due, p.paid_at,
                        p.cashier_reference AS cashier_billing_no,
                        COALESCE(NULLIF(p.payment_status, ''), 'unpaid') AS cashier_payment_status,
                        p.latest_payment_method AS cashier_payment_method,
                        COALESCE(e.sync_status, '') AS cashier_sync_status
                 FROM patient_appointments a
                 LEFT JOIN cashier_payment_links p
                   ON p.source_module = 'appointments'
                  AND p.source_key = a.booking_id
                 LEFT JOIN (
                   SELECT e1.source_key, e1.sync_status, e1.amount_due, e1.id
                   FROM cashier_integration_events e1
                   INNER JOIN (
                     SELECT source_key, MAX(id) AS max_id
                     FROM cashier_integration_events
                     WHERE source_module = 'appointments'
                     GROUP BY source_key
                   ) latest_event ON latest_event.max_id = e1.id
                 ) e
                   ON e.source_key = a.booking_id
                 WHERE a.booking_id = ? LIMIT 1`,
                [bookingId]
              );

              await insertModuleActivity(
                pool,
                'appointments',
                'Appointment Updated',
                `Updated appointment ${bookingId}.`,
                toSafeText(body.actor) || 'System',
                'appointment',
                bookingId,
                { doctorName: nextDoctorName || null, departmentName: nextDepartmentName || null, appointmentDate: nextAppointmentDate || null, preferredTime: nextPreferredTime || null }
              );
              const nextAmountDue = 'amount_due' in body ? toSafeMoney(body.amount_due, 0) : toSafeMoney(existing.amount_due, 0);
              await queueCashierIntegrationEvent(pool, {
                sourceModule: 'appointments',
                sourceEntity: 'appointment',
                sourceKey: bookingId,
                patientName: toSafeText(body.patient_name) || toSafeText(rows[0]?.patient_name),
                patientType: toSafeText(rows[0]?.patient_type),
                referenceNo: bookingId,
                amountDue: nextAmountDue,
                paymentStatus: normalizePaymentStatus(body.payment_status),
                payload: {
                  bookingId,
                  student_id: toSafeText(rows[0]?.patient_id) || null,
                  patient_id: toSafeText(rows[0]?.patient_id) || null,
                  student_name: toSafeText(rows[0]?.patient_name) || null,
                  patient_email: toSafeText(rows[0]?.patient_email) || null,
                  phone_number: toSafeText(rows[0]?.phone_number) || null,
                  year_level: toSafeText(body.year_level) || null,
                  due_date: nextAppointmentDate || null,
                  created_by: toSafeText(body.actor) || 'Clinic System',
                  fee_type: toSafeText(rows[0]?.service_name) || null,
                  description: toSafeText(rows[0]?.service_name) || null,
                  doctorName: nextDoctorName || null,
                  departmentName: nextDepartmentName || null,
                  department_name: nextDepartmentName || null,
                  program: nextDepartmentName || null,
                  appointmentDate: nextAppointmentDate || null,
                  preferredTime: nextPreferredTime || null,
                  status: toSafeText(rows[0]?.status) || null,
                  paymentMethod: toSafeText(rows[0]?.payment_method) || null
                }
              });

              if (cashierIntegrationEnabled(options) && cashierSyncMode(options) === 'auto') {
                const [eventRows] = await pool.query<RowDataPacket[]>(
                  `SELECT *
                   FROM cashier_integration_events
                   WHERE source_module = 'appointments' AND source_key = ?
                   ORDER BY created_at DESC
                   LIMIT 1`,
                  [bookingId]
                );
                if (eventRows[0]) {
                  await dispatchCashierEvent(pool, options, eventRows[0]);
                  await syncAppointmentCashierColumnsFromLinks(pool, bookingId);
                }
              }

              const [syncedRows] = await pool.query<RowDataPacket[]>(
                `SELECT a.id, a.booking_id, a.patient_id, a.patient_name, a.patient_email, a.patient_type, a.phone_number, a.emergency_contact, a.insurance_provider,
                        a.payment_method, a.actor_role, a.appointment_priority, a.doctor_name,
                        COALESCE(NULLIF(a.visit_type, ''), a.department_name, 'General Check-Up') AS service_name,
                        a.department_name, a.appointment_date, a.preferred_time, a.status, a.symptoms_summary, a.doctor_notes, a.visit_reason, a.created_at, a.updated_at,
                        p.cashier_billing_id, p.cashier_reference, p.official_receipt, COALESCE(p.amount_due, e.amount_due, 0) AS amount_due, p.amount_paid, p.balance_due, p.paid_at,
                        COALESCE(NULLIF(a.cashier_billing_no, ''), p.cashier_reference) AS cashier_billing_no,
                        COALESCE(NULLIF(a.cashier_payment_status, ''), NULLIF(p.payment_status, ''), 'unpaid') AS cashier_payment_status,
                        p.latest_payment_method AS cashier_payment_method,
                        a.cashier_can_proceed, a.cashier_verified_at,
                        COALESCE(e.sync_status, '') AS cashier_sync_status
                 FROM patient_appointments a
                 LEFT JOIN cashier_payment_links p
                   ON p.source_module = 'appointments'
                  AND p.source_key = a.booking_id
                 LEFT JOIN (
                   SELECT e1.source_key, e1.sync_status, e1.amount_due, e1.id
                   FROM cashier_integration_events e1
                   INNER JOIN (
                     SELECT source_key, MAX(id) AS max_id
                     FROM cashier_integration_events
                     WHERE source_module = 'appointments'
                     GROUP BY source_key
                   ) latest_event ON latest_event.max_id = e1.id
                 ) e
                   ON e.source_key = a.booking_id
                 WHERE a.booking_id = ? LIMIT 1`,
                [bookingId]
              );

              writeJson(res, 200, { ok: true, message: 'Appointment updated.', data: syncedRows[0] ? mapAppointmentRow(syncedRows[0]) : null });
              return;
            }
          }

          next();
        } catch (error) {
          writeJson(res, 500, { ok: false, message: error instanceof Error ? error.message : 'MySQL compatibility route failed.' });
        }
      });
    }
  };
}
