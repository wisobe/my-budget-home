<?php
/**
 * Transactions List Endpoint
 * GET /api/transactions/index.php
 * 
 * Lists transactions with optional filters and pagination
 * Accepts ?plaid_environment=sandbox|production query param
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    // Parse query parameters
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $accountId = $_GET['account_id'] ?? null;
    $categoryId = $_GET['category_id'] ?? null;
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $search = $_GET['search'] ?? null;
    $environment = $_GET['plaid_environment'] ?? 'sandbox';
    
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }
    
    if (useMockData()) {
        // Return mock transactions
        $mockTransactions = [
            [
                'id' => '1',
                'account_id' => '1',
                'date' => date('Y-m-d'),
                'name' => 'Grocery Store',
                'merchant_name' => 'Metro',
                'amount' => 85.43,
                'category_id' => '2',
                'pending' => false,
                'created_at' => date('c'),
                'updated_at' => date('c'),
            ],
            [
                'id' => '2',
                'account_id' => '1',
                'date' => date('Y-m-d', strtotime('-1 day')),
                'name' => 'Gas Station',
                'merchant_name' => 'Shell',
                'amount' => 65.00,
                'category_id' => '3',
                'pending' => false,
                'created_at' => date('c'),
                'updated_at' => date('c'),
            ],
            [
                'id' => '3',
                'account_id' => '1',
                'date' => date('Y-m-d', strtotime('-2 days')),
                'name' => 'Salary Deposit',
                'merchant_name' => null,
                'amount' => -2500.00,
                'category_id' => '1',
                'pending' => false,
                'created_at' => date('c'),
                'updated_at' => date('c'),
            ],
        ];
        
        Response::paginated($mockTransactions, count($mockTransactions), $page, $perPage);
    }
    
    $pdo = Database::getConnection();
    
    // Build query — filter by plaid_environment through account → connection join
    $where = ['1=1'];
    $params = [];
    
    // Always filter by environment
    $where[] = 'c.plaid_environment = :environment';
    $params['environment'] = $environment;
    
    if ($accountId) {
        $where[] = 't.account_id = :account_id';
        $params['account_id'] = $accountId;
    }
    
    if ($categoryId) {
        $where[] = 't.category_id = :category_id';
        $params['category_id'] = $categoryId;
    }
    
    if ($startDate) {
        $where[] = 't.date >= :start_date';
        $params['start_date'] = $startDate;
    }
    
    if ($endDate) {
        $where[] = 't.date <= :end_date';
        $params['end_date'] = $endDate;
    }
    
    if ($search) {
        $where[] = '(t.name LIKE :search OR t.merchant_name LIKE :search2)';
        $params['search'] = "%{$search}%";
        $params['search2'] = "%{$search}%";
    }
    
    $whereClause = implode(' AND ', $where);
    
    // Get total count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        INNER JOIN plaid_connections c ON a.plaid_connection_id = c.id
        WHERE {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();
    
    // Get paginated results
    $offset = ($page - 1) * $perPage;
    $stmt = $pdo->prepare("
        SELECT 
            t.*,
            cat.name as category_name,
            cat.color as category_color,
            a.name as account_name
        FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        INNER JOIN plaid_connections c ON a.plaid_connection_id = c.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        WHERE {$whereClause}
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue('limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $transactions = $stmt->fetchAll();
    
    Response::paginated($transactions, $total, $page, $perPage);
} catch (Exception $e) {
    Response::error('Failed to fetch transactions: ' . $e->getMessage(), 500);
}
