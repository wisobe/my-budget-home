<?php
/**
 * Monthly Overview Report
 * GET /api/reports/monthly-overview.php?year=2026&plaid_environment=sandbox
 * GET /api/reports/monthly-overview.php?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&plaid_environment=sandbox
 *
 * Returns income, expenses, net savings and savings rate per month for the current user.
 * Income = transactions categorised under an is_income category.
 * Expenses = all other non-excluded transactions.
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
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }

    $pdo = Database::getConnection();

    $envFilter  = '(c.plaid_environment = :environment OR a.plaid_connection_id IS NULL)';
    $userFilter = 'a.user_id = :user_id';
    $envFilter2  = '(c.plaid_environment = :environment2 OR a.plaid_connection_id IS NULL)';
    $userFilter2 = 'a.user_id = :user_id2';

    // Helper to build the UNION query for split-aware amounts
    // Now joins categories to determine is_income flag
    $buildQuery = function($dateFilter, $dateFilter2) use ($envFilter, $userFilter, $envFilter2, $userFilter2) {
        return "
            SELECT
                DATE_FORMAT(date, '%Y-%m') AS month,
                SUM(CASE WHEN is_income_cat = 1 THEN ABS(effective_amount) ELSE 0 END) AS total_income,
                SUM(CASE WHEN is_income_cat = 0 THEN ABS(effective_amount) ELSE 0 END) AS total_expenses
            FROM (
                -- Non-split transactions
                SELECT t.date, t.amount AS effective_amount,
                       COALESCE(cat.is_income, 0) AS is_income_cat
                FROM transactions t
                INNER JOIN accounts a ON t.account_id = a.id
                LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
                LEFT JOIN categories cat ON t.category_id = cat.id
                WHERE {$dateFilter}
                  AND t.excluded = 0 AND a.excluded = 0
                  AND {$envFilter} AND {$userFilter}
                  AND t.id NOT IN (SELECT DISTINCT transaction_id FROM transaction_splits)

                UNION ALL

                -- Split parts (non-excluded only)
                SELECT t.date, ts.amount AS effective_amount,
                       COALESCE(cat.is_income, 0) AS is_income_cat
                FROM transaction_splits ts
                INNER JOIN transactions t ON ts.transaction_id = t.id
                INNER JOIN accounts a ON t.account_id = a.id
                LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
                LEFT JOIN categories cat ON ts.category_id = cat.id
                WHERE {$dateFilter2}
                  AND t.excluded = 0 AND a.excluded = 0 AND ts.is_excluded = 0
                  AND {$envFilter2} AND {$userFilter2}
            ) AS combined
            GROUP BY DATE_FORMAT(date, '%Y-%m')
            ORDER BY month
        ";
    };

    if ($startDate && $endDate) {
        $dateFilter = 't.date >= :start_date AND t.date <= :end_date';
        $dateFilter2 = 't.date >= :start_date2 AND t.date <= :end_date2';
        $sql = $buildQuery($dateFilter, $dateFilter2);
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'start_date' => $startDate, 'end_date' => $endDate,
            'environment' => $environment, 'user_id' => $userId,
            'start_date2' => $startDate, 'end_date2' => $endDate,
            'environment2' => $environment, 'user_id2' => $userId,
        ]);
    } else {
        $year = (int) ($_GET['year'] ?? date('Y'));
        $dateFilter = 'YEAR(t.date) = :year';
        $dateFilter2 = 'YEAR(t.date) = :year2';
        $sql = $buildQuery($dateFilter, $dateFilter2);
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'year' => $year, 'environment' => $environment, 'user_id' => $userId,
            'year2' => $year, 'environment2' => $environment, 'user_id2' => $userId,
        ]);
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
