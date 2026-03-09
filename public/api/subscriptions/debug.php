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
        GROUP BY t.id
        ORDER BY t.date DESC
        LIMIT 50";

// Also search by account for transactions around expected dates
$sqlByAccount = "SELECT t.id as txn_id, t.plaid_transaction_id, t.name, t.merchant_name, t.amount, t.date, t.pending, t.excluded,
               a.excluded as account_excluded, a.id as account_id,
               cat.name as category_name, cat.is_income,
               c.plaid_environment
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
        LEFT JOIN categories cat ON t.category_id = cat.id
        WHERE a.user_id = :user_id
          AND t.amount = 9.19
          AND t.date >= '2025-12-01'
        GROUP BY t.id
        ORDER BY t.date DESC
        LIMIT 50";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':user_id' => $userId,
    ':search' => "%{$search}%",
    ':search2' => "%{$search}%",
]);
$transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Run the amount-based search to find the missing transaction
$stmt2 = $pdo->prepare($sqlByAccount);
$stmt2->execute([':user_id' => $userId]);
$amountMatches = $stmt2->fetchAll(PDO::FETCH_ASSOC);

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

// Inline normalization function
function debugNormalizeMerchantKey($name) {
    $key = strtolower(trim($name));
    $key = preg_replace('/\s+(inc\.?|llc\.?|ltd\.?|co\.?|corp\.?|\.com|com)$/i', '', $key);
    $key = preg_replace('/\s+#?\d+$/', '', $key);
    $key = preg_replace('/\s*\*\s*.*$/', '', $key);
    $key = preg_replace('/[^a-z0-9\s]/', '', $key);
    $key = preg_replace('/\s+/', ' ', trim($key));
    return $key;
}

$normalizedKeys = [];
foreach ($transactions as $t) {
    $rawName = $t['merchant_name'] ?: $t['name'];
    $normalizedKeys[$rawName] = debugNormalizeMerchantKey($rawName);
}

Response::success([
    'search' => $search,
    'plaid_environment' => $plaidEnv,
    'total_found' => count($transactions),
    'transactions' => $transactions,
    'amount_matches_919' => $amountMatches,
    'normalized_keys' => $normalizedKeys,
]);
