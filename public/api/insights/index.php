<?php
require_once __DIR__ . '/../includes/bootstrap.php';

use App\Database;
use App\Response;

$db = Database::getInstance();
$pdo = $db->getConnection();
$userId = $db->requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$plaidEnv = $_GET['plaid_environment'] ?? null;
$insights = [];

$envFilter = '';
$params = [':user_id' => $userId];
if ($plaidEnv) {
    $envFilter = ' AND a.plaid_environment = :plaid_env';
    $params[':plaid_env'] = $plaidEnv;
}

// 1. UNUSUAL MERCHANTS - places visited only 1-2 times in last 90 days that weren't visited before
$sql = "SELECT t.merchant_name, t.name, t.amount, t.date, COUNT(*) as visit_count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE a.user_id = :user_id AND t.excluded = 0 AND t.amount > 0
          AND t.date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          {$envFilter}
          AND (t.merchant_name IS NOT NULL AND t.merchant_name != '')
        GROUP BY COALESCE(t.merchant_name, t.name)
        HAVING visit_count <= 2";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$unusual = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Check if these merchants existed before 90 days ago
foreach ($unusual as $u) {
    $merchantKey = $u['merchant_name'] ?: $u['name'];
    $checkSql = "SELECT COUNT(*) as cnt FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 WHERE a.user_id = :user_id2 AND t.excluded = 0
                   AND t.date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                   AND (t.merchant_name = :merchant OR t.name = :merchant2)";
    $checkParams = [':user_id2' => $userId, ':merchant' => $merchantKey, ':merchant2' => $merchantKey];
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute($checkParams);
    $prior = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ((int)($prior['cnt'] ?? 0) === 0 && (float)$u['amount'] > 50) {
        $insights[] = [
            'type' => 'unusual_merchant',
            'severity' => 'warning',
            'title' => 'Unusual merchant detected',
            'description' => "Transaction at \"{$merchantKey}\" for \${$u['amount']} on {$u['date']}. You haven't transacted here before.",
            'data' => ['merchant' => $merchantKey, 'amount' => (float)$u['amount'], 'date' => $u['date']],
        ];
    }
}

// 2. SALARY CHANGES - detect income transactions and compare amounts
$sql2 = "SELECT t.name, t.merchant_name, t.amount, t.date
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE a.user_id = :user_id3 AND t.excluded = 0 AND t.amount < 0
           AND (c.is_income = 1 OR t.amount < -500)
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)";
$params2 = [':user_id3' => $userId];
if ($plaidEnv) {
    $sql2 .= " AND a.plaid_environment = :plaid_env2";
    $params2[':plaid_env2'] = $plaidEnv;
}
$sql2 .= " ORDER BY t.date DESC";
$stmt2 = $pdo->prepare($sql2);
$stmt2->execute($params2);
$incomes = $stmt2->fetchAll(PDO::FETCH_ASSOC);

// Group income by source
$incomeSources = [];
foreach ($incomes as $inc) {
    $key = strtolower(trim($inc['merchant_name'] ?: $inc['name']));
    $incomeSources[$key][] = $inc;
}

foreach ($incomeSources as $source => $txns) {
    if (count($txns) < 2) continue;
    $latest = abs((float)$txns[0]['amount']);
    $previous = abs((float)$txns[1]['amount']);
    if ($previous > 0) {
        $changePct = (($latest - $previous) / $previous) * 100;
        if (abs($changePct) > 5) {
            $direction = $changePct > 0 ? 'increased' : 'decreased';
            $insights[] = [
                'type' => 'salary_change',
                'severity' => $changePct > 0 ? 'positive' : 'warning',
                'title' => "Income {$direction}",
                'description' => "Your income from \"{$txns[0]['merchant_name']}\" {$direction} by " . abs(round($changePct, 1)) . "% (from $" . number_format($previous, 2) . " to $" . number_format($latest, 2) . ").",
                'data' => ['source' => $txns[0]['merchant_name'] ?: $txns[0]['name'], 'previous' => $previous, 'current' => $latest, 'change_percent' => round($changePct, 1)],
            ];
        }
    }
}

// 3. SPENDING SPIKES - categories where recent spending is much higher than average
$sql3 = "SELECT c.name as category_name, c.color as category_color,
                SUM(CASE WHEN t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as recent_total,
                SUM(CASE WHEN t.date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND t.date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY) THEN t.amount ELSE 0 END) / 3 as avg_monthly
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         JOIN categories c ON t.category_id = c.id
         WHERE a.user_id = :user_id4 AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
           AND c.is_income = 0";
$params3 = [':user_id4' => $userId];
if ($plaidEnv) {
    $sql3 .= " AND a.plaid_environment = :plaid_env3";
    $params3[':plaid_env3'] = $plaidEnv;
}
$sql3 .= " GROUP BY c.id HAVING avg_monthly > 20 AND recent_total > avg_monthly * 1.5";
$stmt3 = $pdo->prepare($sql3);
$stmt3->execute($params3);
$spikes = $stmt3->fetchAll(PDO::FETCH_ASSOC);

foreach ($spikes as $spike) {
    $pctOver = round(((float)$spike['recent_total'] / (float)$spike['avg_monthly'] - 1) * 100);
    $insights[] = [
        'type' => 'spending_spike',
        'severity' => $pctOver > 100 ? 'critical' : 'warning',
        'title' => "Spending spike in {$spike['category_name']}",
        'description' => "You spent \$" . number_format($spike['recent_total'], 2) . " this month on {$spike['category_name']}, which is {$pctOver}% more than your 3-month average of \$" . number_format($spike['avg_monthly'], 2) . ".",
        'data' => ['category' => $spike['category_name'], 'recent' => (float)$spike['recent_total'], 'average' => (float)$spike['avg_monthly'], 'spike_percent' => $pctOver],
    ];
}

// 4. DUPLICATE CHARGES - same merchant + same amount on same day
$sql4 = "SELECT t.name, t.merchant_name, t.amount, t.date, COUNT(*) as dup_count
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = :user_id5 AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           {$envFilter}
         GROUP BY COALESCE(t.merchant_name, t.name), t.amount, t.date
         HAVING dup_count > 1";
$params4 = array_merge([':user_id5' => $userId], $plaidEnv ? [':plaid_env' => $plaidEnv] : []);
// Re-build params for this query
$params4clean = [':user_id' => $userId];
if ($plaidEnv) $params4clean[':plaid_env'] = $plaidEnv;

// Rebuild query to use correct param names
$sql4 = "SELECT t.name, t.merchant_name, t.amount, t.date, COUNT(*) as dup_count
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = :user_id AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           {$envFilter}
         GROUP BY COALESCE(t.merchant_name, t.name), t.amount, t.date
         HAVING dup_count > 1";
$stmt4 = $pdo->prepare($sql4);
$stmt4->execute($params4clean);
$duplicates = $stmt4->fetchAll(PDO::FETCH_ASSOC);

foreach ($duplicates as $dup) {
    $merchant = $dup['merchant_name'] ?: $dup['name'];
    $insights[] = [
        'type' => 'duplicate_charge',
        'severity' => 'warning',
        'title' => 'Possible duplicate charge',
        'description' => "{$dup['dup_count']} charges of \${$dup['amount']} at \"{$merchant}\" on {$dup['date']}.",
        'data' => ['merchant' => $merchant, 'amount' => (float)$dup['amount'], 'date' => $dup['date'], 'count' => (int)$dup['dup_count']],
    ];
}

// 5. LARGEST SINGLE TRANSACTIONS this month
$sql5 = "SELECT t.name, t.merchant_name, t.amount, t.date
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = :user_id AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           {$envFilter}
         ORDER BY t.amount DESC LIMIT 3";
$stmt5 = $pdo->prepare($sql5);
$stmt5->execute($params4clean);
$largest = $stmt5->fetchAll(PDO::FETCH_ASSOC);

foreach ($largest as $lg) {
    if ((float)$lg['amount'] > 200) {
        $merchant = $lg['merchant_name'] ?: $lg['name'];
        $insights[] = [
            'type' => 'large_transaction',
            'severity' => 'info',
            'title' => 'Large transaction',
            'description' => "\${$lg['amount']} at \"{$merchant}\" on {$lg['date']}.",
            'data' => ['merchant' => $merchant, 'amount' => (float)$lg['amount'], 'date' => $lg['date']],
        ];
    }
}

// Sort by severity
$severityOrder = ['critical' => 0, 'warning' => 1, 'positive' => 2, 'info' => 3];
usort($insights, fn($a, $b) => ($severityOrder[$a['severity']] ?? 4) - ($severityOrder[$b['severity']] ?? 4));

Response::success($insights);
