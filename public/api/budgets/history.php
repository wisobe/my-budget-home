<?php
/**
 * Budget History Endpoint
 * GET /api/budgets/history.php?category_id=xxx&period=monthly&plaid_environment=sandbox
 * Returns spending for the given category over the last 12 months/periods
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        Response::error('Method not allowed', 405);
    }

    $categoryId = $_GET['category_id'] ?? null;
    $period = $_GET['period'] ?? 'monthly';
    $environment = $_GET['plaid_environment'] ?? 'sandbox';

    if (!$categoryId) {
        Response::error('category_id is required');
    }
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }

    // Always return 12 calendar months of data regardless of budget period
    $months = [];
    $now = new DateTime();

    for ($i = 11; $i >= 0; $i--) {
        $date = (clone $now)->modify("-{$i} months");
        $startDate = $date->format('Y-m') . '-01';
        $endDate = (new DateTime($startDate))->modify('last day of this month')->format('Y-m-d');
        $label = $date->format('Y-m');

        // Sum non-split transactions for this category (and children) in this month
        $stmt = $pdo->prepare('
            SELECT COALESCE(SUM(t.amount), 0) as spent
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            WHERE a.user_id = :uid
              AND t.excluded = 0
              AND a.excluded = 0
              AND t.pending = 0
              AND t.date BETWEEN :start_date AND :end_date
              AND (c.plaid_environment = :env OR a.plaid_connection_id IS NULL)
              AND (
                t.category_id = :cat_id
                OR t.category_id IN (SELECT id FROM categories WHERE parent_id = :cat_id2)
              )
              AND t.id NOT IN (SELECT transaction_id FROM transaction_splits)
        ');
        $stmt->execute([
            'uid' => $userId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'env' => $environment,
            'cat_id' => $categoryId,
            'cat_id2' => $categoryId,
        ]);
        $spent = (float)$stmt->fetchColumn();

        // Add split amounts for this category
        $splitStmt = $pdo->prepare('
            SELECT COALESCE(SUM(ts.amount), 0) as split_spent
            FROM transaction_splits ts
            JOIN transactions t ON ts.transaction_id = t.id
            JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            WHERE a.user_id = :uid
              AND ts.is_excluded = 0
              AND t.excluded = 0
              AND a.excluded = 0
              AND t.pending = 0
              AND t.date BETWEEN :start_date AND :end_date
              AND (c.plaid_environment = :env OR a.plaid_connection_id IS NULL)
              AND (
                ts.category_id = :cat_id
                OR ts.category_id IN (SELECT id FROM categories WHERE parent_id = :cat_id2)
              )
        ');
        $splitStmt->execute([
            'uid' => $userId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'env' => $environment,
            'cat_id' => $categoryId,
            'cat_id2' => $categoryId,
        ]);
        $spent += (float)$splitStmt->fetchColumn();

        $months[] = [
            'month' => $label,
            'spent' => round(abs($spent), 2),
        ];
    }

    Response::success($months);
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
