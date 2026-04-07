<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? 'sandbox';
if (!in_array($plaidEnv, ['sandbox', 'production'])) $plaidEnv = 'sandbox';
$search = strtolower($_GET['search'] ?? '');

if (empty($search)) {
    Response::error('search parameter is required (e.g. ?search=netflix)', 400);
}

// Find all transactions matching the search term
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
        LIMIT 50";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':user_id' => $userId,
    ':search' => "%{$search}%",
    ':search2' => "%{$search}%",
]);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Analyze why they might be filtered out
foreach ($transactions as &$t) {
    $t['filter_reasons'] = [];
    if ($t['pending']) $t['filter_reasons'][] = 'pending=1';
    if ($t['excluded']) $t['filter_reasons'][] = 'transaction excluded';
    if ($t['account_excluded']) $t['filter_reasons'][] = 'account excluded';
    if ($t['is_income']) $t['filter_reasons'][] = 'income category';
    if ($t['amount'] == 0) $t['filter_reasons'][] = 'zero amount';
    if ($t['plaid_environment'] && $t['plaid_environment'] !== $plaidEnv) {
        $t['filter_reasons'][] = "wrong environment (txn={$t['plaid_environment']}, filter={$plaidEnv})";
    }
    $date = new DateTime($t['date']);
    $cutoff = new DateTime();
    $cutoff->modify('-18 months');
    if ($date < $cutoff) $t['filter_reasons'][] = 'older than 18 months';
}

// Use the same normalization as the main endpoint
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

// Compute interval and amount stats for the matched transactions (eligible only)
$eligible = array_filter($transactions, fn($t) => empty($t['filter_reasons']));
$amounts = array_map(fn($t) => abs((float)$t['amount']), $eligible);
$dates = array_column($eligible, 'date');
sort($dates);

$intervalStats = null;
$amountStats = null;

if (count($dates) >= 2) {
    $intervals = [];
    for ($i = 1; $i < count($dates); $i++) {
        $d1 = new DateTime($dates[$i - 1]);
        $d2 = new DateTime($dates[$i]);
        $intervals[] = (int)$d1->diff($d2)->days;
    }
    $sorted = $intervals;
    sort($sorted);
    $mid = floor(count($sorted) / 2);
    $median = count($sorted) % 2 === 0
        ? ($sorted[$mid - 1] + $sorted[$mid]) / 2
        : $sorted[$mid];
    $intervalStats = [
        'intervals' => $intervals,
        'median' => $median,
        'min' => min($intervals),
        'max' => max($intervals),
    ];
}

if (!empty($amounts)) {
    $mean = array_sum($amounts) / count($amounts);
    $variance = 0;
    foreach ($amounts as $a) {
        $variance += pow($a - $mean, 2);
    }
    $stdDev = sqrt($variance / count($amounts));
    $amountStats = [
        'mean' => round($mean, 2),
        'std_dev' => round($stdDev, 2),
        'cv_percent' => $mean > 0 ? round($stdDev / $mean * 100, 1) : 0,
        'threshold_10pct' => round($mean * 0.10, 2),
        'passes_amount_check' => $mean > 0 ? $stdDev <= $mean * 0.10 : true,
    ];
}

Response::success([
    'search' => $search,
    'plaid_environment' => $plaidEnv,
    'total_found' => count($transactions),
    'eligible_count' => count($eligible),
    'transactions' => $transactions,
    'normalized_keys' => $normalizedKeys,
    'interval_stats' => $intervalStats,
    'amount_stats' => $amountStats,
]);
