<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/CashierBillingIntegrationService.php';

$config = load_integration_config();
$pdo = integration_db_connection();
$service = new CashierBillingIntegrationService($pdo, $config);
$cashierApiConfig = is_array($config['cashier_api'] ?? null) ? $config['cashier_api'] : [];

require_shared_token((string) ($cashierApiConfig['shared_token'] ?? ''));

try {
    $data = $service->handlePaymentCallback(read_json_request_body());

    json_response([
        'ok' => true,
        'message' => 'Cashier payment callback processed successfully.',
        'data' => $data,
    ]);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'message' => $error->getMessage(),
    ], 500);
}
