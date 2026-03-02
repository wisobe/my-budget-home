<?php
/**
 * Spending by Category Report
 * GET /api/reports/spending-by-category.php?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&plaid_environment=sandbox
 *
 * Returns spending totals grouped by category for the current user.
 * Only includes expense categories (is_income = 0).
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $startDate   = $_GET['start_date'] ?? null;
    $endDate     = $_GET['end_date']   ?? null;
    $environment = $_GET['plaid_environment'] ?? 'sandbox';

    if (!$startDate || !$endDate) {
        Response::error('start_date and end_date are required');
    }
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }

    $pdo = Database::getConnection();

    $envFilter = '(c.plaid_environment = :environment OR a.plaid_connection_id IS NULL)';
    $userFilter = 'a.user_id = :user_id';

    // Current period – exclude income categories
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(category_id, 'uncategorized') AS category_id,
            COALESCE(category_name, 'Uncategorized') AS category_name,
            SUM(effective_amount) AS total_amount,
            COUNT(*) AS transaction_count
        FROM (
            -- Non-split transactions
            SELECT t.category_id, cat.name AS category_name, ABS(t.amount) AS effective_amount
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            LEFT JOIN categories cat ON t.category_id = cat.id
            WHERE t.date >= :start_date AND t.date <= :end_date
              AND t.excluded = 0 AND a.excluded = 0
              AND COALESCE(cat.is_income, 0) = 0
              AND {$envFilter} AND {$userFilter}
              AND t.id NOT IN (SELECT DISTINCT transaction_id FROM transaction_splits)

            UNION ALL

            -- Split parts (non-excluded only)
            SELECT ts.category_id, cat.name AS category_name, ABS(ts.amount) AS effective_amount
            FROM transaction_splits ts
            INNER JOIN transactions t ON ts.transaction_id = t.id
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            LEFT JOIN categories cat ON ts.category_id = cat.id
            WHERE t.date >= :start_date2 AND t.date <= :end_date2
              AND t.excluded = 0 AND a.excluded = 0 AND ts.is_excluded = 0
              AND COALESCE(cat.is_income, 0) = 0
              AND (c.plaid_environment = :environment2 OR a.plaid_connection_id IS NULL)
              AND a.user_id = :user_id2
        ) AS combined
        GROUP BY category_id, category_name
        ORDER BY total_amount DESC
    ");
    $stmt->execute([
        'start_date' => $startDate, 'end_date' => $endDate,
        'environment' => $environment, 'user_id' => $userId,
        'start_date2' => $startDate, 'end_date2' => $endDate,
        'environment2' => $environment, 'user_id2' => $userId,
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $grandTotal = array_sum(array_column($rows, 'total_amount'));

    // Previous period
    $start = new DateTime($startDate);
    $end   = new DateTime($endDate);
    $days  = (int) $start->diff($end)->days + 1;
    $prevEnd   = (clone $start)->modify('-1 day')->format('Y-m-d');
    $prevStart = (clone $start)->modify("-{$days} days")->format('Y-m-d');

    $prevStmt = $pdo->prepare("
        SELECT
            COALESCE(category_id, 'uncategorized') AS category_id,
            SUM(effective_amount) AS total_amount
        FROM (
            SELECT t.category_id, ABS(t.amount) AS effective_amount
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            LEFT JOIN categories cat ON t.category_id = cat.id
            WHERE t.date >= :start_date AND t.date <= :end_date
              AND t.excluded = 0 AND a.excluded = 0
              AND COALESCE(cat.is_income, 0) = 0
              AND {$envFilter} AND {$userFilter}
              AND t.id NOT IN (SELECT DISTINCT transaction_id FROM transaction_splits)

            UNION ALL

            SELECT ts.category_id, ABS(ts.amount) AS effective_amount
            FROM transaction_splits ts
            INNER JOIN transactions t ON ts.transaction_id = t.id
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            LEFT JOIN categories cat ON ts.category_id = cat.id
            WHERE t.date >= :start_date2 AND t.date <= :end_date2
              AND t.excluded = 0 AND a.excluded = 0 AND ts.is_excluded = 0
              AND COALESCE(cat.is_income, 0) = 0
              AND (c.plaid_environment = :environment2 OR a.plaid_connection_id IS NULL)
              AND a.user_id = :user_id2
        ) AS combined
        GROUP BY category_id
    ");
    $prevStmt->execute([
        'start_date' => $prevStart, 'end_date' => $prevEnd,
        'environment' => $environment, 'user_id' => $userId,
        'start_date2' => $prevStart, 'end_date2' => $prevEnd,
        'environment2' => $environment, 'user_id2' => $userId,
    ]);
    $prevMap = [];
    foreach ($prevStmt->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $prevMap[$p['category_id']] = (float) $p['total_amount'];
    }

    $insights = [];
    foreach ($rows as $row) {
        $catId  = $row['category_id'];
        $amount = (float) $row['total_amount'];
        $prev   = $prevMap[$catId] ?? 0;
        $pct    = $grandTotal > 0 ? round(($amount / $grandTotal) * 100, 1) : 0;

        if ($prev > 0) {
            $change = round((($amount - $prev) / $prev) * 100, 1);
            $trend  = $change > 5 ? 'up' : ($change < -5 ? 'down' : 'stable');
        } else {
            $change = 0;
            $trend  = 'stable';
        }

        $insights[] = [
            'category_id'         => $catId,
            'category_name'       => $row['category_name'],
            'total_amount'        => $amount,
            'transaction_count'   => (int) $row['transaction_count'],
            'percentage_of_total' => $pct,
            'trend'               => $trend,
            'trend_percentage'    => abs($change),
        ];
    }

    Response::success($insights);
} catch (Exception $e) {
    Response::error('Failed to fetch spending by category: ' . $e->getMessage(), 500);
}
