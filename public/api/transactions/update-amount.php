<?php
/**
 * Update Transaction Amount (manual override for FX-converted transactions)
 * POST /api/transactions/update-amount.php
 * Body: { "transaction_id": "...", "amount": 12.34 }   // amount in CAD
 *        { "transaction_id": "...", "reset": true }    // revert to FX-converted value
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/FxRates.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['transaction_id']);

    $pdo = Database::getConnection();

    // Verify ownership and load row
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
        // Revert to FX-converted CAD amount if we have the original
        if ($tx['original_amount'] !== null && $tx['iso_currency_code']) {
            $conv = FxRates::convertToCad($pdo, (float)$tx['original_amount'], $tx['iso_currency_code'], $tx['date']);
            if (!$conv) Response::error('Could not fetch FX rate to reset amount', 500);
            $upd = $pdo->prepare('UPDATE transactions SET amount = :a, fx_rate = :r, amount_overridden = 0, updated_at = NOW() WHERE id = :id');
            $upd->execute(['a' => $conv['cad_amount'], 'r' => $conv['rate'], 'id' => $tx['id']]);
        } else {
            // Nothing to reset to — just clear the override flag
            $upd = $pdo->prepare('UPDATE transactions SET amount_overridden = 0, updated_at = NOW() WHERE id = :id');
            $upd->execute(['id' => $tx['id']]);
        }
    } else {
        if (!isset($body['amount']) || !is_numeric($body['amount'])) {
            Response::error('amount is required and must be numeric');
        }
        $newAmount = round((float)$body['amount'], 2);
        $upd = $pdo->prepare('UPDATE transactions SET amount = :a, amount_overridden = 1, updated_at = NOW() WHERE id = :id');
        $upd->execute(['a' => $newAmount, 'id' => $tx['id']]);
    }

    $fetch = $pdo->prepare('SELECT * FROM transactions WHERE id = :id');
    $fetch->execute(['id' => $tx['id']]);
    Response::success($fetch->fetch(), 'Amount updated');
} catch (Exception $e) {
    Response::error('Failed to update amount: ' . $e->getMessage(), 500);
}
