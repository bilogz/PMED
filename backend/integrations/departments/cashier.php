<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

function cashier_department_filters(): array
{
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    $search = strtolower(trim((string) ($_GET['search'] ?? '')));
    $paymentStatus = strtolower(trim((string) ($_GET['payment_status'] ?? '')));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(50, max(1, (int) ($_GET['per_page'] ?? 20)));

    return [
        'status' => $status,
        'search' => $search,
        'payment_status' => $paymentStatus,
        'page' => $page,
        'per_page' => $perPage,
        'offset' => ($page - 1) * $perPage,
    ];
}

function cashier_decode_json(?string $value): array
{
    if ($value === null || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function cashier_normalize_payment_status(?string $status): string
{
    $normalized = strtolower(trim((string) $status));
    $allowed = ['unpaid', 'partial', 'paid', 'void', 'refunded'];
    return in_array($normalized, $allowed, true) ? $normalized : 'unpaid';
}

function cashier_can_clear(array $record): bool
{
    $paymentStatus = cashier_normalize_payment_status((string) ($record['payment_status'] ?? 'unpaid'));
    $balanceDue = (float) ($record['balance_due'] ?? 0);

    return $paymentStatus === 'paid' || $balanceDue <= 0;
}

function cashier_fetch_records(PDO $pdo): array
{
    $filters = cashier_department_filters();
    $where = ['d.department_key = ?'];
    $params = ['cashier'];

    if ($filters['status'] !== '') {
        $where[] = 'LOWER(d.status) = ?';
        $params[] = $filters['status'];
    }

    if ($filters['payment_status'] !== '') {
        $where[] = 'LOWER(COALESCE(p.payment_status, e.payment_status, \'unpaid\')) = ?';
        $params[] = $filters['payment_status'];
    }

    if ($filters['search'] !== '') {
        $like = '%' . $filters['search'] . '%';
        $where[] = '(LOWER(d.patient_name) LIKE ? OR LOWER(COALESCE(d.patient_code, \'\')) LIKE ? OR LOWER(d.clearance_reference) LIKE ? OR LOWER(COALESCE(d.external_reference, \'\')) LIKE ? OR LOWER(COALESCE(e.reference_no, \'\')) LIKE ?)';
        array_push($params, $like, $like, $like, $like, $like);
    }

    $whereSql = ' WHERE ' . implode(' AND ', $where);

    $countStmt = $pdo->prepare(
        'SELECT COUNT(*) AS total
         FROM department_clearance_records d
         LEFT JOIN cashier_integration_events e
           ON e.source_key = COALESCE(d.external_reference, d.patient_code, d.patient_id)
         LEFT JOIN cashier_payment_links p
           ON p.source_module = e.source_module AND p.source_key = e.source_key' . $whereSql
    );
    $countStmt->execute($params);
    $total = (int) ($countStmt->fetch()['total'] ?? 0);

    $stmt = $pdo->prepare(
        'SELECT
            d.id,
            d.clearance_reference,
            d.patient_id,
            d.patient_code,
            d.patient_name,
            d.patient_type,
            d.department_key,
            d.department_name,
            d.stage_order,
            d.status,
            d.remarks,
            d.approver_name,
            d.approver_role,
            d.external_reference,
            d.requested_by,
            d.decided_at,
            d.metadata,
            d.created_at,
            d.updated_at,
            e.id AS cashier_event_id,
            e.source_module,
            e.source_entity,
            e.source_key,
            e.reference_no,
            e.amount_due AS queued_amount_due,
            e.currency_code,
            e.payment_status AS event_payment_status,
            e.sync_status,
            e.last_error,
            e.synced_at,
            p.cashier_reference,
            p.invoice_number,
            p.official_receipt,
            p.amount_due,
            p.amount_paid,
            p.balance_due,
            p.payment_status,
            p.paid_at,
            p.metadata AS payment_metadata
         FROM department_clearance_records d
         LEFT JOIN cashier_integration_events e
           ON e.source_key = COALESCE(d.external_reference, d.patient_code, d.patient_id)
         LEFT JOIN cashier_payment_links p
           ON p.source_module = e.source_module AND p.source_key = e.source_key' . $whereSql . '
         ORDER BY d.created_at DESC
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([...$params, $filters['per_page'], $filters['offset']]);
    $rows = $stmt->fetchAll();

    $items = array_map(static function (array $row): array {
        $effectivePaymentStatus = cashier_normalize_payment_status((string) ($row['payment_status'] ?? $row['event_payment_status'] ?? 'unpaid'));
        $amountDue = (float) ($row['amount_due'] ?? $row['queued_amount_due'] ?? 0);
        $amountPaid = (float) ($row['amount_paid'] ?? 0);
        $balanceDue = array_key_exists('balance_due', $row) && $row['balance_due'] !== null
            ? (float) $row['balance_due']
            : max(0, $amountDue - $amountPaid);

        return [
            'id' => (int) $row['id'],
            'clearance_reference' => $row['clearance_reference'],
            'patient_id' => $row['patient_id'],
            'patient_code' => $row['patient_code'],
            'patient_name' => $row['patient_name'],
            'patient_type' => $row['patient_type'],
            'department_key' => $row['department_key'],
            'department_name' => $row['department_name'],
            'stage_order' => (int) $row['stage_order'],
            'status' => $row['status'],
            'remarks' => $row['remarks'],
            'approver_name' => $row['approver_name'],
            'approver_role' => $row['approver_role'],
            'external_reference' => $row['external_reference'],
            'requested_by' => $row['requested_by'],
            'decided_at' => $row['decided_at'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'metadata' => cashier_decode_json($row['metadata']),
            'cashier' => [
                'event_id' => $row['cashier_event_id'] === null ? null : (int) $row['cashier_event_id'],
                'source_module' => $row['source_module'],
                'source_entity' => $row['source_entity'],
                'source_key' => $row['source_key'],
                'reference_no' => $row['reference_no'],
                'cashier_reference' => $row['cashier_reference'],
                'invoice_number' => $row['invoice_number'],
                'official_receipt' => $row['official_receipt'],
                'currency_code' => $row['currency_code'] ?? 'PHP',
                'amount_due' => $amountDue,
                'amount_paid' => $amountPaid,
                'balance_due' => $balanceDue,
                'payment_status' => $effectivePaymentStatus,
                'sync_status' => $row['sync_status'],
                'last_error' => $row['last_error'],
                'synced_at' => $row['synced_at'],
                'paid_at' => $row['paid_at'],
                'payment_metadata' => cashier_decode_json($row['payment_metadata']),
                'can_clear' => $effectivePaymentStatus === 'paid' || $balanceDue <= 0,
            ],
        ];
    }, $rows);

    return [
        'items' => $items,
        'meta' => [
            'page' => $filters['page'],
            'perPage' => $filters['per_page'],
            'total' => $total,
            'totalPages' => max(1, (int) ceil($total / $filters['per_page'])),
        ],
    ];
}

function cashier_request_clearance(PDO $pdo, array $payload): array
{
    $patientName = trim((string) ($payload['patient_name'] ?? ''));
    if ($patientName === '') {
        json_response([
            'ok' => false,
            'message' => 'patient_name is required.',
        ], 422);
    }

    $patientId = trim((string) ($payload['patient_id'] ?? ''));
    $patientCode = trim((string) ($payload['patient_code'] ?? ''));
    $externalReference = trim((string) ($payload['external_reference'] ?? ''));
    $clearanceReference = trim((string) ($payload['clearance_reference'] ?? ''));

    if ($clearanceReference === '') {
        $referenceToken = $patientCode !== '' ? $patientCode : ($patientId !== '' ? $patientId : (string) time());
        $clearanceReference = 'CASHIER-' . strtoupper($referenceToken);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO department_clearance_records (
            clearance_reference, patient_id, patient_code, patient_name, patient_type,
            department_key, department_name, stage_order, status, remarks, approver_name,
            approver_role, external_reference, requested_by, metadata
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            patient_id = VALUES(patient_id),
            patient_code = VALUES(patient_code),
            patient_name = VALUES(patient_name),
            patient_type = VALUES(patient_type),
            remarks = VALUES(remarks),
            approver_name = VALUES(approver_name),
            approver_role = VALUES(approver_role),
            external_reference = VALUES(external_reference),
            requested_by = VALUES(requested_by),
            metadata = VALUES(metadata),
            updated_at = CURRENT_TIMESTAMP'
    );

    $stmt->execute([
        $clearanceReference,
        $patientId !== '' ? $patientId : null,
        $patientCode !== '' ? $patientCode : null,
        $patientName,
        strtolower(trim((string) ($payload['patient_type'] ?? 'unknown'))),
        'cashier',
        'Cashier',
        8,
        strtolower(trim((string) ($payload['status'] ?? 'pending'))),
        trim((string) ($payload['remarks'] ?? 'Waiting for financial settlement.')) ?: null,
        trim((string) ($payload['approver_name'] ?? '')) ?: null,
        trim((string) ($payload['approver_role'] ?? '')) ?: null,
        $externalReference !== '' ? $externalReference : null,
        trim((string) ($payload['requested_by'] ?? 'System')) ?: 'System',
        json_encode(is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);

    return ['clearance_reference' => $clearanceReference];
}

function cashier_submit_decision(PDO $pdo, array $payload): array
{
    $clearanceReference = trim((string) ($payload['clearance_reference'] ?? ''));
    $status = strtolower(trim((string) ($payload['status'] ?? '')));

    if ($clearanceReference === '' || !in_array($status, ['approved', 'rejected', 'hold', 'pending'], true)) {
        json_response([
            'ok' => false,
            'message' => 'clearance_reference and valid status are required.',
        ], 422);
    }

    $recordStmt = $pdo->prepare(
        'SELECT
            d.clearance_reference,
            d.external_reference,
            d.patient_code,
            d.patient_id,
            p.payment_status,
            p.balance_due,
            p.amount_due,
            p.amount_paid,
            e.payment_status AS event_payment_status
         FROM department_clearance_records d
         LEFT JOIN cashier_integration_events e
           ON e.source_key = COALESCE(d.external_reference, d.patient_code, d.patient_id)
         LEFT JOIN cashier_payment_links p
           ON p.source_module = e.source_module AND p.source_key = e.source_key
         WHERE d.clearance_reference = ? AND d.department_key = ? 
         LIMIT 1'
    );
    $recordStmt->execute([$clearanceReference, 'cashier']);
    $record = $recordStmt->fetch();

    if (!is_array($record)) {
        json_response([
            'ok' => false,
            'message' => 'Cashier clearance record not found.',
        ], 404);
    }

    if ($status === 'approved' && !cashier_can_clear($record)) {
        json_response([
            'ok' => false,
            'message' => 'Cashier clearance can only be approved when the payment is fully settled.',
        ], 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE department_clearance_records
         SET status = ?, remarks = ?, approver_name = ?, approver_role = ?,
             external_reference = COALESCE(?, external_reference),
             metadata = ?, decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE clearance_reference = ? AND department_key = ?'
    );

    $stmt->execute([
        $status,
        trim((string) ($payload['remarks'] ?? '')) ?: null,
        trim((string) ($payload['approver_name'] ?? '')) ?: null,
        trim((string) ($payload['approver_role'] ?? '')) ?: null,
        trim((string) ($payload['external_reference'] ?? '')) ?: null,
        json_encode(is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $clearanceReference,
        'cashier',
    ]);

    return [
        'clearance_reference' => $clearanceReference,
        'status' => $status,
    ];
}

$pdo = integration_db_connection();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    if ($method === 'GET') {
        json_response([
            'ok' => true,
            'department' => 'cashier',
            'message' => 'Cashier clearance records fetched.',
            'data' => cashier_fetch_records($pdo),
        ]);
    }

    if ($method === 'POST') {
        $payload = read_json_request_body();
        $action = strtolower(trim((string) ($payload['action'] ?? 'submit_decision')));

        if ($action === 'request_clearance') {
            json_response([
                'ok' => true,
                'department' => 'cashier',
                'message' => 'Cashier clearance request submitted.',
                'data' => cashier_request_clearance($pdo, $payload),
            ]);
        }

        json_response([
            'ok' => true,
            'department' => 'cashier',
            'message' => 'Cashier decision submitted.',
            'data' => cashier_submit_decision($pdo, $payload),
        ]);
    }

    json_response([
        'ok' => false,
        'message' => 'Unsupported method.',
    ], 405);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'department' => 'cashier',
        'message' => $error->getMessage(),
    ], 500);
}
