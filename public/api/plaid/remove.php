<?php
/**
 * Remove Plaid Connection Endpoint
 * POST/DELETE /api/plaid/remove.php
 * 
 * Removes a Plaid connection owned by the authenticated user
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['connection_id']);
    
    $pdo = Database::getConnection();
    
    // Get connection - verify ownership
    $stmt = $pdo->prepare('SELECT access_token_encrypted FROM plaid_connections WHERE id = :id AND user_id = :user_id');
    $stmt->execute(['id' => $body['connection_id'], 'user_id' => $userId]);
    $connection = $stmt->fetch();
    
    if (!$connection) {
        Response::notFound('Connection not found');
    }
    
    // Remove item from Plaid
    try {
        $plaid = getPlaidClient();
        $plaid->removeItem($connection['access_token_encrypted']);
    } catch (Exception $e) {
        error_log('Failed to remove Plaid item: ' . $e->getMessage());
    }
    
    // Delete associated transactions
    $pdo->prepare('
        DELETE t FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        WHERE a.plaid_connection_id = :connection_id
    ')->execute(['connection_id' => $body['connection_id']]);
    
    // Delete associated accounts
    $pdo->prepare('
        DELETE FROM accounts WHERE plaid_connection_id = :connection_id
    ')->execute(['connection_id' => $body['connection_id']]);
    
    // Delete the connection
    $pdo->prepare('
        DELETE FROM plaid_connections WHERE id = :id AND user_id = :user_id
    ')->execute(['id' => $body['connection_id'], 'user_id' => $userId]);
    
    Response::success(null, 'Connection removed successfully');
} catch (Exception $e) {
    Response::error('Failed to remove connection: ' . $e->getMessage(), 500);
}
