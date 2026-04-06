<?php
/**
 * Preview Apply All Exclusion Rules
 * POST /api/exclusion-rules/preview-apply-all.php
 * Returns transactions that would be excluded by applying all exclusion rules.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $environment = getPlaidEnvironment();

    // Fetch all exclusion rules
    $stmt = $pdo->prepare('
        SELECT keyword, match_type, priority
        FROM exclusion_rules
        WHERE user_id = :user_id AND plaid_environment = :env
        ORDER BY priority DESC
    ');
    $stmt->execute(['user_id' => $userId, 'env' => $environment]);
    $rules = $stmt->fetchAll();

    if (empty($rules)) {
        Response::success(['transactions' => [], 'total_count' => 0]);
    }

    // Build combined condition from all rules
    $allConditions = [];
    $params = [
        'user_id' => $userId,
        'env' => $environment,
    ];
    $paramIdx = 0;

    foreach ($rules as $rule) {
        $keywords = array_filter(array_map('trim', explode('|', $rule['keyword'])));
        foreach ($keywords as $kw) {
            $kwParam = "kw_{$paramIdx}";
            $kwParam2 = "kw2_{$paramIdx}";
            switch ($rule['match_type']) {
                case 'exact':
                    $allConditions[] = "(UPPER(t.name) = :{$kwParam} OR UPPER(t.merchant_name) = :{$kwParam2})";
                    $params[$kwParam] = strtoupper($kw);
                    $params[$kwParam2] = strtoupper($kw);
                    break;
                case 'starts_with':
                    $allConditions[] = "(UPPER(t.name) LIKE :{$kwParam} OR UPPER(t.merchant_name) LIKE :{$kwParam2})";
                    $params[$kwParam] = strtoupper($kw) . '%';
                    $params[$kwParam2] = strtoupper($kw) . '%';
                    break;
                case 'contains':
                default:
                    $allConditions[] = "(UPPER(t.name) LIKE :{$kwParam} OR UPPER(t.merchant_name) LIKE :{$kwParam2})";
                    $params[$kwParam] = '%' . strtoupper($kw) . '%';
                    $params[$kwParam2] = '%' . strtoupper($kw) . '%';
                    break;
            }
            $paramIdx++;
        }
    }

    if (empty($allConditions)) {
        Response::success(['transactions' => [], 'total_count' => 0]);
    }

    $combinedCondition = '(' . implode(' OR ', $allConditions) . ')';

    $stmt = $pdo->prepare("
        SELECT t.id, t.name, t.merchant_name, t.amount, t.date
        FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        INNER JOIN plaid_connections pc ON a.plaid_connection_id = pc.id
        WHERE a.user_id = :user_id
          AND pc.plaid_environment = :env
          AND {$combinedCondition}
          AND t.excluded = 0
        ORDER BY t.date DESC
        LIMIT 500
    ");
    $stmt->execute($params);
    $transactions = $stmt->fetchAll();

    Response::success([
        'transactions' => $transactions,
        'total_count' => count($transactions),
    ]);
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
