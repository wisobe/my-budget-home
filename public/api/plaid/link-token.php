<?php
/**
 * Plaid Link Token Endpoint
 * POST /api/plaid/link-token.php
 * 
 * Creates a Link token for initializing Plaid Link
 * Accepts plaid_environment in POST body ('sandbox' or 'production')
 * Optionally accepts connection_id for update/re-link mode
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    $environment = $body['plaid_environment'] ?? 'sandbox';
    $connectionId = $body['connection_id'] ?? null;
    
    $plaid = getPlaidClient($environment);
    
    $accessToken = null;
    
    // If connection_id provided, get access token for update mode
    if ($connectionId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT access_token_encrypted FROM plaid_connections WHERE id = :id AND user_id = :user_id');
        $stmt->execute(['id' => $connectionId, 'user_id' => $userId]);
        $connection = $stmt->fetch();
        
        if (!$connection) {
            Response::notFound('Connection not found');
        }
        
        $accessToken = $connection['access_token_encrypted'];
    }
    
    $result = $plaid->createLinkToken('user_' . $userId, $accessToken);
    
    Response::success([
        'link_token' => $result['link_token'],
        'expiration' => $result['expiration'],
        'environment' => $environment,
    ]);
} catch (PlaidApiException $e) {
    Response::error('Failed to create link token: ' . $e->getMessage(), 500, $e->toArray());
} catch (Exception $e) {
    Response::error('Failed to create link token: ' . $e->getMessage(), 500);
}
