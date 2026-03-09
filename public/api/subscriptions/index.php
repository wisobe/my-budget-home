<?php
require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? 'sandbox';
if (!in_array($plaidEnv, ['sandbox', 'production'])) $plaidEnv = 'sandbox';

$sql = "SELECT t.name, t.merchant_name, t.amount, t.date, t.category_id,
               cat.name as category_name, cat.color as category_color
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        WHERE a.user_id = :user_id
          AND t.excluded = 0
          AND t.amount > 0
          AND t.date >= DATE_SUB(CURDATE(), INTERVAL 18 MONTH)
          AND (c.plaid_environment = :plaid_env OR a.plaid_connection_id IS NULL)
        ORDER BY t.date DESC";

$params = [':user_id' => $userId, ':plaid_env' => $plaidEnv];

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Group by merchant
$merchants = [];
foreach ($transactions as $t) {
    $key = strtolower(trim($t['merchant_name'] ?: $t['name']));
    if (!isset($merchants[$key])) {
        $merchants[$key] = [
            'name' => $t['merchant_name'] ?: $t['name'],
            'category_name' => $t['category_name'],
            'category_color' => $t['category_color'],
            'transactions' => [],
        ];
    }
    $merchants[$key]['transactions'][] = [
        'amount' => (float)$t['amount'],
        'date' => $t['date'],
    ];
}

$buckets = [
    ['label' => 'weekly', 'days' => 7, 'min' => 4, 'max' => 11],
    ['label' => 'biweekly', 'days' => 14, 'min' => 11, 'max' => 20],
    ['label' => 'monthly', 'days' => 30, 'min' => 25, 'max' => 38],
    ['label' => 'quarterly', 'days' => 91, 'min' => 80, 'max' => 105],
    ['label' => 'annual', 'days' => 365, 'min' => 340, 'max' => 400],
];

$subscriptions = [];

foreach ($merchants as $key => $merchant) {
    $txns = $merchant['transactions'];
    if (count($txns) < 3) continue;

    usort($txns, fn($a, $b) => strcmp($a['date'], $b['date']));

    $intervals = [];
    for ($i = 1; $i < count($txns); $i++) {
        $d1 = new DateTime($txns[$i - 1]['date']);
        $d2 = new DateTime($txns[$i]['date']);
        $intervals[] = (int)$d1->diff($d2)->days;
    }
    if (empty($intervals)) continue;

    $avgInterval = array_sum($intervals) / count($intervals);

    $matchedBucket = null;
    foreach ($buckets as $bucket) {
        if ($avgInterval >= $bucket['min'] && $avgInterval <= $bucket['max']) {
            $matchedBucket = $bucket;
            break;
        }
    }
    if (!$matchedBucket) continue;

    $variance = 0;
    foreach ($intervals as $iv) {
        $variance += pow($iv - $matchedBucket['days'], 2);
    }
    $stdDev = sqrt($variance / count($intervals));
    if ($stdDev > $matchedBucket['days'] * 0.35) continue;

    $amounts = array_column($txns, 'amount');
    $currentAmount = end($amounts);
    $previousAmount = count($amounts) >= 2 ? $amounts[count($amounts) - 2] : $currentAmount;
    $avgAmount = array_sum($amounts) / count($amounts);

    $priceChange = null;
    if ($previousAmount > 0 && abs($currentAmount - $previousAmount) / $previousAmount > 0.05) {
        $priceChange = [
            'previous' => round($previousAmount, 2),
            'current' => round($currentAmount, 2),
            'change_percent' => round(($currentAmount - $previousAmount) / $previousAmount * 100, 1),
            'direction' => $currentAmount > $previousAmount ? 'increase' : 'decrease',
        ];
    }

    $lastDate = new DateTime(end($txns)['date']);
    $today = new DateTime();
    $daysSinceLast = (int)$lastDate->diff($today)->days;
    $expectedInterval = $matchedBucket['days'];

    $status = 'active';
    if ($daysSinceLast > $expectedInterval * 1.5) {
        $status = 'missed';
    } elseif ($daysSinceLast > $expectedInterval * 0.8) {
        $status = 'due_soon';
    }

    $nextDate = clone $lastDate;
    $nextDate->modify("+{$expectedInterval} days");

    $subscriptions[] = [
        'merchant' => $merchant['name'],
        'frequency' => $matchedBucket['label'],
        'amount' => round($currentAmount, 2),
        'avg_amount' => round($avgAmount, 2),
        'occurrence_count' => count($txns),
        'last_date' => end($txns)['date'],
        'next_expected_date' => $nextDate->format('Y-m-d'),
        'status' => $status,
        'price_change' => $priceChange,
        'category_name' => $merchant['category_name'],
        'category_color' => $merchant['category_color'],
        'monthly_cost' => round($currentAmount * (30 / $expectedInterval), 2),
        'annual_cost' => round($currentAmount * (365 / $expectedInterval), 2),
    ];
}

usort($subscriptions, function ($a, $b) {
    $order = ['missed' => 0, 'due_soon' => 1, 'active' => 2];
    $diff = ($order[$a['status']] ?? 3) - ($order[$b['status']] ?? 3);
    if ($diff !== 0) return $diff;
    return $b['amount'] - $a['amount'];
});

$totalMonthly = array_sum(array_column($subscriptions, 'monthly_cost'));
$totalAnnual = array_sum(array_column($subscriptions, 'annual_cost'));

Response::success([
    'subscriptions' => $subscriptions,
    'summary' => [
        'total_count' => count($subscriptions),
        'total_monthly' => round($totalMonthly, 2),
        'total_annual' => round($totalAnnual, 2),
        'missed_count' => count(array_filter($subscriptions, fn($s) => $s['status'] === 'missed')),
        'price_changes' => count(array_filter($subscriptions, fn($s) => $s['price_change'] !== null)),
    ],
]);
