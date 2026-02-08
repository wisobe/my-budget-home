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

    if (useMockData()) {
        // Return mock accounts
        $mockAccounts = [
            [
                'id' => '1',
                'name' => 'Chequing Account',
                'official_name' => 'Desjardins Chequing',
                'type' => 'checking',
                'subtype' => 'checking',
                'current_balance' => 2847.53,
                'available_balance' => 2847.53,
                'currency' => 'CAD',
                'institution_name' => 'Desjardins',
                'last_synced' => date('c'),
                'created_at' => date('c', strtotime('-30 days')),
            ],
            [
                'id' => '2',
                'name' => 'Savings Account',
                'official_name' => 'Desjardins Savings',
                'type' => 'savings',
                'subtype' => 'savings',
                'current_balance' => 15420.00,
                'available_balance' => 15420.00,
                'currency' => 'CAD',
                'institution_name' => 'Desjardins',
                'last_synced' => date('c'),
                'created_at' => date('c', strtotime('-30 days')),
            ],
            [
                'id' => '3',
                'name' => 'Credit Card',
                'official_name' => 'Desjardins Visa',
                'type' => 'credit',
                'subtype' => 'credit card',
                'current_balance' => -543.21,
                'available_balance' => 4456.79,
                'currency' => 'CAD',
                'institution_name' => 'Desjardins',
                'last_synced' => date('c'),
                'created_at' => date('c', strtotime('-30 days')),
            ],
        ];
        
        Response::success($mockAccounts);
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
