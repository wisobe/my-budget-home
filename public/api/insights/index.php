<?php
require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? 'sandbox';
if (!in_array($plaidEnv, ['sandbox', 'production'])) $plaidEnv = 'sandbox';

$insights = [];

// Common environment filter pattern (matches existing codebase)
$envJoin = "LEFT JOIN plaid_connections pc ON a.plaid_connection_id = pc.id";
$envWhere = "(pc.plaid_environment = :plaid_env OR a.plaid_connection_id IS NULL)";

// 1. UNUSUAL MERCHANTS - places visited only 1-2 times in last 90 days not seen before
$sql = "SELECT t.merchant_name, t.name, t.amount, t.date, COUNT(*) as visit_count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        {$envJoin}
        WHERE a.user_id = :user_id AND t.excluded = 0 AND t.pending = 0 AND t.amount > 0
          AND t.date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          AND {$envWhere}
          AND (t.merchant_name IS NOT NULL AND t.merchant_name != '')
        GROUP BY COALESCE(t.merchant_name, t.name)
        HAVING visit_count <= 2";
$stmt = $pdo->prepare($sql);
$stmt->execute([':user_id' => $userId, ':plaid_env' => $plaidEnv]);
$unusual = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($unusual as $u) {
    $merchantKey = $u['merchant_name'] ?: $u['name'];
    $checkSql = "SELECT COUNT(*) as cnt FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 {$envJoin}
                 WHERE a.user_id = :uid AND t.excluded = 0 AND t.pending = 0
                   AND t.date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                   AND {$envWhere}
                   AND (t.merchant_name = :m1 OR t.name = :m2)";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([':uid' => $userId, ':plaid_env' => $plaidEnv, ':m1' => $merchantKey, ':m2' => $merchantKey]);
    $prior = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ((int)($prior['cnt'] ?? 0) === 0 && (float)$u['amount'] > 50) {
        $insights[] = [
            'type' => 'unusual_merchant',
            'severity' => 'warning',
            'title' => 'unusual_merchant',
            'description' => '',
            'data' => ['merchant' => $merchantKey, 'amount' => number_format((float)$u['amount'], 2), 'date' => $u['date']],
        ];
    }
}

// 2. SALARY CHANGES
$sql2 = "SELECT t.name, t.merchant_name, t.amount, t.date
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         LEFT JOIN categories cat ON t.category_id = cat.id
         WHERE a.user_id = :user_id2 AND t.excluded = 0 AND t.pending = 0 AND t.amount < 0
           AND (cat.is_income = 1 OR t.amount < -500)
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
           AND (pc.plaid_environment = :plaid_env2 OR a.plaid_connection_id IS NULL)
         ORDER BY t.date DESC";
$stmt2 = $pdo->prepare($sql2);
$stmt2->execute([':user_id2' => $userId, ':plaid_env2' => $plaidEnv]);
$incomes = $stmt2->fetchAll(PDO::FETCH_ASSOC);

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
            $sourceName = $txns[0]['merchant_name'] ?: $txns[0]['name'];
            $insights[] = [
                'type' => 'salary_change',
                'severity' => $changePct > 0 ? 'positive' : 'warning',
                'title' => 'salary_change',
                'description' => '',
                'data' => ['source' => $sourceName, 'previous' => number_format($previous, 2), 'current' => number_format($latest, 2), 'change_percent' => round(abs($changePct), 1), 'direction' => $direction],
            ];
        }
    }
}

// 3. SPENDING SPIKES - categories with recent spend much higher than average
$sql3 = "SELECT cat.name as category_name, cat.color as category_color,
                SUM(CASE WHEN t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as recent_total,
                SUM(CASE WHEN t.date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND t.date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY) THEN t.amount ELSE 0 END) / 3 as avg_monthly
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         JOIN categories cat ON t.category_id = cat.id
         WHERE a.user_id = :user_id3 AND t.excluded = 0 AND t.pending = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
           AND cat.is_income = 0
           AND (pc.plaid_environment = :plaid_env3 OR a.plaid_connection_id IS NULL)
         GROUP BY cat.id HAVING avg_monthly > 20 AND recent_total > avg_monthly * 1.5";
$stmt3 = $pdo->prepare($sql3);
$stmt3->execute([':user_id3' => $userId, ':plaid_env3' => $plaidEnv]);
$spikes = $stmt3->fetchAll(PDO::FETCH_ASSOC);

foreach ($spikes as $spike) {
    $pctOver = round(((float)$spike['recent_total'] / (float)$spike['avg_monthly'] - 1) * 100);
    $insights[] = [
        'type' => 'spending_spike',
        'severity' => $pctOver > 100 ? 'critical' : 'warning',
        'title' => 'spending_spike',
        'description' => '',
        'data' => ['category' => $spike['category_name'], 'recent' => number_format((float)$spike['recent_total'], 2), 'average' => number_format((float)$spike['avg_monthly'], 2), 'spike_percent' => $pctOver],
    ];
}

// 4. DUPLICATE CHARGES
$sql4 = "SELECT t.name, t.merchant_name, t.amount, t.date, COUNT(*) as dup_count
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         WHERE a.user_id = :user_id4 AND t.excluded = 0 AND t.pending = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           AND (pc.plaid_environment = :plaid_env4 OR a.plaid_connection_id IS NULL)
         GROUP BY COALESCE(t.merchant_name, t.name), t.amount, t.date HAVING dup_count > 1";
$stmt4 = $pdo->prepare($sql4);
$stmt4->execute([':user_id4' => $userId, ':plaid_env4' => $plaidEnv]);
$duplicates = $stmt4->fetchAll(PDO::FETCH_ASSOC);

foreach ($duplicates as $dup) {
    $merchant = $dup['merchant_name'] ?: $dup['name'];
    $insights[] = [
        'type' => 'duplicate_charge',
        'severity' => 'warning',
        'title' => 'duplicate_charge',
        'description' => '',
        'data' => ['merchant' => $merchant, 'amount' => number_format((float)$dup['amount'], 2), 'date' => $dup['date'], 'count' => (int)$dup['dup_count']],
    ];
}

// 5. LARGEST TRANSACTIONS this month
$sql5 = "SELECT t.name, t.merchant_name, t.amount, t.date
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         {$envJoin}
         WHERE a.user_id = :user_id5 AND t.excluded = 0 AND t.pending = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           AND (pc.plaid_environment = :plaid_env5 OR a.plaid_connection_id IS NULL)
         ORDER BY t.amount DESC LIMIT 3";
$stmt5 = $pdo->prepare($sql5);
$stmt5->execute([':user_id5' => $userId, ':plaid_env5' => $plaidEnv]);
$largest = $stmt5->fetchAll(PDO::FETCH_ASSOC);

foreach ($largest as $lg) {
    if ((float)$lg['amount'] > 200) {
        $merchant = $lg['merchant_name'] ?: $lg['name'];
        $insights[] = [
            'type' => 'large_transaction',
            'severity' => 'info',
            'title' => 'large_transaction',
            'description' => '',
            'data' => ['merchant' => $merchant, 'amount' => number_format((float)$lg['amount'], 2), 'date' => $lg['date']],
        ];
    }
}

$severityOrder = ['critical' => 0, 'warning' => 1, 'positive' => 2, 'info' => 3];
usort($insights, fn($a, $b) => ($severityOrder[$a['severity']] ?? 4) - ($severityOrder[$b['severity']] ?? 4));

Response::success($insights);
