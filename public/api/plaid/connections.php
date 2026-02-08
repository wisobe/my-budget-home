<?php
/**
 * Plaid Connections List Endpoint
 * GET /api/plaid/connections.php
 * 
 * Lists all Plaid bank connections, filtered by environment
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

    if (useMockData()) {
        // Return mock data
        Response::success([
            [
                'id' => '1',
                'institution_id' => 'ins_desjardins',
                'institution_name' => 'Desjardins',
                'status' => 'active',
                'plaid_environment' => $environment,
                'last_synced' => date('c'),
                'accounts_count' => 3,
                'created_at' => date('c', strtotime('-30 days')),
            ]
        ]);
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
        GROUP BY c.id
        ORDER BY c.created_at DESC
    ');
    $stmt->execute(['environment' => $environment]);
    
    $connections = $stmt->fetchAll();
    
    Response::success($connections);
} catch (Exception $e) {
    Response::error('Failed to fetch connections: ' . $e->getMessage(), 500);
}
