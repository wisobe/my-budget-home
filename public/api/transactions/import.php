<?php
/**
 * CSV Import (write)
 * POST /api/transactions/import.php
 * Same body as import-preview.php. Inserts inside a DB transaction.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/CsvImport.php';
require_once __DIR__ . '/../includes/AutoCategorizer.php';
require_once __DIR__ . '/../includes/AutoExcluder.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['account_id']);

    $rows = $body['rows'] ?? [];
    if (!is_array($rows) || count($rows) === 0) {
        Response::error('No rows to import');
    }
    if (count($rows) > CsvImport::MAX_ROWS) {
        Response::error('Too many rows. Maximum is ' . CsvImport::MAX_ROWS . ' per import.');
    }

    $mapping = is_array($body['mapping'] ?? null) ? $body['mapping'] : [];
    $allowDuplicates = !empty($body['allow_duplicates']);
    $environment = getPlaidEnvironment();

    $pdo = Database::getConnection();

    $accStmt = $pdo->prepare('SELECT id FROM accounts WHERE id = :id AND user_id = :user_id');
    $accStmt->execute(['id' => $body['account_id'], 'user_id' => $userId]);
    $account = $accStmt->fetch();
    if (!$account) {
        Response::notFound('Account not found');
    }
    $accountId = $account['id'];

    $valid = [];
    $invalidCount = 0;
    foreach ($rows as $raw) {
        if (!is_array($raw)) { $invalidCount++; continue; }
        $result = CsvImport::normalizeRow($raw, $mapping);
        if (!$result['ok']) { $invalidCount++; continue; }
        $valid[] = $result['row'];
    }

    $fingerprints = CsvImport::loadFingerprints($pdo, $accountId, array_column($valid, 'date'));

    $imported = 0;
    $skipped = 0;
    $excluded = 0;
    $categorized = 0;

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare('
            INSERT INTO transactions
                (id, account_id, date, name, merchant_name, amount, iso_currency_code,
                 category_id, notes, pending, excluded, source, created_at, updated_at)
            VALUES
                (:id, :account_id, :date, :name, :merchant_name, :amount, :iso_currency_code,
                 :category_id, :notes, 0, :excluded, :source, NOW(), NOW())
        ');

        foreach ($valid as $row) {
            $fp = CsvImport::fingerprint($row['date'], $row['amount'], $row['name']);
            if (isset($fingerprints[$fp]) && !$allowDuplicates) {
                $skipped++;
                continue;
            }
            $fingerprints[$fp] = true;

            $categoryId = AutoCategorizer::match($pdo, $row['name'], $row['merchant_name'], $userId, $environment);
            if ($categoryId) $categorized++;

            $isExcluded = AutoExcluder::shouldExclude($pdo, $row['name'], $row['merchant_name'], $userId, $environment) ? 1 : 0;
            if ($isExcluded) $excluded++;

            $insert->execute([
                'id' => 'txn_' . uniqid('', true),
                'account_id' => $accountId,
                'date' => $row['date'],
                'name' => $row['name'],
                'merchant_name' => $row['merchant_name'],
                'amount' => $row['amount'],
                'iso_currency_code' => $row['currency'],
                'category_id' => $categoryId,
                'notes' => $row['notes'],
                'excluded' => $isExcluded,
                'source' => 'csv',
            ]);
            $imported++;
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    try {
        AuditLog::log('csv_import', $userId, null, json_encode([
            'account_id' => $accountId,
            'imported' => $imported,
            'skipped' => $skipped,
            'invalid' => $invalidCount,
        ]));
    } catch (Exception $e) {
        // auditing must never break the import
    }

    Response::success([
        'imported' => $imported,
        'skipped_duplicates' => $skipped,
        'invalid' => $invalidCount,
        'auto_categorized' => $categorized,
        'auto_excluded' => $excluded,
    ], 'Import complete');
} catch (Exception $e) {
    Response::error('Import failed: ' . $e->getMessage(), 500);
}
