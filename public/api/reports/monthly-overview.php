<?php
/**
 * Monthly Overview Report
 * GET /api/reports/monthly-overview.php?year=2026&plaid_environment=sandbox
 * GET /api/reports/monthly-overview.php?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&plaid_environment=sandbox
 *
 * Returns income, expenses, net savings and savings rate per month.
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
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }

    $pdo = Database::getConnection();

    $envFilter = '(c.plaid_environment = :environment OR a.plaid_connection_id IS NULL)';

    if ($startDate && $endDate) {
        $stmt = $pdo->prepare("
            SELECT
                DATE_FORMAT(t.date, '%Y-%m') AS month,
                SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) AS total_income,
                SUM(CASE WHEN t.amount > 0 THEN t.amount       ELSE 0 END) AS total_expenses
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            WHERE t.date >= :start_date
              AND t.date <= :end_date
              AND t.excluded = 0
              AND {$envFilter}
            GROUP BY DATE_FORMAT(t.date, '%Y-%m')
            ORDER BY month
        ");
        $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate, 'environment' => $environment]);
    } else {
        $year = (int) ($_GET['year'] ?? date('Y'));
        $stmt = $pdo->prepare("
            SELECT
                DATE_FORMAT(t.date, '%Y-%m') AS month,
                SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) AS total_income,
                SUM(CASE WHEN t.amount > 0 THEN t.amount       ELSE 0 END) AS total_expenses
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            WHERE YEAR(t.date) = :year
              AND t.excluded = 0
              AND {$envFilter}
            GROUP BY DATE_FORMAT(t.date, '%Y-%m')
            ORDER BY month
        ");
        $stmt->execute(['year' => $year, 'environment' => $environment]);
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $overview = [];
    foreach ($rows as $row) {
        $income   = (float) $row['total_income'];
        $expenses = (float) $row['total_expenses'];
        $net      = $income - $expenses;
        $rate     = $income > 0 ? round(($net / $income) * 100, 1) : 0;

        $overview[] = [
            'month'          => $row['month'],
            'total_income'   => $income,
            'total_expenses' => $expenses,
            'net_savings'    => $net,
            'savings_rate'   => $rate,
        ];
    }

    Response::success($overview);
} catch (Exception $e) {
    Response::error('Failed to fetch monthly overview: ' . $e->getMessage(), 500);
}
