<?php
/**
 * Subscription Debug Endpoint
 * GET /api/subscriptions/debug.php?search=netflix&plaid_environment=production
 *   [&overrides={json}]
 *
 * Returns matched transactions, filter reasons, computed stats,
 * and which bucket the merchant would match under current tuning
 * (or under live overrides for live testing).
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/SubscriptionTuning.php';

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? 'sandbox';
if (!in_array($plaidEnv, ['sandbox', 'production'])) $plaidEnv = 'sandbox';
$search = strtolower($_GET['search'] ?? '');

if (empty($search)) {
    Response::error('search parameter is required (e.g. ?search=netflix)', 400);
}

$tuning = SubscriptionTuning::load($pdo);
if (!empty($_GET['overrides'])) {
    $ov = json_decode($_GET['overrides'], true);
    if (is_array($ov)) $tuning = SubscriptionTuning::withOverrides($tuning, $ov);
}

$lookback = max(1, (int)$tuning['lookback_months']);

$sql = "SELECT t.id as txn_id, t.plaid_transaction_id, t.name, t.merchant_name, t.amount, t.date, t.pending, t.excluded,
               a.excluded as account_excluded, a.id as account_id,
               cat.name as category_name, cat.is_income,
               c.plaid_environment
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        WHERE a.user_id = :user_id
          AND (LOWER(t.name) LIKE :search OR LOWER(t.merchant_name) LIKE :search2)
        ORDER BY t.date DESC
        LIMIT 100";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':user_id' => $userId,
    ':search' => "%{$search}%",
    ':search2' => "%{$search}%",
]);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Annotate filter reasons (must match index.php SQL filters exactly)
$cutoff = (new DateTime())->modify("-{$lookback} months");
foreach ($transactions as &$t) {
    $t['filter_reasons'] = [];
    if ($t['pending']) $t['filter_reasons'][] = 'pending=1';
    if ($t['excluded']) $t['filter_reasons'][] = 'transaction excluded';
    if ($t['account_excluded']) $t['filter_reasons'][] = 'account excluded';
    if ($t['is_income']) $t['filter_reasons'][] = 'income category';
    if ((float)$t['amount'] <= 0) $t['filter_reasons'][] = 'income/refund (amount <= 0)';
    if ($t['plaid_environment'] && $t['plaid_environment'] !== $plaidEnv) {
        $t['filter_reasons'][] = "wrong environment (txn={$t['plaid_environment']}, filter={$plaidEnv})";
    }
    $date = new DateTime($t['date']);
    if ($date < $cutoff) $t['filter_reasons'][] = "older than {$lookback} months";
}
unset($t);

function debugNormalizeMerchantKey($name) {
    $key = strtolower(trim($name));
    $key = preg_replace('/\s*\*\s*.*$/', '', $key);
    $key = preg_replace('/^(www\.|http[s]?:\/\/)/', '', $key);
    $key = preg_replace('/\s+(inc\.?|llc\.?|ltd\.?|co\.?|corp\.?|\.com|com|ca|org|net)$/i', '', $key);
    $key = preg_replace('/\.(com|ca|org|net|io)$/i', '', $key);
    $key = preg_replace('/\s+#?\d+$/', '', $key);
    $key = preg_replace('/[^a-z0-9\s]/', '', $key);
    $key = preg_replace('/\s+/', ' ', trim($key));
    return $key;
}

$normalizedKeys = [];
foreach ($transactions as $t) {
    $rawName = $t['merchant_name'] ?: $t['name'];
    $normalizedKeys[$rawName] = debugNormalizeMerchantKey($rawName);
}

$eligible = array_values(array_filter($transactions, fn($t) => empty($t['filter_reasons'])));
$amounts = array_map(fn($t) => abs((float)$t['amount']), $eligible);
$datesAsc = array_column($eligible, 'date'); sort($datesAsc);

// Build buckets from tuning
$buckets = [
    ['label' => 'weekly',    'days' => (int)$tuning['weekly_days'],    'min' => (int)$tuning['weekly_min'],    'max' => (int)$tuning['weekly_max']],
    ['label' => 'biweekly',  'days' => (int)$tuning['biweekly_days'],  'min' => (int)$tuning['biweekly_min'],  'max' => (int)$tuning['biweekly_max']],
    ['label' => 'monthly',   'days' => (int)$tuning['monthly_days'],   'min' => (int)$tuning['monthly_min'],   'max' => (int)$tuning['monthly_max']],
    ['label' => 'quarterly', 'days' => (int)$tuning['quarterly_days'], 'min' => (int)$tuning['quarterly_min'], 'max' => (int)$tuning['quarterly_max']],
    ['label' => 'annual',    'days' => (int)$tuning['annual_days'],    'min' => (int)$tuning['annual_min'],    'max' => (int)$tuning['annual_max']],
];

$intervalStats = null;
$amountStats = null;
$matchedBucket = null;
$checks = [];

if (count($datesAsc) >= 2) {
    $intervals = [];
    for ($i = 1; $i < count($datesAsc); $i++) {
        $d1 = new DateTime($datesAsc[$i - 1]);
        $d2 = new DateTime($datesAsc[$i]);
        $intervals[] = (int)$d1->diff($d2)->days;
    }
    $sorted = $intervals; sort($sorted);
    $mid = floor(count($sorted) / 2);
    $median = count($sorted) % 2 === 0 ? ($sorted[$mid - 1] + $sorted[$mid]) / 2 : $sorted[$mid];

    $intervalStats = [
        'intervals' => $intervals,
        'median' => $median,
        'min' => min($intervals),
        'max' => max($intervals),
    ];

    foreach ($buckets as $bucket) {
        if ($median >= $bucket['min'] && $median <= $bucket['max']) {
            $matchedBucket = $bucket;
            break;
        }
    }
    $checks[] = [
        'name' => 'Bucket match',
        'pass' => $matchedBucket !== null,
        'detail' => $matchedBucket
            ? "median {$median}d → {$matchedBucket['label']} ({$matchedBucket['min']}-{$matchedBucket['max']}d)"
            : "median {$median}d does not fit any bucket",
    ];

    // Interval variance check
    $intervalVarMin = (int)$tuning['interval_variance_min_count'];
    $intervalVarPct = (float)$tuning['interval_variance_pct'] / 100.0;
    if ($matchedBucket && count($intervals) > $intervalVarMin) {
        $v = 0;
        foreach ($intervals as $iv) $v += pow($iv - $matchedBucket['days'], 2);
        $std = sqrt($v / count($intervals));
        $threshold = $matchedBucket['days'] * $intervalVarPct;
        $checks[] = [
            'name' => 'Interval variance',
            'pass' => $std <= $threshold,
            'detail' => 'std=' . round($std, 2) . 'd, threshold=' . round($threshold, 2) . 'd',
        ];
    } else if ($matchedBucket) {
        $checks[] = [
            'name' => 'Interval variance',
            'pass' => true,
            'detail' => "skipped (only " . count($intervals) . " intervals, need >{$intervalVarMin})",
        ];
    }
}

if (!empty($amounts)) {
    $mean = array_sum($amounts) / count($amounts);
    $variance = 0;
    foreach ($amounts as $a) $variance += pow($a - $mean, 2);
    $stdDev = sqrt($variance / count($amounts));
    $amountStats = [
        'mean' => round($mean, 2),
        'std_dev' => round($stdDev, 2),
        'cv_percent' => $mean > 0 ? round($stdDev / $mean * 100, 1) : 0,
    ];

    $amountVarMin = (int)$tuning['amount_variance_min_count'];
    $amountVarPct = (float)$tuning['amount_variance_pct'] / 100.0;
    if (count($amounts) > $amountVarMin) {
        $threshold = $mean * $amountVarPct;
        $checks[] = [
            'name' => 'Amount variance',
            'pass' => $stdDev <= $threshold,
            'detail' => 'std=$' . round($stdDev, 2) . ', threshold=$' . round($threshold, 2)
                . ' (CV ' . $amountStats['cv_percent'] . '% vs limit ' . ($amountVarPct * 100) . '%)',
        ];
    } else {
        $checks[] = [
            'name' => 'Amount variance',
            'pass' => true,
            'detail' => "skipped (only " . count($amounts) . " amounts, need >{$amountVarMin})",
        ];
    }
}

// Min occurrences check
$minOcc = max(2, (int)$tuning['min_occurrences']);
$checks[] = [
    'name' => 'Min occurrences',
    'pass' => count($eligible) >= $minOcc,
    'detail' => count($eligible) . " eligible txns (need ≥{$minOcc})",
];

$wouldDetect = !empty($checks) && !in_array(false, array_column($checks, 'pass'), true) && $matchedBucket !== null;

Response::success([
    'search' => $search,
    'plaid_environment' => $plaidEnv,
    'tuning_used' => $tuning,
    'total_found' => count($transactions),
    'eligible_count' => count($eligible),
    'transactions' => $transactions,
    'normalized_keys' => $normalizedKeys,
    'interval_stats' => $intervalStats,
    'amount_stats' => $amountStats,
    'matched_bucket' => $matchedBucket,
    'checks' => $checks,
    'would_detect' => $wouldDetect,
]);
