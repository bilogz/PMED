<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/ClinicSystemClient.php';

$config = load_integration_config();
$client = new ClinicSystemClient($config['clinic_system'] ?? []);

try {
    $response = $client->get('/api/integrations/cashier/queue', [
        'sync_status' => $_GET['sync_status'] ?? 'pending',
        'page' => $_GET['page'] ?? 1,
        'per_page' => $_GET['per_page'] ?? 20,
    ]);

    json_response([
        'ok' => true,
        'message' => 'Clinic cashier queue fetched successfully.',
        'data' => $response['data'] ?? [],
    ]);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'message' => $error->getMessage(),
    ], 500);
}
