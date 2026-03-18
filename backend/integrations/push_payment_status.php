<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/ClinicSystemClient.php';

$config = load_integration_config();
$client = new ClinicSystemClient($config['clinic_system'] ?? []);
$input = read_json_request_body();

if (($input['source_module'] ?? '') === '' || ($input['source_key'] ?? '') === '') {
    json_response([
        'ok' => false,
        'message' => 'source_module and source_key are required.',
    ], 422);
}

try {
    $response = $client->post('/api/integrations/cashier/payment-status', [
        'source_module' => (string) $input['source_module'],
        'source_key' => (string) $input['source_key'],
        'cashier_reference' => $input['cashier_reference'] ?? null,
        'invoice_number' => $input['invoice_number'] ?? null,
        'official_receipt' => $input['official_receipt'] ?? null,
        'amount_due' => $input['amount_due'] ?? 0,
        'amount_paid' => $input['amount_paid'] ?? 0,
        'balance_due' => $input['balance_due'] ?? 0,
        'payment_status' => $input['payment_status'] ?? 'unpaid',
        'paid_at' => $input['paid_at'] ?? null,
        'actor' => $input['actor'] ?? 'Cashier System',
        'metadata' => is_array($input['metadata'] ?? null) ? $input['metadata'] : [],
    ]);

    json_response([
        'ok' => true,
        'message' => 'Payment status pushed to clinic system.',
        'data' => $response['data'] ?? null,
    ]);
} catch (Throwable $error) {
    json_response([
        'ok' => false,
        'message' => $error->getMessage(),
    ], 500);
}
