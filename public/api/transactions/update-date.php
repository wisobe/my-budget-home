<?php
/**
 * Update Transaction Date (manual override)
 * POST /api/transactions/update-date.php
 * Body: { "transaction_id": "...", "date": "2026-05-31" }
 *        { "transaction_id": "...", "reset": true }   // revert to original (bank) date
 *
 * The effective date is always stored in transactions.date, so every report,
 * budget, subscription and filter automatically uses the overridden date.
 * The bank-provided date is preserved in original_date.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['transaction_id']);

    $pdo = Database::getConnection();

    $stmt = $pdo->prepare('
        SELECT t.* FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        WHERE t.id = :id AND a.user_id = :user_id
    ');
    $stmt->execute(['id' => $body['transaction_id'], 'user_id' => $userId]);
    $tx = $stmt->fetch();
    if (!$tx) Response::notFound('Transaction not found');

    $reset = !empty($body['reset']);

    if ($reset) {
        if (!empty($tx['original_date'])) {
            $upd = $pdo->prepare('UPDATE transactions SET date = :d, original_date = NULL, date_overridden = 0, updated_at = NOW() WHERE id = :id');
            $upd->execute(['d' => $tx['original_date'], 'id' => $tx['id']]);
        } else {
            $upd = $pdo->prepare('UPDATE transactions SET date_overridden = 0, updated_at = NOW() WHERE id = :id');
            $upd->execute(['id' => $tx['id']]);
        }
    } else {
        $newDate = isset($body['date']) ? trim((string)$body['date']) : '';
        $d = DateTime::createFromFormat('Y-m-d', $newDate);
        if (!$d || $d->format('Y-m-d') !== $newDate) {
            Response::error('date is required and must be in YYYY-MM-DD format');
        }
        // Preserve the bank date the first time we override
        $originalDate = !empty($tx['original_date']) ? $tx['original_date'] : $tx['date'];
        $upd = $pdo->prepare('UPDATE transactions SET date = :d, original_date = :od, date_overridden = 1, updated_at = NOW() WHERE id = :id');
        $upd->execute(['d' => $newDate, 'od' => $originalDate, 'id' => $tx['id']]);
    }

    $fetch = $pdo->prepare('SELECT * FROM transactions WHERE id = :id');
    $fetch->execute(['id' => $tx['id']]);
    Response::success($fetch->fetch(), 'Date updated');
} catch (Exception $e) {
    Response::error('Failed to update date: ' . $e->getMessage(), 500);
}
