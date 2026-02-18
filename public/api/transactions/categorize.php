<?php
/**
 * Categorize Transaction Endpoint
 * POST /api/transactions/categorize.php
 * Body: { "transaction_id": "...", "category_id": "..." or null }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/AutoCategorizer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['transaction_id']);
    
    $categoryId = !empty($body['category_id']) ? $body['category_id'] : null;
    
    $pdo = Database::getConnection();
    
    // Verify transaction belongs to user (through account)
    $checkStmt = $pdo->prepare('
        SELECT t.id FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        WHERE t.id = :id AND a.user_id = :user_id
    ');
    $checkStmt->execute(['id' => $body['transaction_id'], 'user_id' => $userId]);
    if (!$checkStmt->fetch()) {
        Response::notFound('Transaction not found');
    }
    
    // Update transaction category
    $stmt = $pdo->prepare('
        UPDATE transactions 
        SET category_id = :category_id, updated_at = NOW()
        WHERE id = :id
    ');
    $stmt->execute([
        'category_id' => $categoryId,
        'id' => $body['transaction_id'],
    ]);
    
    // Clear existing splits
    $pdo->prepare('DELETE FROM transaction_splits WHERE transaction_id = :id')
        ->execute(['id' => $body['transaction_id']]);
    
    // Fetch updated transaction
    $fetchStmt = $pdo->prepare('SELECT * FROM transactions WHERE id = :id');
    $fetchStmt->execute(['id' => $body['transaction_id']]);
    $transaction = $fetchStmt->fetch();
    
    // Auto-learn rule
    if ($categoryId && $transaction) {
        AutoCategorizer::learnFromCategorization(
            $pdo,
            $transaction['name'],
            $transaction['merchant_name'] ?? null,
            $categoryId,
            $userId
        );
    }
    
    Response::success($transaction);
} catch (Exception $e) {
    Response::error('Failed to categorize transaction: ' . $e->getMessage(), 500);
}
