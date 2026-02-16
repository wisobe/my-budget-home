<?php
/**
 * Transaction Splits Endpoint
 * GET /api/transactions/splits.php?transaction_id=xxx - List splits
 * POST /api/transactions/splits.php - Save splits (replaces all)
 * DELETE /api/transactions/splits.php - Remove all splits
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $pdo = Database::getConnection();
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $transactionId = $_GET['transaction_id'] ?? null;
        if (!$transactionId) {
            Response::error('Missing transaction_id');
        }
        
        $stmt = $pdo->prepare('
            SELECT ts.*, cat.name as category_name, cat.color as category_color
            FROM transaction_splits ts
            LEFT JOIN categories cat ON ts.category_id = cat.id
            WHERE ts.transaction_id = :tid
            ORDER BY ts.created_at
        ');
        $stmt->execute(['tid' => $transactionId]);
        Response::success($stmt->fetchAll());
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['transaction_id', 'splits']);
        
        if (!is_array($body['splits']) || count($body['splits']) < 2) {
            Response::error('At least 2 split lines are required');
        }
        
        $transactionId = $body['transaction_id'];
        
        // Verify transaction exists
        $txnStmt = $pdo->prepare('SELECT amount FROM transactions WHERE id = :id');
        $txnStmt->execute(['id' => $transactionId]);
        $txn = $txnStmt->fetch();
        if (!$txn) {
            Response::notFound('Transaction not found');
        }
        
        // Validate splits sum equals transaction amount
        $splitSum = array_reduce($body['splits'], function($sum, $s) {
            return $sum + (float)$s['amount'];
        }, 0);
        
        if (abs($splitSum - (float)$txn['amount']) > 0.01) {
            Response::error('Split amounts must equal the transaction amount (' . $txn['amount'] . '), got ' . $splitSum);
        }
        
        $pdo->beginTransaction();
        
        // Delete existing splits
        $pdo->prepare('DELETE FROM transaction_splits WHERE transaction_id = :tid')
            ->execute(['tid' => $transactionId]);
        
        // Clear main transaction category (splits take over)
        $pdo->prepare('UPDATE transactions SET category_id = NULL, updated_at = NOW() WHERE id = :id')
            ->execute(['id' => $transactionId]);
        
        // Insert new splits
        $insertStmt = $pdo->prepare('
            INSERT INTO transaction_splits (id, transaction_id, category_id, amount, is_excluded)
            VALUES (:id, :tid, :cat_id, :amount, :is_excluded)
        ');
        
        foreach ($body['splits'] as $split) {
            $insertStmt->execute([
                'id' => 'split_' . uniqid(),
                'tid' => $transactionId,
                'cat_id' => !empty($split['category_id']) ? $split['category_id'] : null,
                'amount' => $split['amount'],
                'is_excluded' => !empty($split['is_excluded']) ? 1 : 0,
            ]);
        }
        
        $pdo->commit();
        
        // Fetch saved splits
        $stmt = $pdo->prepare('
            SELECT ts.*, cat.name as category_name, cat.color as category_color
            FROM transaction_splits ts
            LEFT JOIN categories cat ON ts.category_id = cat.id
            WHERE ts.transaction_id = :tid
        ');
        $stmt->execute(['tid' => $transactionId]);
        Response::success($stmt->fetchAll());
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $body = getJsonBody();
        validateRequired($body, ['transaction_id']);
        
        $pdo->prepare('DELETE FROM transaction_splits WHERE transaction_id = :tid')
            ->execute(['tid' => $body['transaction_id']]);
        
        Response::success(null, 'Splits removed');
    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
