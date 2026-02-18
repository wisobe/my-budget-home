<?php
/**
 * Exclude/Include Transaction Endpoint
 * POST /api/transactions/exclude.php
 * Body: { "transaction_id": "...", "excluded": true/false }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['transaction_id']);
    
    $excluded = isset($body['excluded']) ? (bool)$body['excluded'] : true;
    
    $pdo = Database::getConnection();
    
    // Verify ownership
    $checkStmt = $pdo->prepare('
        SELECT t.id FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        WHERE t.id = :id AND a.user_id = :user_id
    ');
    $checkStmt->execute(['id' => $body['transaction_id'], 'user_id' => $userId]);
    if (!$checkStmt->fetch()) {
        Response::notFound('Transaction not found');
    }
    
    $stmt = $pdo->prepare('UPDATE transactions SET excluded = :excluded, updated_at = NOW() WHERE id = :id');
    $stmt->execute([
        'excluded' => $excluded ? 1 : 0,
        'id' => $body['transaction_id'],
    ]);
    
    Response::success(['excluded' => $excluded], $excluded ? 'Transaction excluded' : 'Transaction included');
} catch (Exception $e) {
    Response::error('Failed to update transaction: ' . $e->getMessage(), 500);
}
