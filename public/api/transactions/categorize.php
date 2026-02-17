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
    $body = getJsonBody();
    validateRequired($body, ['transaction_id']);
    
    // category_id can be null/empty to uncategorize
    $categoryId = !empty($body['category_id']) ? $body['category_id'] : null;
    
    $pdo = Database::getConnection();
    
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
    
    if ($stmt->rowCount() === 0) {
        Response::notFound('Transaction not found');
    }
    
    // Clear any existing splits when re-categorizing the whole transaction
    $pdo->prepare('DELETE FROM transaction_splits WHERE transaction_id = :id')
        ->execute(['id' => $body['transaction_id']]);
    
    // Fetch updated transaction
    $fetchStmt = $pdo->prepare('SELECT * FROM transactions WHERE id = :id');
    $fetchStmt->execute(['id' => $body['transaction_id']]);
    $transaction = $fetchStmt->fetch();
    
    // Auto-learn: create/update a rule from this manual categorization
    if ($categoryId && $transaction) {
        AutoCategorizer::learnFromCategorization(
            $pdo,
            $transaction['name'],
            $transaction['merchant_name'] ?? null,
            $categoryId
        );
    }
    
    Response::success($transaction);
} catch (Exception $e) {
    Response::error('Failed to categorize transaction: ' . $e->getMessage(), 500);
}
