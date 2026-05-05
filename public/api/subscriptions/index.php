<?php
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/SubscriptionTuning.php';

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

// Optional: live override of tuning params via ?overrides=<json> (admin can pass during testing).
$tuning = SubscriptionTuning::load($pdo);
if (!empty($_GET['overrides'])) {
    $ov = json_decode($_GET['overrides'], true);
    if (is_array($ov)) $tuning = SubscriptionTuning::withOverrides($tuning, $ov);
}

$result = detectSubscriptions($pdo, $userId, $plaidEnv, $tuning);

Response::success($result + ['tuning' => $tuning]);


// ============================================================================
// Detection function — pure, parameterized by $tuning
// ============================================================================
function normalizeMerchantKey($name) {
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

function detectSubscriptions(PDO $pdo, string $userId, string $plaidEnv, array $T): array {
    // Dismissed merchants
    try {
        $dStmt = $pdo->prepare("SELECT merchant_key FROM subscription_dismissals WHERE user_id = :user_id AND plaid_environment = :env");
        $dStmt->execute([':user_id' => $userId, ':env' => $plaidEnv]);
        $dismissedKeys = array_column($dStmt->fetchAll(PDO::FETCH_ASSOC), 'merchant_key');
    } catch (Exception $e) {
        $dismissedKeys = [];
    }

    $lookback = max(1, (int)$T['lookback_months']);

    $sql = "SELECT t.id, t.name, t.merchant_name, t.amount, t.date, t.category_id,
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
              AND t.date >= DATE_SUB(CURDATE(), INTERVAL {$lookback} MONTH)
              AND (c.plaid_environment = :plaid_env OR a.plaid_connection_id IS NULL)
              AND (cat.is_income = 0 OR cat.is_income IS NULL)
            ORDER BY t.date DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':user_id' => $userId, ':plaid_env' => $plaidEnv]);
    $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by normalized merchant key
    $merchants = [];
    $seenTxnIds = [];
    $minKeyLen = max(1, (int)$T['min_key_length']);
    foreach ($transactions as $t) {
        if (isset($seenTxnIds[$t['id']])) continue;
        $seenTxnIds[$t['id']] = true;

        $rawName = $t['merchant_name'] ?: $t['name'];
        $key = normalizeMerchantKey($rawName);
        if (strlen($key) < $minKeyLen) continue;

        if (!isset($merchants[$key])) {
            $merchants[$key] = [
                'name' => $rawName,
                'category_name' => $t['category_name'],
                'category_color' => $t['category_color'],
                'transactions' => [],
                '_seen' => [],
            ];
        }
        $dedupeKey = $t['date'] . '|' . abs((float)$t['amount']);
        if (in_array($dedupeKey, $merchants[$key]['_seen'])) continue;
        $merchants[$key]['_seen'][] = $dedupeKey;

        $merchants[$key]['transactions'][] = [
            'amount' => abs((float)$t['amount']),
            'date' => $t['date'],
        ];
    }

    // Fuzzy prefix merging
    $keys = array_keys($merchants);
    sort($keys);
    $minPrefix = max(1, (int)$T['fuzzy_min_prefix']);
    for ($i = 0; $i < count($keys); $i++) {
        if (!isset($merchants[$keys[$i]])) continue;
        for ($j = $i + 1; $j < count($keys); $j++) {
            if (!isset($merchants[$keys[$j]])) continue;
            $a = $keys[$i]; $b = $keys[$j];
            $shorter = strlen($a) <= strlen($b) ? $a : $b;
            $longer = strlen($a) <= strlen($b) ? $b : $a;
            if (strlen($shorter) >= $minPrefix && strpos($longer, $shorter) === 0) {
                $target = count($merchants[$a]['transactions']) >= count($merchants[$b]['transactions']) ? $a : $b;
                $source = $target === $a ? $b : $a;
                foreach ($merchants[$source]['transactions'] as $txn) {
                    $dk = $txn['date'] . '|' . $txn['amount'];
                    if (!in_array($dk, $merchants[$target]['_seen'])) {
                        $merchants[$target]['_seen'][] = $dk;
                        $merchants[$target]['transactions'][] = $txn;
                    }
                }
                unset($merchants[$source]);
            }
        }
    }

    $buckets = [
        ['label' => 'weekly',    'days' => (int)$T['weekly_days'],    'min' => (int)$T['weekly_min'],    'max' => (int)$T['weekly_max']],
        ['label' => 'biweekly',  'days' => (int)$T['biweekly_days'],  'min' => (int)$T['biweekly_min'],  'max' => (int)$T['biweekly_max']],
        ['label' => 'monthly',   'days' => (int)$T['monthly_days'],   'min' => (int)$T['monthly_min'],   'max' => (int)$T['monthly_max']],
        ['label' => 'quarterly', 'days' => (int)$T['quarterly_days'], 'min' => (int)$T['quarterly_min'], 'max' => (int)$T['quarterly_max']],
        ['label' => 'annual',    'days' => (int)$T['annual_days'],    'min' => (int)$T['annual_min'],    'max' => (int)$T['annual_max']],
    ];

    $minOccurrences   = max(2, (int)$T['min_occurrences']);
    $intervalVarPct   = (float)$T['interval_variance_pct'] / 100.0;
    $intervalVarMin   = (int)$T['interval_variance_min_count'];
    $amountVarPct     = (float)$T['amount_variance_pct'] / 100.0;
    $amountVarMin     = (int)$T['amount_variance_min_count'];
    $dueSoonMul       = (float)$T['due_soon_multiplier'];
    $missedMul        = (float)$T['missed_multiplier'];
    $priceChangePct   = (float)$T['price_change_threshold'] / 100.0;

    $subscriptions = [];

    foreach ($merchants as $key => $merchant) {
        $txns = $merchant['transactions'];
        if (count($txns) < $minOccurrences) continue;

        usort($txns, fn($a, $b) => strcmp($a['date'], $b['date']));

        $intervals = [];
        for ($i = 1; $i < count($txns); $i++) {
            $d1 = new DateTime($txns[$i - 1]['date']);
            $d2 = new DateTime($txns[$i]['date']);
            $intervals[] = (int)$d1->diff($d2)->days;
        }
        if (empty($intervals)) continue;

        $sorted = $intervals; sort($sorted);
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

        if (count($intervals) > $intervalVarMin) {
            $variance = 0;
            foreach ($intervals as $iv) $variance += pow($iv - $matchedBucket['days'], 2);
            $stdDev = sqrt($variance / count($intervals));
            if ($stdDev > $matchedBucket['days'] * $intervalVarPct) continue;
        }

        $amounts = array_column($txns, 'amount');
        $avgAmount = array_sum($amounts) / count($amounts);
        if ($avgAmount > 0 && count($amounts) > $amountVarMin) {
            $av = 0;
            foreach ($amounts as $amt) $av += pow($amt - $avgAmount, 2);
            $amountStdDev = sqrt($av / count($amounts));
            if ($amountStdDev > $avgAmount * $amountVarPct) continue;
        }

        $currentAmount = end($amounts);
        $previousAmount = count($amounts) >= 2 ? $amounts[count($amounts) - 2] : $currentAmount;

        $priceChange = null;
        if ($previousAmount > 0 && abs($currentAmount - $previousAmount) / $previousAmount > $priceChangePct) {
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
        if ($daysSinceLast > $expectedInterval * $missedMul) $status = 'missed';
        elseif ($daysSinceLast > $expectedInterval * $dueSoonMul) $status = 'due_soon';

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

    return [
        'subscriptions' => array_values($subscriptions),
        'summary' => [
            'total_count' => count($activeOnly),
            'total_monthly' => round($totalMonthly, 2),
            'total_annual' => round($totalAnnual, 2),
            'missed_count' => count(array_filter($activeOnly, fn($s) => $s['status'] === 'missed')),
            'price_changes' => count(array_filter($activeOnly, fn($s) => $s['price_change'] !== null)),
        ],
    ];
}
