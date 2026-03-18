<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$config = load_integration_config();
$clinicConfig = $config['clinic_system'] ?? [];
$cashierConfig = $config['cashier_system'] ?? [];

require_shared_token((string) ($clinicConfig['shared_token'] ?? ''));

$payload = read_json_request_body();
$event = is_array($payload['event'] ?? null) ? $payload['event'] : [];

append_integration_log(
    (string) ($cashierConfig['log_file'] ?? (__DIR__ . '/logs/cashier-integration.log')),
    'Received clinic integration event',
    [
        'source' => $payload['source'] ?? 'unknown',
        'event' => $event,
    ]
);

json_response([
    'ok' => true,
    'message' => 'Clinic event received.',
    'received' => [
        'source_module' => $event['source_module'] ?? null,
        'source_key' => $event['source_key'] ?? null,
        'reference_no' => $event['reference_no'] ?? null,
    ],
]);
