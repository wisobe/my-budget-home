<?php
/**
 * Create Manual Transaction Endpoint
 * POST /api/transactions/create.php
 * Body: { "account_id", "date", "name", "amount", "category_id"?, "notes"? }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/AutoCategorizer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['account_id', 'date', 'name', 'amount']);
    
    $pdo = Database::getConnection();
    
    // Verify account belongs to user
    $accStmt = $pdo->prepare('SELECT id FROM accounts WHERE id = :id AND user_id = :user_id');
    $accStmt->execute(['id' => $body['account_id'], 'user_id' => $userId]);
    if (!$accStmt->fetch()) {
        Response::error('Account not found', 404);
    }
    
    $id = 'txn_' . uniqid();
    
    // Auto-categorize if no category provided
    $categoryId = !empty($body['category_id']) ? $body['category_id'] : null;
    if (!$categoryId) {
        $categoryId = AutoCategorizer::match($pdo, $body['name'], $body['merchant_name'] ?? null, $userId);
    }
    
    $stmt = $pdo->prepare('
        INSERT INTO transactions (id, account_id, date, name, merchant_name, amount, category_id, notes, pending, excluded, created_at, updated_at)
        VALUES (:id, :account_id, :date, :name, :merchant_name, :amount, :category_id, :notes, 0, 0, NOW(), NOW())
    ');
    
    $stmt->execute([
        'id' => $id,
        'account_id' => $body['account_id'],
        'date' => $body['date'],
        'name' => $body['name'],
        'merchant_name' => $body['merchant_name'] ?? null,
        'amount' => $body['amount'],
        'category_id' => $categoryId,
        'notes' => $body['notes'] ?? null,
    ]);
    
    $fetchStmt = $pdo->prepare('SELECT * FROM transactions WHERE id = :id');
    $fetchStmt->execute(['id' => $id]);
    
    Response::success($fetchStmt->fetch(), 'Transaction created');
} catch (Exception $e) {
    Response::error('Failed to create transaction: ' . $e->getMessage(), 500);
}
