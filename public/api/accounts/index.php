<?php
/**
 * Accounts List Endpoint
 * GET /api/accounts/index.php
 * 
 * Lists all accounts, filtered by plaid_environment
 * Accepts ?plaid_environment=sandbox|production query param
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $environment = $_GET['plaid_environment'] ?? 'sandbox';
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }

    
    $pdo = Database::getConnection();
    
    $stmt = $pdo->prepare('
        SELECT a.* FROM accounts a
        INNER JOIN plaid_connections c ON a.plaid_connection_id = c.id
        WHERE c.plaid_environment = :environment
        ORDER BY a.institution_name, a.type, a.name
    ');
    $stmt->execute(['environment' => $environment]);
    
    $accounts = $stmt->fetchAll();
    
    Response::success($accounts);
} catch (Exception $e) {
    Response::error('Failed to fetch accounts: ' . $e->getMessage(), 500);
}
