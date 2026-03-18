<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/CashierBillingIntegrationService.php';

$config = load_integration_config();
$pdo = integration_db_connection();
$service = new CashierBillingIntegrationService($pdo, $config);

$billingId = isset($_GET['billing_id']) ? (int) $_GET['billing_id'] : 0;
$sourceModule = trim((string) ($_GET['source_module'] ?? 'clinic'));
$sourceId = trim((string) ($_GET['source_id'] ?? ''));

if ($billingId <= 0 || $sourceId === '') {
    json_response([
        'ok' => false,
        'message' => 'billing_id and source_id are required.',
    ], 422);
}

try {
    $data = $service->pollBillingStatus($billingId, $sourceModule, $sourceId);

    json_response([
        'ok' => true,
        'message' => 'Cashier billing status fetched successfully.',
        'data' => $data,
    ]);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'message' => $error->getMessage(),
    ], 500);
}
