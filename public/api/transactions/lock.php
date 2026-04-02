<?php
/**
 * Lock/Unlock Transaction Category Endpoint
 * POST /api/transactions/lock.php
 * Body: { "transaction_id": "...", "locked": true/false }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['transaction_id']);
    
    $locked = isset($body['locked']) ? (bool)$body['locked'] : true;
    
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
    
    $stmt = $pdo->prepare('UPDATE transactions SET auto_categorize_locked = :locked, updated_at = NOW() WHERE id = :id');
    $stmt->execute([
        'locked' => $locked ? 1 : 0,
        'id' => $body['transaction_id'],
    ]);
    
    Response::success(['auto_categorize_locked' => $locked], $locked ? 'Category locked' : 'Category unlocked');
} catch (Exception $e) {
    Response::error('Failed to update transaction: ' . $e->getMessage(), 500);
}
