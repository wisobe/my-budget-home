<?php
/**
 * Plaid Connections List Endpoint
 * GET /api/plaid/connections.php
 * 
 * Lists all Plaid bank connections
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    if (useMockData()) {
        // Return mock data
        Response::success([
            [
                'id' => '1',
                'institution_id' => 'ins_desjardins',
                'institution_name' => 'Desjardins',
                'status' => 'active',
                'last_synced' => date('c'),
                'accounts_count' => 3,
                'created_at' => date('c', strtotime('-30 days')),
            ]
        ]);
    }
    
    $pdo = Database::getConnection();
    
    $stmt = $pdo->query('
        SELECT 
            c.id,
            c.institution_id,
            c.institution_name,
            c.status,
            c.last_synced,
            c.error_message,
            c.created_at,
            COUNT(a.id) as accounts_count
        FROM plaid_connections c
        LEFT JOIN accounts a ON a.plaid_connection_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    ');
    
    $connections = $stmt->fetchAll();
    
    Response::success($connections);
} catch (Exception $e) {
    Response::error('Failed to fetch connections: ' . $e->getMessage(), 500);
}
