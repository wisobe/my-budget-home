<?php
/**
 * Preview Apply All Rules Endpoint (Dry Run)
 * POST /api/categories/preview-apply-rules.php
 * Returns the list of transactions that WOULD be re-categorized by applying all rules.
 * Does NOT modify any data.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $environment = getPlaidEnvironment();

    // Fetch all rules for this user/environment
    $stmt = $pdo->prepare('
        SELECT cr.keyword, cr.match_type, cr.category_id, c.name as new_category_name, c.color as new_category_color
        FROM category_rules cr
        LEFT JOIN categories c ON cr.category_id = c.id
        WHERE cr.user_id = :user_id AND cr.plaid_environment = :env
        ORDER BY cr.priority DESC
    ');
    $stmt->execute(['user_id' => $userId, 'env' => $environment]);
    $rules = $stmt->fetchAll();

    if (empty($rules)) {
        Response::success(['transactions' => [], 'total_count' => 0], 'No rules to apply');
    }

    // Collect all matching transaction IDs, keeping only the first (highest priority) match per transaction
    $matchedTransactions = [];
    $seenIds = [];

    foreach ($rules as $rule) {
        $keywords = array_filter(array_map('trim', explode('|', $rule['keyword'])));
        if (empty($keywords)) continue;

        $conditions = [];
        $params = [
            'user_id' => $userId,
            'env' => $environment,
        ];

        foreach ($keywords as $i => $kw) {
            $kwParam = "kw_{$i}";
            $kwParam2 = "kw2_{$i}";
            switch ($rule['match_type']) {
                case 'exact':
                    $conditions[] = "(UPPER(t.name) = :{$kwParam} OR UPPER(t.merchant_name) = :{$kwParam2})";
                    $params[$kwParam] = strtoupper($kw);
                    $params[$kwParam2] = strtoupper($kw);
                    break;
                case 'starts_with':
                    $conditions[] = "(UPPER(t.name) LIKE :{$kwParam} OR UPPER(t.merchant_name) LIKE :{$kwParam2})";
                    $params[$kwParam] = strtoupper($kw) . '%';
                    $params[$kwParam2] = strtoupper($kw) . '%';
                    break;
                case 'contains':
                default:
                    $conditions[] = "(UPPER(t.name) LIKE :{$kwParam} OR UPPER(t.merchant_name) LIKE :{$kwParam2})";
                    $params[$kwParam] = '%' . strtoupper($kw) . '%';
                    $params[$kwParam2] = '%' . strtoupper($kw) . '%';
                    break;
            }
        }

        $combinedCondition = '(' . implode(' OR ', $conditions) . ')';

        $selectStmt = $pdo->prepare("
            SELECT t.id, t.name, t.merchant_name, t.amount, t.date, t.category_id,
                   c_current.name as current_category_name, c_current.color as current_category_color
            FROM transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            INNER JOIN plaid_connections pc ON a.plaid_connection_id = pc.id
            LEFT JOIN categories c_current ON t.category_id = c_current.id
            WHERE a.user_id = :user_id
              AND pc.plaid_environment = :env
              AND {$combinedCondition}
              AND (t.auto_categorize_locked IS NULL OR t.auto_categorize_locked = 0)
        ");
        $selectStmt->execute($params);
        $rows = $selectStmt->fetchAll();

        foreach ($rows as $row) {
            // Skip if already matched by a higher-priority rule
            if (isset($seenIds[$row['id']])) continue;
            // Skip if category would not change
            if ($row['category_id'] === $rule['category_id']) continue;

            $seenIds[$row['id']] = true;
            $matchedTransactions[] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'merchant_name' => $row['merchant_name'],
                'amount' => (float) $row['amount'],
                'date' => $row['date'],
                'current_category_name' => $row['current_category_name'],
                'current_category_color' => $row['current_category_color'],
                'new_category_name' => $rule['new_category_name'],
                'new_category_color' => $rule['new_category_color'],
            ];
        }
    }

    // Sort by date descending
    usort($matchedTransactions, function($a, $b) {
        return strcmp($b['date'], $a['date']);
    });

    Response::success([
        'transactions' => $matchedTransactions,
        'total_count' => count($matchedTransactions),
    ]);
} catch (Exception $e) {
    Response::error('Failed to preview rules: ' . $e->getMessage(), 500);
}
