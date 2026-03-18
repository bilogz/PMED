<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/CashierApiClient.php';

final class CashierBillingIntegrationService
{
    private PDO $pdo;
    private CashierApiClient $client;
    private array $tableColumnCache = [];
    private string $logFile;
    private int $maxRetries;

    public function __construct(PDO $pdo, array $config)
    {
        $this->pdo = $pdo;
        $this->client = new CashierApiClient($config['cashier_api'] ?? []);
        $cashierConfig = is_array($config['cashier_system'] ?? null) ? $config['cashier_system'] : [];
        $this->logFile = (string) ($cashierConfig['log_file'] ?? (__DIR__ . '/logs/cashier-integration.log'));
        $this->maxRetries = max(1, (int) ($cashierConfig['max_retries'] ?? 3));
        $this->ensureIntegrationTables();
    }

    public function syncClinicBillable(array $payload): array
    {
        $errors = $this->validatePayload($payload);
        if ($errors !== []) {
            $this->writeSyncLog($payload, 'validation_failed', null, 'Validation failed.', null, ['errors' => $errors]);
            throw new InvalidArgumentException('Validation failed: ' . json_encode($errors, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        $existing = $this->fetchPaymentLink((string) $payload['source_module'], (string) $payload['source_id']);
        if ($existing !== null && !empty($existing['cashier_billing_id'])) {
            return [
                'billing_id' => (int) $existing['cashier_billing_id'],
                'billing_no' => $existing['cashier_reference'] ?? null,
                'status' => $existing['payment_status'] ?? 'existing',
                'sync_mode' => 'existing',
            ];
        }

        $attempt = 0;
        $lastError = null;

        while ($attempt < $this->maxRetries) {
            $attempt++;

            try {
                $response = $this->client->post('/cashier/billing/create', $payload);
                $data = (array) ($response['data'] ?? []);
                $this->persistSuccessfulSync($payload, $data);
                $this->writeSyncLog($payload, 'synced', (int) ($data['billing_id'] ?? 0), null, $data, null, $attempt);

                append_integration_log($this->logFile, 'Clinic billable synced to cashier.', [
                    'source_module' => $payload['source_module'],
                    'source_id' => $payload['source_id'],
                    'billing_id' => $data['billing_id'] ?? null,
                    'billing_no' => $data['billing_no'] ?? null,
                    'attempt' => $attempt,
                ]);

                return [
                    'billing_id' => (int) ($data['billing_id'] ?? 0),
                    'billing_no' => (string) ($data['billing_no'] ?? ''),
                    'status' => (string) ($data['status'] ?? 'synced'),
                    'sync_mode' => 'created',
                ];
            } catch (Throwable $error) {
                $lastError = $error->getMessage();
                $this->writeSyncLog($payload, 'failed', null, $lastError, null, null, $attempt);
                append_integration_log($this->logFile, 'Clinic billable sync failed.', [
                    'source_module' => $payload['source_module'],
                    'source_id' => $payload['source_id'],
                    'attempt' => $attempt,
                    'error' => $lastError,
                ]);
            }
        }

        throw new RuntimeException($lastError ?: 'Cashier sync failed.');
    }

    public function pollBillingStatus(int $billingId, string $sourceModule, string $sourceId): array
    {
        $response = $this->client->get('/cashier/billing/status/' . $billingId);
        $data = (array) ($response['data'] ?? []);

        $this->persistStatusUpdate($sourceModule, $sourceId, $data);
        $this->writeSyncLog([
            'source_module' => $sourceModule,
            'source_type' => 'status_poll',
            'source_id' => $sourceId,
        ], 'status_polled', $billingId, null, $data);

        return $data;
    }

    public function verifyClinicBookingPayment(int $billingId, string $sourceModule, string $sourceId): array
    {
        $response = $this->client->get('/cashier/billing/verify-proceed/' . $billingId);
        $data = (array) ($response['data'] ?? []);

        $verification = (array) ($data['verification'] ?? []);
        $this->persistStatusUpdate($sourceModule, $sourceId, array_merge($data, [
            'payment_verification' => $verification,
        ]));
        $this->writeSyncLog([
            'source_module' => $sourceModule,
            'source_type' => 'payment_verification',
            'source_id' => $sourceId,
        ], 'payment_verified_check', $billingId, null, $data);

        return $data;
    }

    public function handlePaymentCallback(array $payload): array
    {
        $billingId = (int) ($payload['billing_id'] ?? 0);
        $sourceModule = trim((string) ($payload['source_module'] ?? ''));
        $sourceId = trim((string) ($payload['source_id'] ?? ''));

        if ($billingId <= 0 || $sourceModule === '' || $sourceId === '') {
            throw new InvalidArgumentException('billing_id, source_module, and source_id are required.');
        }

        $statusPayload = [
            'billing_id' => $billingId,
            'billing_no' => $payload['billing_no'] ?? null,
            'status' => $payload['status'] ?? 'unpaid',
            'workflow_stage' => $payload['workflow_stage'] ?? null,
            'amount' => round((float) ($payload['amount'] ?? 0), 2),
            'paid_amount' => round((float) ($payload['paid_amount'] ?? 0), 2),
            'remaining_balance' => round((float) ($payload['remaining_balance'] ?? 0), 2),
            'payment_status' => $payload['payment_status'] ?? $payload['status'] ?? 'unpaid',
            'latest_payment_reference' => $payload['latest_payment_reference'] ?? null,
            'latest_payment_method' => $payload['latest_payment_method'] ?? null,
            'receipt_number' => $payload['receipt_number'] ?? null,
            'receipt_status' => $payload['receipt_status'] ?? null,
            'source' => [
                'source_module' => $sourceModule,
                'source_type' => $payload['source_type'] ?? null,
                'source_id' => $sourceId,
                'patient_id' => $payload['patient_id'] ?? null,
                'student_id' => $payload['student_id'] ?? null,
            ],
        ];

        $this->persistStatusUpdate($sourceModule, $sourceId, $statusPayload);
        $this->writeSyncLog([
            'source_module' => $sourceModule,
            'source_type' => (string) ($payload['source_type'] ?? 'payment_callback'),
            'source_id' => $sourceId,
            'patient_id' => (string) ($payload['patient_id'] ?? ''),
            'student_id' => (string) ($payload['student_id'] ?? ''),
            'created_by' => (string) ($payload['actor'] ?? 'Cashier System'),
        ], 'callback_received', $billingId, null, $statusPayload);

        return $statusPayload;
    }

    public function buildSharedPayload(array $input): array
    {
        return [
            'student_id' => (string) ($input['student_id'] ?? ''),
            'patient_id' => (string) ($input['patient_id'] ?? ''),
            'source_type' => (string) ($input['source_type'] ?? ''),
            'source_module' => (string) ($input['source_module'] ?? ''),
            'source_id' => (string) ($input['source_id'] ?? ''),
            'fee_type' => (string) ($input['fee_type'] ?? ''),
            'description' => (string) ($input['description'] ?? ''),
            'amount' => round((float) ($input['amount'] ?? 0), 2),
            'due_date' => (string) ($input['due_date'] ?? ''),
            'created_by' => (string) ($input['created_by'] ?? ''),
            'student_name' => (string) ($input['student_name'] ?? ''),
            'program' => (string) ($input['program'] ?? ''),
            'semester' => (string) ($input['semester'] ?? 'Clinic Charges'),
            'academic_year' => (string) ($input['academic_year'] ?? ''),
            'metadata' => is_array($input['metadata'] ?? null) ? $input['metadata'] : [],
        ];
    }

    private function validatePayload(array $payload): array
    {
        $required = ['student_id', 'patient_id', 'source_type', 'source_module', 'source_id', 'fee_type', 'description', 'amount', 'due_date', 'created_by'];
        $errors = [];

        foreach ($required as $field) {
            $value = $payload[$field] ?? null;
            if ($value === null || trim((string) $value) === '') {
                $errors[$field] = 'This field is required.';
            }
        }

        if ((float) ($payload['amount'] ?? 0) <= 0) {
            $errors['amount'] = 'Amount must be greater than zero.';
        }

        if (strtotime((string) ($payload['due_date'] ?? '')) === false) {
            $errors['due_date'] = 'Due date must be valid.';
        }

        return $errors;
    }

    private function fetchPaymentLink(string $sourceModule, string $sourceId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM cashier_payment_links WHERE source_module = ? AND source_key = ? LIMIT 1'
        );
        $statement->execute([$sourceModule, $sourceId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    private function persistSuccessfulSync(array $payload, array $cashierData): void
    {
        $this->pdo->beginTransaction();

        try {
            $this->pdo->prepare(
                "INSERT INTO cashier_payment_links (
                    source_module, source_key, cashier_reference, cashier_billing_id, amount_due, amount_paid, balance_due,
                    payment_status, latest_payment_method, metadata
                ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'unpaid', NULL, ?)
                ON DUPLICATE KEY UPDATE
                    cashier_reference = VALUES(cashier_reference),
                    cashier_billing_id = VALUES(cashier_billing_id),
                    amount_due = VALUES(amount_due),
                    balance_due = VALUES(balance_due),
                    payment_status = VALUES(payment_status),
                    metadata = VALUES(metadata)"
            )->execute([
                (string) $payload['source_module'],
                (string) $payload['source_id'],
                (string) ($cashierData['billing_no'] ?? ''),
                (int) ($cashierData['billing_id'] ?? 0),
                round((float) $payload['amount'], 2),
                round((float) $payload['amount'], 2),
                json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ]);

            $this->persistSourceRecordReference(
                (string) $payload['source_module'],
                (string) $payload['source_id'],
                [
                    'cashier_billing_id' => (int) ($cashierData['billing_id'] ?? 0),
                    'cashier_billing_no' => (string) ($cashierData['billing_no'] ?? ''),
                    'cashier_payment_status' => 'unpaid',
                ]
            );

            $this->pdo->commit();
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw new RuntimeException('Cashier billing was created but clinic persistence failed: ' . $error->getMessage(), 0, $error);
        }
    }

    private function persistStatusUpdate(string $sourceModule, string $sourceId, array $status): void
    {
        $amount = (float) ($status['amount'] ?? 0);
        $paidAmount = (float) ($status['paid_amount'] ?? 0);
        $balanceAmount = (float) ($status['remaining_balance'] ?? 0);

        $paymentStatus = strtolower((string) ($status['payment_status'] ?? 'unpaid'));
        $verification = is_array($status['payment_verification'] ?? null)
            ? $status['payment_verification']
            : (is_array($status['verification'] ?? null) ? $status['verification'] : []);
        $canProceed = (int) ((($verification['can_proceed'] ?? false) === true) ? 1 : 0);

        $this->pdo->beginTransaction();

        try {
            $this->pdo->prepare(
                "UPDATE cashier_payment_links
                 SET cashier_reference = ?,
                     cashier_billing_id = ?,
                     official_receipt = ?,
                     amount_due = ?,
                     amount_paid = ?,
                     balance_due = ?,
                     payment_status = ?,
                     latest_payment_method = ?,
                     cashier_can_proceed = ?,
                     cashier_verified_at = CASE WHEN ? = 1 THEN NOW() ELSE cashier_verified_at END,
                     paid_at = CASE WHEN ? IN ('paid', 'partial') THEN NOW() ELSE paid_at END,
                     metadata = ?
                 WHERE source_module = ? AND source_key = ?"
            )->execute([
                (string) ($status['billing_no'] ?? ''),
                (int) ($status['billing_id'] ?? 0),
                $status['receipt_number'] ?? null,
                $amount,
                $paidAmount,
                $balanceAmount,
                $paymentStatus,
                $status['latest_payment_method'] ?? null,
                $canProceed,
                $canProceed,
                $paymentStatus,
                json_encode($status, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                $sourceModule,
                $sourceId,
            ]);

            $this->persistSourceRecordReference($sourceModule, $sourceId, [
                'cashier_billing_id' => (int) ($status['billing_id'] ?? 0),
                'cashier_billing_no' => (string) ($status['billing_no'] ?? ''),
                'cashier_payment_status' => $paymentStatus,
                'cashier_can_proceed' => $canProceed,
            ]);

            $this->pdo->commit();
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }
    }

    private function ensureIntegrationTables(): void
    {
        $this->pdo->exec(
            "CREATE TABLE IF NOT EXISTS clinic_cashier_sync_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                source_module VARCHAR(80) NOT NULL,
                source_type VARCHAR(80) NOT NULL,
                source_id VARCHAR(120) NOT NULL,
                patient_id VARCHAR(120) NOT NULL,
                student_id VARCHAR(120) NOT NULL,
                cashier_billing_id BIGINT NULL,
                sync_status VARCHAR(30) NOT NULL DEFAULT 'pending',
                retry_count INT NOT NULL DEFAULT 0,
                error_message TEXT NULL,
                request_payload JSON NULL,
                response_payload JSON NULL,
                extra_payload JSON NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_clinic_cashier_sync_lookup (source_module, source_id),
                KEY idx_clinic_cashier_sync_status (sync_status, created_at)
            )"
        );

        $this->pdo->exec(
            "CREATE TABLE IF NOT EXISTS clinic_cashier_audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                source_module VARCHAR(80) NOT NULL,
                source_id VARCHAR(120) NOT NULL,
                action_name VARCHAR(80) NOT NULL,
                status_after VARCHAR(40) NOT NULL,
                remarks TEXT NULL,
                actor_name VARCHAR(150) NOT NULL,
                payload_json JSON NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_clinic_cashier_audit_source (source_module, source_id, created_at)
            )"
        );

        try {
            $this->pdo->exec("ALTER TABLE cashier_payment_links ADD COLUMN latest_payment_method VARCHAR(40) NULL AFTER payment_status");
        } catch (Throwable $error) {
            // Column may already exist in migrated environments.
        }

        try {
            $this->pdo->exec("ALTER TABLE cashier_payment_links ADD COLUMN cashier_can_proceed TINYINT(1) NOT NULL DEFAULT 0 AFTER latest_payment_method");
        } catch (Throwable $error) {
            // Column may already exist in migrated environments.
        }

        try {
            $this->pdo->exec("ALTER TABLE cashier_payment_links ADD COLUMN cashier_verified_at DATETIME NULL AFTER cashier_can_proceed");
        } catch (Throwable $error) {
            // Column may already exist in migrated environments.
        }
    }

    private function persistSourceRecordReference(string $sourceModule, string $sourceId, array $reference): void
    {
        $billingId = (int) ($reference['cashier_billing_id'] ?? 0);
        $billingNo = (string) ($reference['cashier_billing_no'] ?? '');
        $paymentStatus = (string) ($reference['cashier_payment_status'] ?? 'unpaid');
        $canProceed = (int) ($reference['cashier_can_proceed'] ?? 0);

        if ($sourceModule === 'laboratory') {
            if (!$this->tableHasColumns('laboratory_requests', ['cashier_billing_id', 'billing_reference', 'cashier_payment_status'])) {
                return;
            }
            $query = "UPDATE laboratory_requests
                 SET cashier_billing_id = ?, billing_reference = ?, cashier_payment_status = ?";
            $params = [$billingId, $billingNo !== '' ? $billingNo : null, $paymentStatus];
            if ($this->tableHasColumns('laboratory_requests', ['cashier_can_proceed'])) {
                $query .= ", cashier_can_proceed = ?";
                $params[] = $canProceed;
            }
            if ($this->tableHasColumns('laboratory_requests', ['cashier_verified_at'])) {
                $query .= ", cashier_verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE cashier_verified_at END";
                $params[] = $canProceed;
            }
            $query .= ", updated_at = CURRENT_TIMESTAMP WHERE request_id = ?";
            $params[] = $sourceId;
            $this->pdo->prepare($query)->execute($params);
            return;
        }

        if ($sourceModule === 'pharmacy') {
            if (!$this->tableHasColumns('pharmacy_dispense_requests', ['cashier_billing_id', 'cashier_billing_no', 'cashier_payment_status'])) {
                return;
            }
            $query = "UPDATE pharmacy_dispense_requests
                 SET cashier_billing_id = ?, cashier_billing_no = ?, cashier_payment_status = ?";
            $params = [$billingId, $billingNo !== '' ? $billingNo : null, $paymentStatus];
            if ($this->tableHasColumns('pharmacy_dispense_requests', ['cashier_can_proceed'])) {
                $query .= ", cashier_can_proceed = ?";
                $params[] = $canProceed;
            }
            if ($this->tableHasColumns('pharmacy_dispense_requests', ['cashier_verified_at'])) {
                $query .= ", cashier_verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE cashier_verified_at END";
                $params[] = $canProceed;
            }
            $query .= " WHERE request_code = ?";
            $params[] = $sourceId;
            $this->pdo->prepare($query)->execute($params);
            return;
        }

        if ($sourceModule === 'appointments') {
            if (!$this->tableHasColumns('patient_appointments', ['cashier_billing_id', 'cashier_billing_no', 'cashier_payment_status'])) {
                return;
            }
            $query = "UPDATE patient_appointments
                 SET cashier_billing_id = ?, cashier_billing_no = ?, cashier_payment_status = ?";
            $params = [$billingId, $billingNo !== '' ? $billingNo : null, $paymentStatus];
            if ($this->tableHasColumns('patient_appointments', ['cashier_can_proceed'])) {
                $query .= ", cashier_can_proceed = ?";
                $params[] = $canProceed;
            }
            if ($this->tableHasColumns('patient_appointments', ['cashier_verified_at'])) {
                $query .= ", cashier_verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE cashier_verified_at END";
                $params[] = $canProceed;
            }
            $query .= ", updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?";
            $params[] = $sourceId;
            $this->pdo->prepare($query)->execute($params);
            return;
        }

        if (in_array($sourceModule, ['checkup', 'consultation', 'clinic'], true)) {
            if (!$this->tableHasColumns('checkup_visits', ['cashier_billing_id', 'cashier_billing_no', 'cashier_payment_status'])) {
                return;
            }
            $query = "UPDATE checkup_visits
                 SET cashier_billing_id = ?, cashier_billing_no = ?, cashier_payment_status = ?";
            $params = [$billingId, $billingNo !== '' ? $billingNo : null, $paymentStatus];
            if ($this->tableHasColumns('checkup_visits', ['cashier_can_proceed'])) {
                $query .= ", cashier_can_proceed = ?";
                $params[] = $canProceed;
            }
            if ($this->tableHasColumns('checkup_visits', ['cashier_verified_at'])) {
                $query .= ", cashier_verified_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE cashier_verified_at END";
                $params[] = $canProceed;
            }
            $query .= ", updated_at = CURRENT_TIMESTAMP WHERE visit_id = ?";
            $params[] = $sourceId;
            $this->pdo->prepare($query)->execute($params);
        }
    }

    private function tableHasColumns(string $tableName, array $requiredColumns): bool
    {
        if (!isset($this->tableColumnCache[$tableName])) {
            try {
                $statement = $this->pdo->query('SHOW COLUMNS FROM `' . str_replace('`', '``', $tableName) . '`');
                $columns = $statement ? $statement->fetchAll(PDO::FETCH_COLUMN) : [];
                $this->tableColumnCache[$tableName] = array_map('strtolower', array_map('strval', $columns));
            } catch (Throwable $error) {
                $this->tableColumnCache[$tableName] = [];
            }
        }

        $available = $this->tableColumnCache[$tableName];
        foreach ($requiredColumns as $column) {
            if (!in_array(strtolower($column), $available, true)) {
                return false;
            }
        }

        return true;
    }

    private function writeSyncLog(
        array $payload,
        string $syncStatus,
        ?int $cashierBillingId,
        ?string $lastError,
        ?array $responsePayload,
        ?array $extra = null,
        int $retryCount = 0
    ): void {
        $this->pdo->prepare(
            "INSERT INTO clinic_cashier_sync_logs (
                source_module, source_type, source_id, patient_id, student_id, cashier_billing_id,
                sync_status, retry_count, error_message, request_payload, response_payload, extra_payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            (string) ($payload['source_module'] ?? ''),
            (string) ($payload['source_type'] ?? ''),
            (string) ($payload['source_id'] ?? ''),
            (string) ($payload['patient_id'] ?? ''),
            (string) ($payload['student_id'] ?? ''),
            $cashierBillingId,
            $syncStatus,
            $retryCount,
            $lastError,
            json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $responsePayload === null ? null : json_encode($responsePayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $extra === null ? null : json_encode($extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);

        $this->pdo->prepare(
            "INSERT INTO clinic_cashier_audit_logs (
                source_module, source_id, action_name, status_after, remarks, actor_name, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            (string) ($payload['source_module'] ?? ''),
            (string) ($payload['source_id'] ?? ''),
            'cashier_sync_' . $syncStatus,
            $syncStatus,
            $lastError ?? 'Cashier integration event recorded.',
            (string) ($payload['created_by'] ?? 'Clinic System'),
            json_encode([
                'request' => $payload,
                'response' => $responsePayload,
                'extra' => $extra,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);
    }
}
