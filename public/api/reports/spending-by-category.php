<?php
/**
 * Spending by Category Report
 * GET /api/reports/spending-by-category.php?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&plaid_environment=sandbox
 *
 * Returns spending totals grouped by category with trend vs previous period.
 * Filters by plaid_environment via account → plaid_connections join.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
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

    // Current period spending by category
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(t.category_id, 'uncategorized') AS category_id,
            COALESCE(cat.name, 'Uncategorized')       AS category_name,
            SUM(t.amount)                              AS total_amount,
            COUNT(*)                                   AS transaction_count
        FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        WHERE t.date >= :start_date
          AND t.date <= :end_date
          AND t.excluded = 0
          AND t.amount > 0
          AND {$envFilter}
        GROUP BY t.category_id, cat.name
        ORDER BY total_amount DESC
    ");
    $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate, 'environment' => $environment]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Grand total for percentage calculation
    $grandTotal = array_sum(array_column($rows, 'total_amount'));

    // Previous period of the same length for trend comparison
    $start = new DateTime($startDate);
    $end   = new DateTime($endDate);
    $days  = (int) $start->diff($end)->days + 1;
    $prevEnd   = (clone $start)->modify('-1 day')->format('Y-m-d');
    $prevStart = (clone $start)->modify("-{$days} days")->format('Y-m-d');

    $prevStmt = $pdo->prepare("
        SELECT
            COALESCE(t.category_id, 'uncategorized') AS category_id,
            SUM(t.amount) AS total_amount
        FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
        WHERE t.date >= :start_date
          AND t.date <= :end_date
          AND t.excluded = 0
          AND t.amount > 0
          AND {$envFilter}
        GROUP BY t.category_id
    ");
    $prevStmt->execute(['start_date' => $prevStart, 'end_date' => $prevEnd, 'environment' => $environment]);
    $prevMap = [];
    foreach ($prevStmt->fetchAll(PDO::FETCH_ASSOC) as $p) {
        $prevMap[$p['category_id']] = (float) $p['total_amount'];
    }

    // Build response
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
