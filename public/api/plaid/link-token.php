<?php
/**
 * Plaid Link Token Endpoint
 * POST /api/plaid/link-token.php
 * 
 * Creates a Link token for initializing Plaid Link
 * Accepts plaid_environment in POST body ('sandbox' or 'production')
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    $environment = $body['plaid_environment'] ?? 'sandbox';
    
    $plaid = getPlaidClient($environment);
    
    // Generate a unique user ID (in production, use actual user ID)
    $userId = 'user_' . uniqid();
    
    $result = $plaid->createLinkToken($userId);
    
    Response::success([
        'link_token' => $result['link_token'],
        'expiration' => $result['expiration'],
        'environment' => $environment,
    ]);
} catch (Exception $e) {
    Response::error('Failed to create link token: ' . $e->getMessage(), 500);
}
