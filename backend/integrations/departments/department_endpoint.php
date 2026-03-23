<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require dirname(__DIR__) . '/DepartmentIntegrationClient.php';

$department = isset($departmentKey) ? (string) $departmentKey : '';
if ($department === '') {
    json_response([
        'ok' => false,
        'message' => 'Department key is not configured.',
    ], 500);
}

$config = load_integration_config();
$client = new DepartmentIntegrationClient($config['clinic_system'] ?? []);
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

/**
 * Resolve the first available department clearance table.
 */
function resolve_clearance_table(PDO $pdo): string
{
    $candidates = [
        'clinic.department_clearance_records',
        'pmed.department_clearance_records',
        'public.department_clearance_records',
    ];

    $check = $pdo->prepare('SELECT to_regclass(:table_name) AS relation_name');
    foreach ($candidates as $candidate) {
        $check->execute(['table_name' => $candidate]);
        $row = $check->fetch(PDO::FETCH_ASSOC);
        if (!empty($row['relation_name'])) {
            return $candidate;
        }
    }

    throw new RuntimeException('No department_clearance_records table is available for PMED report intake.');
}

/**
 * Direct fallback for PMED report submission when API bridge is unavailable.
 */
function submit_report_directly(string $department, array $payload): array
{
    $pdo = integration_db_connection();
    $table = resolve_clearance_table($pdo);

    $reportReference = trim((string) ($payload['report_reference'] ?? $payload['external_reference'] ?? ''));
    if ($reportReference === '') {
        $reportReference = 'RPT-' . date('YmdHis');
    }

    $reportName = trim((string) ($payload['report_name'] ?? ''));
    if ($reportName === '') {
        $reportName = ucfirst($department) . ' Report';
    }

    $status = strtolower(trim((string) ($payload['status'] ?? 'approved')));
    if (!in_array($status, ['approved', 'pending', 'hold', 'rejected'], true)) {
        $status = 'approved';
    }

    $metadataInput = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];
    $clearanceReference = trim((string) ($payload['clearance_reference'] ?? ''));
    if ($clearanceReference === '') {
        $clearanceReference = strtoupper($department) . '-REPORT-' . $reportReference;
    }

    $metadata = array_merge($metadataInput, [
        'source_department' => $metadataInput['source_department'] ?? $department,
        'target_department' => $metadataInput['target_department'] ?? 'pmed',
        'source_entity' => $metadataInput['source_entity'] ?? 'report',
        'stage' => $metadataInput['stage'] ?? 'reporting',
        'report_reference' => $metadataInput['report_reference'] ?? $reportReference,
        'report_name' => $metadataInput['report_name'] ?? $reportName,
        'report_type' => $metadataInput['report_type'] ?? (string) ($payload['report_type'] ?? ''),
        'plan_reference' => $metadataInput['plan_reference'] ?? (string) ($payload['plan_reference'] ?? ''),
        'owner_name' => $metadataInput['owner_name'] ?? (string) ($payload['requested_by'] ?? $payload['approver_name'] ?? 'Department Integration'),
        'file_url' => $metadataInput['file_url'] ?? (string) ($payload['file_url'] ?? ''),
        'delivery_status' => $metadataInput['delivery_status'] ?? 'Received',
    ]);

    $sql = <<<SQL
INSERT INTO {$table} (
    clearance_reference,
    patient_id,
    patient_code,
    patient_name,
    patient_type,
    department_key,
    department_name,
    stage_order,
    status,
    remarks,
    approver_name,
    approver_role,
    external_reference,
    requested_by,
    decided_at,
    metadata
) VALUES (
    :clearance_reference,
    :patient_id,
    :patient_code,
    :patient_name,
    :patient_type,
    :department_key,
    :department_name,
    :stage_order,
    :status,
    :remarks,
    :approver_name,
    :approver_role,
    :external_reference,
    :requested_by,
    CURRENT_TIMESTAMP,
    CAST(:metadata AS jsonb)
)
ON CONFLICT (clearance_reference) DO UPDATE SET
    patient_id = COALESCE(EXCLUDED.patient_id, {$table}.patient_id),
    patient_code = COALESCE(EXCLUDED.patient_code, {$table}.patient_code),
    patient_name = COALESCE(EXCLUDED.patient_name, {$table}.patient_name),
    patient_type = COALESCE(EXCLUDED.patient_type, {$table}.patient_type),
    department_key = EXCLUDED.department_key,
    department_name = EXCLUDED.department_name,
    stage_order = EXCLUDED.stage_order,
    status = EXCLUDED.status,
    remarks = EXCLUDED.remarks,
    approver_name = EXCLUDED.approver_name,
    approver_role = EXCLUDED.approver_role,
    external_reference = COALESCE(EXCLUDED.external_reference, {$table}.external_reference),
    requested_by = COALESCE(EXCLUDED.requested_by, {$table}.requested_by),
    decided_at = EXCLUDED.decided_at,
    metadata = EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP
RETURNING clearance_reference, external_reference
SQL;

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'clearance_reference' => $clearanceReference,
        'patient_id' => ($payload['patient_id'] ?? '') !== '' ? (string) $payload['patient_id'] : null,
        'patient_code' => ($payload['patient_code'] ?? '') !== '' ? (string) $payload['patient_code'] : $reportReference,
        'patient_name' => $reportName,
        'patient_type' => strtolower(trim((string) ($payload['patient_type'] ?? 'unknown'))) ?: 'unknown',
        'department_key' => $department,
        'department_name' => ucfirst($department),
        'stage_order' => (int) ($payload['stage_order'] ?? 0),
        'status' => $status,
        'remarks' => ($payload['remarks'] ?? '') !== '' ? (string) $payload['remarks'] : null,
        'approver_name' => ($payload['approver_name'] ?? '') !== '' ? (string) $payload['approver_name'] : null,
        'approver_role' => ($payload['approver_role'] ?? '') !== '' ? (string) $payload['approver_role'] : null,
        'external_reference' => ($payload['external_reference'] ?? '') !== '' ? (string) $payload['external_reference'] : $reportReference,
        'requested_by' => ($payload['requested_by'] ?? '') !== '' ? (string) $payload['requested_by'] : null,
        'metadata' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);

    $saved = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'clearance_reference' => (string) ($saved['clearance_reference'] ?? $clearanceReference),
        'external_reference' => (string) ($saved['external_reference'] ?? $reportReference),
        'report_reference' => $reportReference,
        'report_name' => $reportName,
        'intake_mode' => 'direct_db_fallback',
    ];
}

try {
    if ($method === 'GET') {
        $data = $client->fetchRecords($department, [
            'status' => $_GET['status'] ?? '',
            'search' => $_GET['search'] ?? '',
            'page' => $_GET['page'] ?? 1,
            'per_page' => $_GET['per_page'] ?? 20,
        ]);

        json_response([
            'ok' => true,
            'department' => $department,
            'message' => 'Department records fetched.',
            'data' => $data,
        ]);
    }

    if ($method === 'POST') {
        $payload = read_json_request_body();
        $action = (string) ($payload['action'] ?? 'submit_decision');

        if ($action === 'request_clearance') {
            $data = $client->requestClearance($department, $payload);
            json_response([
                'ok' => true,
                'department' => $department,
                'message' => 'Department clearance request submitted.',
                'data' => $data,
            ]);
        }

        if ($action === 'submit_report') {
            // Supabase-only intake (no local /api bridge dependency).
            $data = submit_report_directly($department, $payload);
            json_response([
                'ok' => true,
                'department' => $department,
                'message' => 'Department report submitted to PMED.',
                'data' => $data,
            ]);
        }

        $data = $client->submitDecision($department, $payload);
        json_response([
            'ok' => true,
            'department' => $department,
            'message' => 'Department decision submitted.',
            'data' => $data,
        ]);
    }

    json_response([
        'ok' => false,
        'message' => 'Unsupported method.',
    ], 405);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'department' => $department,
        'message' => $error->getMessage(),
    ], 500);
}
