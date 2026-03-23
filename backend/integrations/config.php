<?php

return [
    'database' => [
        // Supabase / PostgreSQL only
        // Prefer `database_url` (same as Supabase `DATABASE_URL`).
        'database_url' => 'postgresql://postgres.cbwgqzrgcyxycajvmvwr:09672979919@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
        'host' => 'aws-1-ap-northeast-1.pooler.supabase.com',
        'port' => 5432,
        'database' => 'postgres',
        'username' => 'postgres.cbwgqzrgcyxycajvmvwr',
        'password' => '09672979919',
        'supabase' => [
            'project_url' => 'https://cbwgqzrgcyxycajvmvwr.supabase.co',
            'anon_key' => '',
            'service_role_key' => '',
            'db_host' => 'aws-1-ap-northeast-1.pooler.supabase.com',
            'db_port' => 6543,
            'db_name' => 'postgres',
            'db_user' => 'postgres.cbwgqzrgcyxycajvmvwr',
            'db_password' => '09672979919',
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
