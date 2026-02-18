<?php
/**
 * Accounts List Endpoint
 * GET /api/accounts/index.php
 * 
 * Lists all accounts for the authenticated user, filtered by plaid_environment
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $environment = $_GET['plaid_environment'] ?? 'sandbox';
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }

    $pdo = Database::getConnection();
    
    $stmt = $pdo->prepare('
        SELECT a.* FROM accounts a
        INNER JOIN plaid_connections c ON a.plaid_connection_id = c.id
        WHERE c.plaid_environment = :environment
          AND a.user_id = :user_id
        ORDER BY a.institution_name, a.type, a.name
    ');
    $stmt->execute(['environment' => $environment, 'user_id' => $userId]);
    
    Response::success($stmt->fetchAll());
} catch (Exception $e) {
    Response::error('Failed to fetch accounts: ' . $e->getMessage(), 500);
}
