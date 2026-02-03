<?php
/**
 * Categorize Transaction Endpoint
 * POST /api/transactions/categorize.php
 * 
 * Assigns a category to a transaction
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['transaction_id', 'category_id']);
    
    $pdo = Database::getConnection();
    
    $stmt = $pdo->prepare('
        UPDATE transactions 
        SET category_id = :category_id, updated_at = NOW()
        WHERE id = :id
    ');
    
    $stmt->execute([
        'category_id' => $body['category_id'],
        'id' => $body['transaction_id'],
    ]);
    
    if ($stmt->rowCount() === 0) {
        Response::notFound('Transaction not found');
    }
    
    // Fetch updated transaction
    $fetchStmt = $pdo->prepare('SELECT * FROM transactions WHERE id = :id');
    $fetchStmt->execute(['id' => $body['transaction_id']]);
    $transaction = $fetchStmt->fetch();
    
    Response::success($transaction);
} catch (Exception $e) {
    Response::error('Failed to categorize transaction: ' . $e->getMessage(), 500);
}
