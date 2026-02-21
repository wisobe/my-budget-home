<?php
/**
 * Transaction Export Endpoint
 * GET /api/transactions/export.php?format=csv|json&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $format = $_GET['format'] ?? 'csv';
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $environment = $_GET['plaid_environment'] ?? 'production';
    
    if (!in_array($format, ['csv', 'json'])) {
        Response::error('Invalid format. Use csv or json.');
    }
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'production';
    }
    
    $pdo = Database::getConnection();
    
    $where = ['a.user_id = :user_id'];
    $params = ['user_id' => $userId];
    
    $where[] = '(c.plaid_environment = :environment OR a.plaid_connection_id IS NULL)';
    $params['environment'] = $environment;
    
    if ($startDate) {
        $where[] = 't.date >= :start_date';
        $params['start_date'] = $startDate;
    }
    if ($endDate) {
        $where[] = 't.date <= :end_date';
        $params['end_date'] = $endDate;
    }
    
    $whereClause = implode(' AND ', $where);
    
    if ($format === 'json') {
        // Export all data: transactions, accounts, categories
        $txStmt = $pdo->prepare("
            SELECT t.*, cat.name as category_name, a.name as account_name
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            LEFT JOIN categories cat ON t.category_id = cat.id
            WHERE {$whereClause}
            ORDER BY t.date DESC
        ");
        $txStmt->execute($params);
        $transactions = $txStmt->fetchAll();
        
        $accStmt = $pdo->prepare('SELECT * FROM accounts WHERE user_id = :user_id');
        $accStmt->execute(['user_id' => $userId]);
        $accounts = $accStmt->fetchAll();
        
        $catStmt = $pdo->query('SELECT * FROM categories ORDER BY name');
        $categories = $catStmt->fetchAll();
        
        Response::success([
            'exported_at' => date('c'),
            'date_range' => ['start' => $startDate, 'end' => $endDate],
            'transactions' => $transactions,
            'accounts' => $accounts,
            'categories' => $categories,
        ]);
    } else {
        // CSV export
        $stmt = $pdo->prepare("
            SELECT t.date, t.name, t.merchant_name, t.amount, t.excluded, t.pending, t.notes,
                   cat.name as category_name, a.name as account_name
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            LEFT JOIN categories cat ON t.category_id = cat.id
            WHERE {$whereClause}
            ORDER BY t.date DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="transactions_export.csv"');
        
        $output = fopen('php://output', 'w');
        fputcsv($output, ['Date', 'Description', 'Merchant', 'Amount', 'Category', 'Account', 'Excluded', 'Pending', 'Notes'], ',', '"', '\\');
        foreach ($rows as $row) {
            fputcsv($output, [
                $row['date'],
                $row['name'],
                $row['merchant_name'] ?? '',
                $row['amount'],
                $row['category_name'] ?? '',
                $row['account_name'] ?? '',
                $row['excluded'] ? 'Yes' : 'No',
                $row['pending'] ? 'Yes' : 'No',
                $row['notes'] ?? '',
            ], ',', '"', '\\');
        }
        fclose($output);
        exit;
    }
} catch (Exception $e) {
    Response::error('Export failed: ' . $e->getMessage(), 500);
}
