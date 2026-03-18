<?php

declare(strict_types=1);

require_once __DIR__ . '/ClinicSystemClient.php';

final class DepartmentIntegrationClient
{
    private ClinicSystemClient $client;

    public function __construct(array $clinicConfig)
    {
        $this->client = new ClinicSystemClient($clinicConfig);
    }

    public function fetchDepartmentMap(): array
    {
        $response = $this->client->get('/api/integrations/departments/map');
        return (array) ($response['data'] ?? []);
    }

    public function fetchRecords(string $departmentKey, array $query = []): array
    {
        $response = $this->client->get('/api/integrations/departments/records', array_merge($query, [
            'department' => $departmentKey,
        ]));

        return (array) ($response['data'] ?? []);
    }

    public function requestClearance(string $departmentKey, array $payload): array
    {
        $response = $this->client->post('/api/integrations/departments/records', array_merge($payload, [
            'action' => 'request_clearance',
            'department_key' => $departmentKey,
        ]));

        return (array) ($response['data'] ?? []);
    }

    public function submitDecision(string $departmentKey, array $payload): array
    {
        $response = $this->client->post('/api/integrations/departments/records', array_merge($payload, [
            'action' => 'submit_decision',
            'department_key' => $departmentKey,
        ]));

        return (array) ($response['data'] ?? []);
    }

    public function seedDefaultFlow(array $payload): array
    {
        $response = $this->client->post('/api/integrations/departments/records', array_merge($payload, [
            'action' => 'seed_defaults',
        ]));

        return (array) ($response['data'] ?? []);
    }
}
