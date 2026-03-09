<?php
require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? null;

$insights = [];
$envFilter = '';
$params = [':user_id' => $userId];
if ($plaidEnv) {
    $envFilter = ' AND a.plaid_environment = :plaid_env';
    $params[':plaid_env'] = $plaidEnv;
}

// 1. UNUSUAL MERCHANTS
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

foreach ($unusual as $u) {
    $merchantKey = $u['merchant_name'] ?: $u['name'];
    $checkSql = "SELECT COUNT(*) as cnt FROM transactions t
                 JOIN accounts a ON t.account_id = a.id
                 WHERE a.user_id = :check_uid AND t.excluded = 0
                   AND t.date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                   AND (t.merchant_name = :merchant1 OR t.name = :merchant2)";
    $checkParams = [':check_uid' => $userId, ':merchant1' => $merchantKey, ':merchant2' => $merchantKey];
    if ($plaidEnv) {
        $checkSql .= " AND a.plaid_environment = :check_env";
        $checkParams[':check_env'] = $plaidEnv;
    }
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute($checkParams);
    $prior = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ((int)($prior['cnt'] ?? 0) === 0 && (float)$u['amount'] > 50) {
        $insights[] = [
            'type' => 'unusual_merchant',
            'severity' => 'warning',
            'title' => 'Unusual merchant detected',
            'description' => "Transaction at \"{$merchantKey}\" for \$" . number_format((float)$u['amount'], 2) . " on {$u['date']}. You haven't transacted here before.",
            'data' => ['merchant' => $merchantKey, 'amount' => (float)$u['amount'], 'date' => $u['date']],
        ];
    }
}

// 2. SALARY CHANGES
$sql2 = "SELECT t.name, t.merchant_name, t.amount, t.date
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE a.user_id = :user_id2 AND t.excluded = 0 AND t.amount < 0
           AND (c.is_income = 1 OR t.amount < -500)
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)";
$params2 = [':user_id2' => $userId];
if ($plaidEnv) {
    $sql2 .= " AND a.plaid_environment = :plaid_env2";
    $params2[':plaid_env2'] = $plaidEnv;
}
$sql2 .= " ORDER BY t.date DESC";
$stmt2 = $pdo->prepare($sql2);
$stmt2->execute($params2);
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
                'title' => "Income {$direction}",
                'description' => "Your income from \"{$sourceName}\" {$direction} by " . abs(round($changePct, 1)) . "% (from $" . number_format($previous, 2) . " to $" . number_format($latest, 2) . ").",
                'data' => ['source' => $sourceName, 'previous' => $previous, 'current' => $latest, 'change_percent' => round($changePct, 1)],
            ];
        }
    }
}

// 3. SPENDING SPIKES
$sql3 = "SELECT c.name as category_name, c.color as category_color,
                SUM(CASE WHEN t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as recent_total,
                SUM(CASE WHEN t.date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND t.date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY) THEN t.amount ELSE 0 END) / 3 as avg_monthly
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         JOIN categories c ON t.category_id = c.id
         WHERE a.user_id = :user_id3 AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
           AND c.is_income = 0";
$params3 = [':user_id3' => $userId];
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

// 4. DUPLICATE CHARGES
$sql4 = "SELECT t.name, t.merchant_name, t.amount, t.date, COUNT(*) as dup_count
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = :user_id4 AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
$params4 = [':user_id4' => $userId];
if ($plaidEnv) {
    $sql4 .= " AND a.plaid_environment = :plaid_env4";
    $params4[':plaid_env4'] = $plaidEnv;
}
$sql4 .= " GROUP BY COALESCE(t.merchant_name, t.name), t.amount, t.date HAVING dup_count > 1";
$stmt4 = $pdo->prepare($sql4);
$stmt4->execute($params4);
$duplicates = $stmt4->fetchAll(PDO::FETCH_ASSOC);

foreach ($duplicates as $dup) {
    $merchant = $dup['merchant_name'] ?: $dup['name'];
    $insights[] = [
        'type' => 'duplicate_charge',
        'severity' => 'warning',
        'title' => 'Possible duplicate charge',
        'description' => "{$dup['dup_count']} charges of \$" . number_format((float)$dup['amount'], 2) . " at \"{$merchant}\" on {$dup['date']}.",
        'data' => ['merchant' => $merchant, 'amount' => (float)$dup['amount'], 'date' => $dup['date'], 'count' => (int)$dup['dup_count']],
    ];
}

// 5. LARGEST SINGLE TRANSACTIONS
$sql5 = "SELECT t.name, t.merchant_name, t.amount, t.date
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.user_id = :user_id5 AND t.excluded = 0 AND t.amount > 0
           AND t.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
$params5 = [':user_id5' => $userId];
if ($plaidEnv) {
    $sql5 .= " AND a.plaid_environment = :plaid_env5";
    $params5[':plaid_env5'] = $plaidEnv;
}
$sql5 .= " ORDER BY t.amount DESC LIMIT 3";
$stmt5 = $pdo->prepare($sql5);
$stmt5->execute($params5);
$largest = $stmt5->fetchAll(PDO::FETCH_ASSOC);

foreach ($largest as $lg) {
    if ((float)$lg['amount'] > 200) {
        $merchant = $lg['merchant_name'] ?: $lg['name'];
        $insights[] = [
            'type' => 'large_transaction',
            'severity' => 'info',
            'title' => 'Large transaction',
            'description' => "\$" . number_format((float)$lg['amount'], 2) . " at \"{$merchant}\" on {$lg['date']}.",
            'data' => ['merchant' => $merchant, 'amount' => (float)$lg['amount'], 'date' => $lg['date']],
        ];
    }
}

$severityOrder = ['critical' => 0, 'warning' => 1, 'positive' => 2, 'info' => 3];
usort($insights, fn($a, $b) => ($severityOrder[$a['severity']] ?? 4) - ($severityOrder[$b['severity']] ?? 4));

Response::success($insights);
