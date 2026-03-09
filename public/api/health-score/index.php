<?php
require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? 'sandbox';
if (!in_array($plaidEnv, ['sandbox', 'production'])) $plaidEnv = 'sandbox';

// Common join/filter pattern matching existing codebase
$envJoin = "LEFT JOIN plaid_connections pc ON a.plaid_connection_id = pc.id";
$envWhere = "(pc.plaid_environment = :plaid_env OR a.plaid_connection_id IS NULL)";

// ---- SAVINGS RATE (25 points) ----
$sql = "SELECT
          SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_income,
          SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_expenses
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        {$envJoin}
        WHERE a.user_id = :user_id AND t.excluded = 0
          AND t.date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
          AND {$envWhere}";
$stmt = $pdo->prepare($sql);
$stmt->execute([':user_id' => $userId, ':plaid_env' => $plaidEnv]);
$flow = $stmt->fetch(PDO::FETCH_ASSOC);

$income = (float)($flow['total_income'] ?? 0);
$expenses = (float)($flow['total_expenses'] ?? 0);
$savingsRate = $income > 0 ? max(0, ($income - $expenses) / $income) : 0;
$savingsScore = min(25, round($savingsRate / 0.20 * 25));

// ---- BUDGET ADHERENCE (20 points) ----
$sql2 = "SELECT COUNT(*) as total_budgets,
                SUM(CASE WHEN COALESCE(bv.spent, 0) <= b.amount THEN 1 ELSE 0 END) as within_budget
         FROM budgets b
         LEFT JOIN (
           SELECT t.category_id, SUM(t.amount) as spent
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           {$envJoin}
           WHERE a.user_id = :user_id2 AND t.excluded = 0 AND t.amount > 0
             AND t.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
             AND (pc.plaid_environment = :plaid_env2 OR a.plaid_connection_id IS NULL)
           GROUP BY t.category_id
         ) bv ON bv.category_id = b.category_id
         WHERE b.user_id = :user_id3 AND b.plaid_environment = :plaid_env3";
$stmt2 = $pdo->prepare($sql2);
$stmt2->execute([':user_id2' => $userId, ':plaid_env2' => $plaidEnv, ':user_id3' => $userId, ':plaid_env3' => $plaidEnv]);
$budgetData = $stmt2->fetch(PDO::FETCH_ASSOC);

$totalBudgets = (int)($budgetData['total_budgets'] ?? 0);
$withinBudget = (int)($budgetData['within_budget'] ?? 0);
$budgetScore = $totalBudgets > 0 ? round(($withinBudget / $totalBudgets) * 20) : 10;

// ---- EXPENSE STABILITY (15 points) ----
$sql3 = "SELECT DATE_FORMAT(t.date, '%Y-%m') as month, SUM(t.amount) as total
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         WHERE a.user_id = :user_id AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
           AND {$envWhere}
         GROUP BY DATE_FORMAT(t.date, '%Y-%m')
         ORDER BY month";
$stmt3 = $pdo->prepare($sql3);
$stmt3->execute([':user_id' => $userId, ':plaid_env' => $plaidEnv]);
$rows3 = $stmt3->fetchAll(PDO::FETCH_ASSOC);
$monthlyExpenses = array_map(fn($r) => (float)$r['total'], $rows3);

$stabilityScore = 15;
if (count($monthlyExpenses) >= 3) {
    $avg = array_sum($monthlyExpenses) / count($monthlyExpenses);
    if ($avg > 0) {
        $variance = 0;
        foreach ($monthlyExpenses as $m) {
            $variance += pow($m - $avg, 2);
        }
        $cv = sqrt($variance / count($monthlyExpenses)) / $avg;
        $stabilityScore = max(0, min(15, round((1 - ($cv - 0.15) / 0.35) * 15)));
    }
}

// ---- INCOME CONSISTENCY (15 points) ----
$sql4 = "SELECT DATE_FORMAT(t.date, '%Y-%m') as month, SUM(ABS(t.amount)) as total
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         WHERE a.user_id = :user_id AND t.excluded = 0 AND t.amount < 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
           AND {$envWhere}
         GROUP BY DATE_FORMAT(t.date, '%Y-%m')
         ORDER BY month";
$stmt4 = $pdo->prepare($sql4);
$stmt4->execute([':user_id' => $userId, ':plaid_env' => $plaidEnv]);
$rows4 = $stmt4->fetchAll(PDO::FETCH_ASSOC);
$monthlyIncome = array_map(fn($r) => (float)$r['total'], $rows4);

$incomeScore = 15;
if (count($monthlyIncome) >= 3) {
    $avg = array_sum($monthlyIncome) / count($monthlyIncome);
    if ($avg > 0) {
        $variance = 0;
        foreach ($monthlyIncome as $m) {
            $variance += pow($m - $avg, 2);
        }
        $cv = sqrt($variance / count($monthlyIncome)) / $avg;
        $incomeScore = max(0, min(15, round((1 - ($cv - 0.1) / 0.3) * 15)));
    }
} elseif (count($monthlyIncome) === 0) {
    $incomeScore = 0;
}

// ---- DEBT RATIO (15 points) ----
$sql5 = "SELECT
           SUM(CASE WHEN a.type IN ('credit', 'loan') THEN ABS(a.current_balance) ELSE 0 END) as total_debt,
           SUM(CASE WHEN a.type IN ('checking', 'savings', 'depository') THEN a.current_balance ELSE 0 END) as total_assets
         FROM accounts a
         {$envJoin}
         WHERE a.user_id = :user_id5 AND a.excluded = 0
           AND (pc.plaid_environment = :plaid_env5 OR a.plaid_connection_id IS NULL)";
$stmt5 = $pdo->prepare($sql5);
$stmt5->execute([':user_id5' => $userId, ':plaid_env5' => $plaidEnv]);
$balances = $stmt5->fetch(PDO::FETCH_ASSOC);

$totalDebt = (float)($balances['total_debt'] ?? 0);
$totalAssets = (float)($balances['total_assets'] ?? 0);
$debtRatio = ($totalAssets + $totalDebt) > 0 ? $totalDebt / ($totalAssets + $totalDebt) : 0;
$debtScore = max(0, min(15, round((1 - $debtRatio / 0.5) * 15)));

// ---- SPENDING DIVERSITY (10 points) ----
$sql6 = "SELECT COUNT(DISTINCT t.category_id) as cat_count
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         WHERE a.user_id = :user_id AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
           AND t.category_id IS NOT NULL
           AND {$envWhere}";
$stmt6 = $pdo->prepare($sql6);
$stmt6->execute([':user_id' => $userId, ':plaid_env' => $plaidEnv]);
$diversity = $stmt6->fetch(PDO::FETCH_ASSOC);

$catCount = (int)($diversity['cat_count'] ?? 0);
$diversityScore = min(10, round($catCount / 5 * 10));

$totalScore = $savingsScore + $budgetScore + $stabilityScore + $incomeScore + $debtScore + $diversityScore;

$tips = [];
if ($savingsRate < 0.10) $tips[] = ['type' => 'savings', 'text' => 'Try to save at least 10-20% of your income each month.'];
if ($totalBudgets === 0) $tips[] = ['type' => 'budget', 'text' => 'Set up budgets to track spending limits by category.'];
if ($debtRatio > 0.3) $tips[] = ['type' => 'debt', 'text' => 'Focus on reducing high-interest debt to improve your financial health.'];
if ($catCount < 3) $tips[] = ['type' => 'categorize', 'text' => 'Categorize your transactions for better spending insights.'];
if ($savingsRate >= 0.20) $tips[] = ['type' => 'positive', 'text' => 'Great job! Your savings rate is above 20%.'];
if ($totalBudgets > 0 && $withinBudget === $totalBudgets) $tips[] = ['type' => 'positive', 'text' => "You're within all your budgets this month!"];

$grade = 'F';
if ($totalScore >= 90) $grade = 'A+';
elseif ($totalScore >= 80) $grade = 'A';
elseif ($totalScore >= 70) $grade = 'B';
elseif ($totalScore >= 60) $grade = 'C';
elseif ($totalScore >= 50) $grade = 'D';

Response::success([
    'score' => $totalScore,
    'grade' => $grade,
    'breakdown' => [
        ['name' => 'Savings Rate', 'score' => $savingsScore, 'max' => 25, 'detail' => round($savingsRate * 100, 1) . '%'],
        ['name' => 'Budget Adherence', 'score' => $budgetScore, 'max' => 20, 'detail' => $totalBudgets > 0 ? "{$withinBudget}/{$totalBudgets} within budget" : 'No budgets set'],
        ['name' => 'Expense Stability', 'score' => $stabilityScore, 'max' => 15, 'detail' => count($monthlyExpenses) >= 3 ? 'Based on 6-month trend' : 'Not enough data'],
        ['name' => 'Income Consistency', 'score' => $incomeScore, 'max' => 15, 'detail' => count($monthlyIncome) >= 3 ? 'Based on 6-month trend' : 'Not enough data'],
        ['name' => 'Debt Ratio', 'score' => $debtScore, 'max' => 15, 'detail' => round($debtRatio * 100, 1) . '% debt-to-total'],
        ['name' => 'Spending Diversity', 'score' => $diversityScore, 'max' => 10, 'detail' => "{$catCount} categories used"],
    ],
    'tips' => $tips,
    'summary' => [
        'monthly_income' => round($income / 3, 2),
        'monthly_expenses' => round($expenses / 3, 2),
        'savings_rate' => round($savingsRate * 100, 1),
        'total_debt' => round($totalDebt, 2),
        'total_assets' => round($totalAssets, 2),
    ],
]);
