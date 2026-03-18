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
