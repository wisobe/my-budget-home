<?php
/**
 * Transactions List Endpoint
 * GET /api/transactions/index.php
 * 
 * Lists transactions for the authenticated user
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $accountId = $_GET['account_id'] ?? null;
    $categoryId = $_GET['category_id'] ?? null;
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $search = $_GET['search'] ?? null;
    $environment = $_GET['plaid_environment'] ?? 'sandbox';
    $showExcluded = ($_GET['show_excluded'] ?? '0') === '1';
    
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }
    
    $pdo = Database::getConnection();
    
    $where = ['1=1'];
    $params = [];
    
    // Filter by user
    $where[] = 'a.user_id = :user_id';
    $params['user_id'] = $userId;
    
    // Filter by environment
    $where[] = '(c.plaid_environment = :environment OR a.plaid_connection_id IS NULL)';
    $params['environment'] = $environment;
    
    if (!$showExcluded) {
        $where[] = 't.excluded = 0';
    }
    
    if ($accountId) {
        $where[] = 't.account_id = :account_id';
        $params['account_id'] = $accountId;
    }
    
    if ($categoryId === 'uncategorized') {
        $where[] = 't.category_id IS NULL';
    } elseif ($categoryId) {
        $where[] = 't.category_id = :category_id';
        $params['category_id'] = $categoryId;
    }
    
    // Default to 13 months ago if no start_date provided (keeps listing manageable)
    if (!$startDate) {
        $startDate = (new DateTime())->modify('-13 months')->format('Y-m-d');
    }
    $where[] = 't.date >= :start_date';
    $params['start_date'] = $startDate;
    
    if ($endDate) {
        $where[] = 't.date <= :end_date';
        $params['end_date'] = $endDate;
    }
    
    if ($search) {
        // Check if search looks like a number (amount search)
        $numericSearch = str_replace([',', '$', '€', ' '], '', $search);
        if (is_numeric($numericSearch)) {
            $where[] = '(t.name LIKE :search OR t.merchant_name LIKE :search2 OR ABS(t.amount) = :search_amount OR CAST(ABS(t.amount) AS CHAR) LIKE :search_amount_like)';
            $params['search'] = "%{$search}%";
            $params['search2'] = "%{$search}%";
            $params['search_amount'] = abs((float)$numericSearch);
            $params['search_amount_like'] = "%{$numericSearch}%";
        } else {
            $where[] = '(t.name LIKE :search OR t.merchant_name LIKE :search2)';
            $params['search'] = "%{$search}%";
            $params['search2'] = "%{$search}%";
        }
    }
    
    $whereClause = implode(' AND ', $where);
    
    // Get total count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
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
            a.name as account_name,
            (SELECT COUNT(*) FROM transaction_splits ts WHERE ts.transaction_id = t.id) as split_count,
            (SELECT SUM(ts2.amount) FROM transaction_splits ts2 WHERE ts2.transaction_id = t.id AND ts2.is_excluded = 0) as included_split_amount
        FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
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
    
    Response::paginated($stmt->fetchAll(), $total, $page, $perPage);
} catch (Exception $e) {
    Response::error('Failed to fetch transactions: ' . $e->getMessage(), 500);
}
