<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$userId = getCurrentUserId();
$pdo = Database::getConnection();
$plaidEnv = $_GET['plaid_environment'] ?? 'sandbox';
if (!in_array($plaidEnv, ['sandbox', 'production'])) $plaidEnv = 'sandbox';

// Handle POST for dismiss/restore
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $merchantKey = $input['merchant_key'] ?? '';
    $dismiss = !empty($input['dismiss']);

    if (empty($merchantKey)) {
        Response::error('merchant_key is required', 400);
    }

    // Create table if not exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS subscription_dismissals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        merchant_key VARCHAR(255) NOT NULL,
        plaid_environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_merchant_env (user_id, merchant_key, plaid_environment),
        INDEX idx_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if ($dismiss) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO subscription_dismissals (user_id, merchant_key, plaid_environment) VALUES (:user_id, :key, :env)");
        $stmt->execute([':user_id' => $userId, ':key' => $merchantKey, ':env' => $plaidEnv]);
    } else {
        $stmt = $pdo->prepare("DELETE FROM subscription_dismissals WHERE user_id = :user_id AND merchant_key = :key AND plaid_environment = :env");
        $stmt->execute([':user_id' => $userId, ':key' => $merchantKey, ':env' => $plaidEnv]);
    }

    Response::success(['dismissed' => $dismiss]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

// Load dismissed merchants
try {
    $dStmt = $pdo->prepare("SELECT merchant_key FROM subscription_dismissals WHERE user_id = :user_id AND plaid_environment = :env");
    $dStmt->execute([':user_id' => $userId, ':env' => $plaidEnv]);
    $dismissedKeys = array_column($dStmt->fetchAll(PDO::FETCH_ASSOC), 'merchant_key');
} catch (Exception $e) {
    // Table might not exist yet
    $dismissedKeys = [];
}

// Fetch ALL non-excluded, non-pending transactions from the last 18 months
// Exclude income categories (is_income = 1)
$sql = "SELECT t.name, t.merchant_name, t.amount, t.date, t.category_id,
               cat.name as category_name, cat.color as category_color
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        WHERE a.user_id = :user_id
          AND a.excluded = 0
          AND t.excluded = 0
          AND t.pending = 0
          AND t.amount != 0
          AND t.date >= DATE_SUB(CURDATE(), INTERVAL 18 MONTH)
          AND (c.plaid_environment = :plaid_env OR a.plaid_connection_id IS NULL)
          AND (cat.is_income = 0 OR cat.is_income IS NULL)
        GROUP BY t.id
        ORDER BY t.date DESC";

$params = [':user_id' => $userId, ':plaid_env' => $plaidEnv];

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Normalize merchant names for better grouping
function normalizeMerchantKey($name) {
    $key = strtolower(trim($name));
    // Remove common suffixes/noise
    $key = preg_replace('/\s+(inc\.?|llc\.?|ltd\.?|co\.?|corp\.?|\.com|com)$/i', '', $key);
    // Remove trailing numbers (order IDs, reference numbers, etc.)
    $key = preg_replace('/\s+#?\d+$/', '', $key);
    // Remove asterisk patterns common in credit card descriptors (e.g., "NETFLIX *MEMBER")
    $key = preg_replace('/\s*\*\s*.*$/', '', $key);
    // Remove special characters except spaces and letters/numbers
    $key = preg_replace('/[^a-z0-9\s]/', '', $key);
    // Collapse whitespace
    $key = preg_replace('/\s+/', ' ', trim($key));
    return $key;
}

// Group by normalized merchant key, using absolute amounts
$merchants = [];
foreach ($transactions as $t) {
    $rawName = $t['merchant_name'] ?: $t['name'];
    $key = normalizeMerchantKey($rawName);
    if (strlen($key) < 2) continue;

    if (!isset($merchants[$key])) {
        $merchants[$key] = [
            'name' => $rawName,
            'category_name' => $t['category_name'],
            'category_color' => $t['category_color'],
            'transactions' => [],
            '_seen' => [],
        ];
    }
    // Deduplicate: skip if same date + same amount already seen for this merchant
    $dedupeKey = $t['date'] . '|' . abs((float)$t['amount']);
    if (in_array($dedupeKey, $merchants[$key]['_seen'])) continue;
    $merchants[$key]['_seen'][] = $dedupeKey;

    $merchants[$key]['transactions'][] = [
        'amount' => abs((float)$t['amount']),
        'date' => $t['date'],
    ];
}

$buckets = [
    ['label' => 'weekly', 'days' => 7, 'min' => 4, 'max' => 11],
    ['label' => 'biweekly', 'days' => 14, 'min' => 11, 'max' => 21],
    ['label' => 'monthly', 'days' => 30, 'min' => 21, 'max' => 38],
    ['label' => 'quarterly', 'days' => 91, 'min' => 80, 'max' => 105],
    ['label' => 'annual', 'days' => 365, 'min' => 340, 'max' => 400],
];

$subscriptions = [];

foreach ($merchants as $key => $merchant) {
    $txns = $merchant['transactions'];
    if (count($txns) < 2) continue;

    usort($txns, fn($a, $b) => strcmp($a['date'], $b['date']));

    $intervals = [];
    for ($i = 1; $i < count($txns); $i++) {
        $d1 = new DateTime($txns[$i - 1]['date']);
        $d2 = new DateTime($txns[$i]['date']);
        $intervals[] = (int)$d1->diff($d2)->days;
    }
    if (empty($intervals)) continue;

    // Use median interval for better resilience to billing date shifts
    $sorted = $intervals;
    sort($sorted);
    $mid = floor(count($sorted) / 2);
    $medianInterval = count($sorted) % 2 === 0
        ? ($sorted[$mid - 1] + $sorted[$mid]) / 2
        : $sorted[$mid];

    $matchedBucket = null;
    foreach ($buckets as $bucket) {
        if ($medianInterval >= $bucket['min'] && $medianInterval <= $bucket['max']) {
            $matchedBucket = $bucket;
            break;
        }
    }
    if (!$matchedBucket) continue;

    // Strict variance check — max 20% deviation from expected interval
    $variance = 0;
    foreach ($intervals as $iv) {
        $variance += pow($iv - $matchedBucket['days'], 2);
    }
    $stdDev = sqrt($variance / count($intervals));
    $varianceThreshold = 0.20;
    if ($stdDev > $matchedBucket['days'] * $varianceThreshold) continue;

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
        'merchant_key' => $key,
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
        'dismissed' => in_array($key, $dismissedKeys),
    ];
}

usort($subscriptions, function ($a, $b) {
    if ($a['dismissed'] !== $b['dismissed']) return $a['dismissed'] ? 1 : -1;
    $order = ['missed' => 0, 'due_soon' => 1, 'active' => 2];
    $diff = ($order[$a['status']] ?? 3) - ($order[$b['status']] ?? 3);
    if ($diff !== 0) return $diff;
    return $b['amount'] - $a['amount'];
});

$activeOnly = array_filter($subscriptions, fn($s) => !$s['dismissed']);
$totalMonthly = array_sum(array_column($activeOnly, 'monthly_cost'));
$totalAnnual = array_sum(array_column($activeOnly, 'annual_cost'));

Response::success([
    'subscriptions' => array_values($subscriptions),
    'summary' => [
        'total_count' => count($activeOnly),
        'total_monthly' => round($totalMonthly, 2),
        'total_annual' => round($totalAnnual, 2),
        'missed_count' => count(array_filter($activeOnly, fn($s) => $s['status'] === 'missed')),
        'price_changes' => count(array_filter($activeOnly, fn($s) => $s['price_change'] !== null)),
    ],
]);
