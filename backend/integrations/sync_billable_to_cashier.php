<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/CashierBillingIntegrationService.php';

$config = load_integration_config();
$pdo = integration_db_connection();
$service = new CashierBillingIntegrationService($pdo, $config);
$input = read_json_request_body();

try {
    $payload = $service->buildSharedPayload($input);
    $result = $service->syncClinicBillable($payload);

    json_response([
        'ok' => true,
        'message' => 'Clinic billable service synced to cashier successfully.',
        'data' => $result,
    ]);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'message' => $error->getMessage(),
    ], 500);
}
