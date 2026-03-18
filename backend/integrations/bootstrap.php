<?php

declare(strict_types=1);

function integration_root_path(string $suffix = ''): string
{
    $root = __DIR__;
    return $suffix === '' ? $root : $root . DIRECTORY_SEPARATOR . ltrim($suffix, DIRECTORY_SEPARATOR);
}

function load_integration_config(): array
{
    $configPath = integration_root_path('config.php');
    $examplePath = integration_root_path('config.example.php');

    if (file_exists($configPath)) {
        $config = require $configPath;
    } else {
        $config = require $examplePath;
    }

    return is_array($config) ? $config : [];
}

function integration_db_config(): array
{
    $config = load_integration_config();
    $dbConfig = is_array($config['database'] ?? null) ? $config['database'] : [];

    return [
        'host' => (string) ($dbConfig['host'] ?? '127.0.0.1'),
        'port' => (int) ($dbConfig['port'] ?? 3306),
        'database' => (string) ($dbConfig['database'] ?? ''),
        'username' => (string) ($dbConfig['username'] ?? 'root'),
        'password' => (string) ($dbConfig['password'] ?? ''),
        'charset' => (string) ($dbConfig['charset'] ?? 'utf8mb4'),
    ];
}

function integration_db_connection(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dbConfig = integration_db_config();
    if ($dbConfig['database'] === '') {
        throw new RuntimeException('MYSQL_DATABASE is not configured for the integration PHP files.');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $dbConfig['host'],
        $dbConfig['port'],
        $dbConfig['database'],
        $dbConfig['charset']
    );

    try {
        $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $exception) {
        throw new RuntimeException('Unable to connect to the MySQL database: ' . $exception->getMessage(), 0, $exception);
    }

    return $pdo;
}

function read_json_request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function json_response(array $payload, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function require_shared_token(string $expectedToken): void
{
    $providedToken = (string) ($_SERVER['HTTP_X_SHARED_TOKEN'] ?? '');
    if ($providedToken === '') {
        $providedToken = (string) ($_SERVER['HTTP_X_INTEGRATION_TOKEN'] ?? '');
    }
    if ($providedToken === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authorization = trim((string) $_SERVER['HTTP_AUTHORIZATION']);
        if (stripos($authorization, 'Bearer ') === 0) {
            $providedToken = trim(substr($authorization, 7));
        }
    }

    if ($expectedToken === '' || !hash_equals($expectedToken, $providedToken)) {
        json_response([
            'ok' => false,
            'message' => 'Unauthorized integration request.',
        ], 401);
    }
}

function append_integration_log(string $filePath, string $message, array $context = []): void
{
    $directory = dirname($filePath);
    if (!is_dir($directory)) {
        mkdir($directory, 0777, true);
    }

    $line = sprintf(
        "[%s] %s %s%s",
        date('Y-m-d H:i:s'),
        $message,
        $context !== [] ? json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '',
        PHP_EOL
    );

    file_put_contents($filePath, $line, FILE_APPEND);
}
