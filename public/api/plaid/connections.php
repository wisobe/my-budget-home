<?php
/**
 * Plaid Connections List Endpoint
 * GET /api/plaid/connections.php
 * 
 * Lists all Plaid bank connections for the authenticated user
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
        SELECT 
            c.id,
            c.institution_id,
            c.institution_name,
            c.status,
            c.plaid_environment,
            c.last_synced,
            c.error_message,
            c.created_at,
            COUNT(a.id) as accounts_count
        FROM plaid_connections c
        LEFT JOIN accounts a ON a.plaid_connection_id = c.id
        WHERE c.plaid_environment = :environment
          AND c.user_id = :user_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    ');
    $stmt->execute(['environment' => $environment, 'user_id' => $userId]);
    
    Response::success($stmt->fetchAll());
} catch (Exception $e) {
    Response::error('Failed to fetch connections: ' . $e->getMessage(), 500);
}
