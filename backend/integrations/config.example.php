<?php

return [
    'database' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'database' => 'clinic_system',
        'username' => 'root',
        'password' => '',
        'charset' => 'utf8mb4',
    ],
    'clinic_system' => [
        'base_url' => 'http://localhost:5173',
        'shared_token' => 'replace-with-a-shared-secret',
        'timeout_seconds' => 20,
    ],
    'cashier_api' => [
        'base_url' => 'http://localhost/cashier-integration/api',
        'shared_token' => 'replace-with-a-strong-shared-token',
        'timeout_seconds' => 20,
    ],
    'cashier_system' => [
        'module_name' => 'cashier',
        'log_file' => __DIR__ . '/logs/cashier-integration.log',
        'max_retries' => 3,
    ],
];
