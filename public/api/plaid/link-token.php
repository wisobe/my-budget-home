<?php
/**
 * Plaid Link Token Endpoint
 * POST /api/plaid/link-token.php
 * 
 * Creates a Link token for initializing Plaid Link
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $plaid = getPlaidClient();
    
    // Generate a unique user ID (in production, use actual user ID)
    $userId = 'user_' . uniqid();
    
    $result = $plaid->createLinkToken($userId);
    
    Response::success([
        'link_token' => $result['link_token'],
        'expiration' => $result['expiration'],
    ]);
} catch (Exception $e) {
    Response::error('Failed to create link token: ' . $e->getMessage(), 500);
}
