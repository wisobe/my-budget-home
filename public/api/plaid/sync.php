<?php
/**
 * Plaid Transaction Sync Endpoint
 * POST /api/plaid/sync.php
 * 
 * Syncs transactions for a specific Plaid connection (owned by authenticated user)
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/AutoCategorizer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['connection_id']);
    
    $pdo = Database::getConnection();
    $plaid = getPlaidClient();
    
    // Get connection - verify ownership
    $stmt = $pdo->prepare('
        SELECT id, access_token_encrypted, sync_cursor 
        FROM plaid_connections 
        WHERE id = :id AND user_id = :user_id
    ');
    $stmt->execute(['id' => $body['connection_id'], 'user_id' => $userId]);
    $connection = $stmt->fetch();
    
    if (!$connection) {
        Response::notFound('Connection not found');
    }
    
    $accessToken = $connection['access_token_encrypted'];
    $cursor = $connection['sync_cursor'];
    
    $added = 0;
    $modified = 0;
    $removed = 0;
    $hasMore = true;
    
    while ($hasMore) {
        $syncResult = $plaid->syncTransactions($accessToken, $cursor);
        
        foreach ($syncResult['added'] as $tx) {
            $accountStmt = $pdo->prepare('
                SELECT id FROM accounts WHERE plaid_account_id = :plaid_account_id AND user_id = :user_id
            ');
            $accountStmt->execute(['plaid_account_id' => $tx['account_id'], 'user_id' => $userId]);
            $account = $accountStmt->fetch();
            
            if ($account) {
                $autoCategoryId = AutoCategorizer::match($pdo, $tx['name'], $tx['merchant_name'] ?? null, $userId);
                
                $insertStmt = $pdo->prepare('
                    INSERT INTO transactions (
                        id, plaid_transaction_id, account_id, date, name,
                        merchant_name, amount, category_id, pending, created_at, updated_at
                    ) VALUES (
                        :id, :plaid_tx_id, :account_id, :date, :name,
                        :merchant_name, :amount, :category_id, :pending, NOW(), NOW()
                    )
                    ON DUPLICATE KEY UPDATE
                        amount = :amount2,
                        pending = :pending2,
                        updated_at = NOW()
                ');
                
                $insertStmt->execute([
                    'id' => 'tx_' . uniqid(),
                    'plaid_tx_id' => $tx['transaction_id'],
                    'account_id' => $account['id'],
                    'date' => $tx['date'],
                    'name' => $tx['name'],
                    'merchant_name' => $tx['merchant_name'] ?? null,
                    'amount' => $tx['amount'],
                    'category_id' => $autoCategoryId,
                    'pending' => $tx['pending'] ? 1 : 0,
                    'amount2' => $tx['amount'],
                    'pending2' => $tx['pending'] ? 1 : 0,
                ]);
                $added++;
            }
        }
        
        foreach ($syncResult['modified'] as $tx) {
            $updateStmt = $pdo->prepare('
                UPDATE transactions SET
                    amount = :amount,
                    pending = :pending,
                    name = :name,
                    updated_at = NOW()
                WHERE plaid_transaction_id = :plaid_tx_id
            ');
            $updateStmt->execute([
                'amount' => $tx['amount'],
                'pending' => $tx['pending'] ? 1 : 0,
                'name' => $tx['name'],
                'plaid_tx_id' => $tx['transaction_id'],
            ]);
            $modified++;
        }
        
        foreach ($syncResult['removed'] as $tx) {
            $deleteStmt = $pdo->prepare('
                DELETE FROM transactions WHERE plaid_transaction_id = :plaid_tx_id
            ');
            $deleteStmt->execute(['plaid_tx_id' => $tx['transaction_id']]);
            $removed++;
        }
        
        $cursor = $syncResult['next_cursor'];
        $hasMore = $syncResult['has_more'];
    }
    
    // Update connection
    $updateConnStmt = $pdo->prepare('
        UPDATE plaid_connections SET
            sync_cursor = :cursor,
            last_synced = NOW(),
            status = :status
        WHERE id = :id AND user_id = :user_id
    ');
    $updateConnStmt->execute([
        'cursor' => $cursor,
        'status' => 'active',
        'id' => $body['connection_id'],
        'user_id' => $userId,
    ]);
    
    // Update account balances
    $accountsResult = $plaid->getAccounts($accessToken);
    foreach ($accountsResult['accounts'] as $account) {
        $updateAccStmt = $pdo->prepare('
            UPDATE accounts SET
                current_balance = :current_balance,
                available_balance = :available_balance,
                last_synced = NOW()
            WHERE plaid_account_id = :plaid_account_id AND user_id = :user_id
        ');
        $updateAccStmt->execute([
            'current_balance' => $account['balances']['current'] ?? 0,
            'available_balance' => $account['balances']['available'] ?? null,
            'plaid_account_id' => $account['account_id'],
            'user_id' => $userId,
        ]);
    }
    
    Response::success([
        'added' => $added,
        'modified' => $modified,
        'removed' => $removed,
        'accounts_updated' => count($accountsResult['accounts']),
    ]);
} catch (Exception $e) {
    if (isset($body['connection_id'])) {
        try {
            $pdo = Database::getConnection();
            $errorStmt = $pdo->prepare('
                UPDATE plaid_connections SET status = :status, error_message = :error WHERE id = :id
            ');
            $errorStmt->execute([
                'status' => 'error',
                'error' => $e->getMessage(),
                'id' => $body['connection_id'],
            ]);
        } catch (Exception $innerEx) {}
    }
    
    Response::error('Failed to sync transactions: ' . $e->getMessage(), 500);
}
