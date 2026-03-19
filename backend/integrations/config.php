<?php

return [
    'database' => [
        // Supabase / PostgreSQL only
        // Prefer `database_url` (same as Supabase `DATABASE_URL`).
        'database_url' => '',
        'host' => 'db.your-project.supabase.co',
        'port' => 5432,
        'database' => 'postgres',
        'username' => 'postgres',
        'password' => '',
        'supabase' => [
            'project_url' => 'https://your-project.supabase.co',
            'anon_key' => '',
            'service_role_key' => '',
            'db_host' => 'db.your-project.supabase.co',
            'db_port' => 5432,
            'db_name' => 'postgres',
            'db_user' => 'postgres',
            'db_password' => '',
            'sslmode' => 'require',
        ],
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
