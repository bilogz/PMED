<?php

declare(strict_types=1);

final class ClinicSystemClient
{
    private string $baseUrl;
    private string $sharedToken;
    private int $timeoutSeconds;

    public function __construct(array $config)
    {
        $baseUrl = rtrim((string) ($config['base_url'] ?? ''), '/');
        if ($baseUrl === '') {
            throw new InvalidArgumentException('Clinic system base_url is required.');
        }

        $this->baseUrl = $baseUrl;
        $this->sharedToken = (string) ($config['shared_token'] ?? '');
        $this->timeoutSeconds = max(5, (int) ($config['timeout_seconds'] ?? 20));
    }

    public function get(string $path, array $query = []): array
    {
        $url = $this->buildUrl($path, $query);
        return $this->request('GET', $url);
    }

    public function post(string $path, array $payload = []): array
    {
        $url = $this->buildUrl($path);
        return $this->request('POST', $url, $payload);
    }

    private function buildUrl(string $path, array $query = []): string
    {
        $normalizedPath = '/' . ltrim($path, '/');
        $url = $this->baseUrl . $normalizedPath;
        if ($query !== []) {
            $url .= '?' . http_build_query($query);
        }

        return $url;
    }

    private function request(string $method, string $url, ?array $payload = null): array
    {
        $ch = curl_init($url);

        $headers = [
            'Accept: application/json',
        ];

        if ($this->sharedToken !== '') {
            $headers[] = 'X-Shared-Token: ' . $this->sharedToken;
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
        ]);

        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        $raw = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($raw === false) {
            throw new RuntimeException('Clinic API request failed: ' . $curlError);
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Clinic API returned invalid JSON. HTTP ' . $statusCode);
        }

        if ($statusCode >= 400 || (($decoded['ok'] ?? true) === false)) {
            $message = (string) ($decoded['message'] ?? ('Clinic API error. HTTP ' . $statusCode));
            throw new RuntimeException($message);
        }

        return $decoded;
    }
}
