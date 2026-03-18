<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require dirname(__DIR__) . '/DepartmentIntegrationClient.php';

$config = load_integration_config();
$client = new DepartmentIntegrationClient($config['clinic_system'] ?? []);
$payload = read_json_request_body();

try {
    $data = $client->seedDefaultFlow([
        'patient_id' => $payload['patient_id'] ?? null,
        'patient_code' => $payload['patient_code'] ?? 'PAT-INTEGRATION-001',
        'patient_name' => $payload['patient_name'] ?? 'Integration Test Patient',
        'patient_type' => $payload['patient_type'] ?? 'student',
        'requested_by' => $payload['requested_by'] ?? 'Department Integration',
    ]);

    json_response([
        'ok' => true,
        'message' => 'Department clearance flow seeded.',
        'data' => $data,
    ]);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'message' => $error->getMessage(),
    ], 500);
}
