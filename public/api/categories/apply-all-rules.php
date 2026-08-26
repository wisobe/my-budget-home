<?php
/**
 * Apply All Category Rules Endpoint
 * POST /api/categories/apply-all-rules.php
 * Applies all user rules to matching transactions (respects locked transactions).
 * Returns the total number of transactions updated.
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
        SELECT keyword, match_type, category_id
        FROM category_rules
        WHERE user_id = :user_id AND plaid_environment = :env
        ORDER BY priority DESC
    ');
    $stmt->execute(['user_id' => $userId, 'env' => $environment]);
    $rules = $stmt->fetchAll();

    if (empty($rules)) {
        Response::success(['applied_count' => 0], 'No rules to apply');
    }

    $totalAffected = 0;

    foreach ($rules as $rule) {
        $keywords = array_filter(array_map('trim', explode('|', $rule['keyword'])));
        if (empty($keywords)) continue;

        $conditions = [];
        $params = [
            'category_id' => $rule['category_id'],
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
                    $conditions[] = "(UPPER(t.name) REGEXP :{$kwParam} OR UPPER(t.merchant_name) REGEXP :{$kwParam2})";
                    $params[$kwParam] = RuleMatcher::containsSqlPattern($kw);
                    $params[$kwParam2] = RuleMatcher::containsSqlPattern($kw);
                    break;
            }
        }

        $combinedCondition = '(' . implode(' OR ', $conditions) . ')';

        $updateStmt = $pdo->prepare("
            UPDATE transactions t
            INNER JOIN accounts a ON t.account_id = a.id
            INNER JOIN plaid_connections pc ON a.plaid_connection_id = pc.id
            SET t.category_id = :category_id
            WHERE a.user_id = :user_id
              AND pc.plaid_environment = :env
              AND {$combinedCondition}
              AND (t.auto_categorize_locked IS NULL OR t.auto_categorize_locked = 0)
        ");
        $updateStmt->execute($params);
        $totalAffected += $updateStmt->rowCount();
    }

    Response::success(['applied_count' => $totalAffected]);
} catch (Exception $e) {
    Response::error('Failed to apply rules: ' . $e->getMessage(), 500);
}
