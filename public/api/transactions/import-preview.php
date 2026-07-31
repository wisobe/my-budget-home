<?php
/**
 * CSV Import Preview (dry run) - no writes
 * POST /api/transactions/import-preview.php
 * Body: {
 *   account_id, rows: [ { date, name, amount|debit/credit, merchant_name?, notes?, currency? } ],
 *   mapping: { date_format, sign_convention },
 *   allow_duplicates?: bool
 * }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/CsvImport.php';

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

    $pdo = Database::getConnection();

    $accStmt = $pdo->prepare('SELECT id, currency FROM accounts WHERE id = :id AND user_id = :user_id');
    $accStmt->execute(['id' => $body['account_id'], 'user_id' => $userId]);
    $account = $accStmt->fetch();
    if (!$account) {
        Response::notFound('Account not found');
    }

    $valid = [];
    $invalid = [];
    foreach ($rows as $i => $raw) {
        if (!is_array($raw)) {
            $invalid[] = ['row' => $i + 1, 'reason' => 'invalid_row'];
            continue;
        }
        $result = CsvImport::normalizeRow($raw, $mapping);
        if (!$result['ok']) {
            $invalid[] = ['row' => $i + 1, 'reason' => $result['error']];
            continue;
        }
        $valid[] = ['row' => $i + 1] + $result['row'];
    }

    $fingerprints = CsvImport::loadFingerprints($pdo, $account['id'], array_column($valid, 'date'));

    $toImport = [];
    $duplicates = [];
    $seen = [];

    foreach ($valid as $row) {
        $fp = CsvImport::fingerprint($row['date'], $row['amount'], $row['name']);
        $isDupe = isset($fingerprints[$fp]) || isset($seen[$fp]);
        $seen[$fp] = true;

        if ($isDupe && !$allowDuplicates) {
            $duplicates[] = $row;
        } else {
            $toImport[] = $row;
        }
    }

    Response::success([
        'account_id' => $account['id'],
        'total_rows' => count($rows),
        'to_import' => count($toImport),
        'duplicates' => count($duplicates),
        'invalid' => count($invalid),
        'preview' => array_slice($toImport, 0, 25),
        'duplicate_preview' => array_slice($duplicates, 0, 25),
        'invalid_rows' => array_slice($invalid, 0, 25),
    ]);
} catch (Exception $e) {
    Response::error('Preview failed: ' . $e->getMessage(), 500);
}
