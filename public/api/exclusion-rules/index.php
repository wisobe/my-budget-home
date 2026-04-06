<?php
/**
 * Exclusion Rules CRUD Endpoint
 * GET    /api/exclusion-rules/ - List rules for current user
 * POST   /api/exclusion-rules/ - Create a rule
 * PUT    /api/exclusion-rules/ - Update a rule
 * DELETE /api/exclusion-rules/ - Delete a rule
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $environment = getPlaidEnvironment();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('
            SELECT * FROM exclusion_rules
            WHERE user_id = :user_id AND plaid_environment = :env
            ORDER BY priority DESC, keyword ASC
        ');
        $stmt->execute(['user_id' => $userId, 'env' => $environment]);
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['keyword']);

        $id = 'exrule_' . uniqid();
        $keyword = strtoupper(trim($body['keyword']));
        $matchType = $body['match_type'] ?? 'contains';
        $applyToExisting = !empty($body['apply_to_existing']);

        $stmt = $pdo->prepare('
            INSERT INTO exclusion_rules (id, user_id, keyword, match_type, priority, plaid_environment, created_at)
            VALUES (:id, :user_id, :keyword, :match_type, :priority, :env, NOW())
        ');
        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
            'keyword' => $keyword,
            'match_type' => $matchType,
            'priority' => $body['priority'] ?? 0,
            'env' => $environment,
        ]);

        $affected = 0;
        if ($applyToExisting) {
            $affected = applyExclusionRuleToTransactions($pdo, $userId, $keyword, $matchType, $environment);
        }

        $fetchStmt = $pdo->prepare('SELECT * FROM exclusion_rules WHERE id = :id');
        $fetchStmt->execute(['id' => $id]);
        $rule = $fetchStmt->fetch();
        $rule['applied_count'] = $affected;
        Response::success($rule);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        $checkStmt = $pdo->prepare('SELECT id, keyword, match_type FROM exclusion_rules WHERE id = :id AND user_id = :user_id');
        $checkStmt->execute(['id' => $body['id'], 'user_id' => $userId]);
        $existingRule = $checkStmt->fetch();
        if (!$existingRule) {
            Response::notFound('Rule not found');
        }

        $sets = [];
        $params = ['id' => $body['id']];
        if (isset($body['keyword'])) { $sets[] = 'keyword = :keyword'; $params['keyword'] = strtoupper(trim($body['keyword'])); }
        if (isset($body['match_type'])) { $sets[] = 'match_type = :match_type'; $params['match_type'] = $body['match_type']; }
        if (isset($body['priority'])) { $sets[] = 'priority = :priority'; $params['priority'] = (int)$body['priority']; }

        if (empty($sets)) {
            Response::error('Nothing to update');
        }

        $pdo->prepare('UPDATE exclusion_rules SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);

        $applyToExisting = !empty($body['apply_to_existing']);
        $affected = 0;
        if ($applyToExisting) {
            $keyword = isset($body['keyword']) ? strtoupper(trim($body['keyword'])) : $existingRule['keyword'];
            $matchType = $body['match_type'] ?? $existingRule['match_type'];
            $affected = applyExclusionRuleToTransactions($pdo, $userId, $keyword, $matchType, $environment);
        }

        $fetchStmt = $pdo->prepare('SELECT * FROM exclusion_rules WHERE id = :id');
        $fetchStmt->execute(['id' => $body['id']]);
        $rule = $fetchStmt->fetch();
        $rule['applied_count'] = $affected;
        Response::success($rule);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        $stmt = $pdo->prepare('DELETE FROM exclusion_rules WHERE id = :id AND user_id = :user_id');
        $stmt->execute(['id' => $body['id'], 'user_id' => $userId]);

        if ($stmt->rowCount() === 0) {
            Response::notFound('Rule not found');
        }
        Response::success(null, 'Rule deleted');

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}

/**
 * Apply an exclusion rule to existing matching transactions.
 * Returns the number of transactions updated.
 */
function applyExclusionRuleToTransactions(PDO $pdo, string $userId, string $keyword, string $matchType, string $environment = 'sandbox'): int {
    $keywords = array_filter(array_map('trim', explode('|', $keyword)));
    if (empty($keywords)) return 0;

    $conditions = [];
    $params = [
        'user_id' => $userId,
        'env' => $environment,
    ];

    foreach ($keywords as $i => $kw) {
        $kwParam = "kw_{$i}";
        $kwParam2 = "kw2_{$i}";
        switch ($matchType) {
            case 'exact':
                $conditions[] = "(UPPER(t.name) = :{$kwParam} OR UPPER(t.merchant_name) = :{$kwParam2})";
                $params[$kwParam] = $kw;
                $params[$kwParam2] = $kw;
                break;
            case 'starts_with':
                $conditions[] = "(UPPER(t.name) LIKE :{$kwParam} OR UPPER(t.merchant_name) LIKE :{$kwParam2})";
                $params[$kwParam] = $kw . '%';
                $params[$kwParam2] = $kw . '%';
                break;
            case 'contains':
            default:
                $conditions[] = "(UPPER(t.name) LIKE :{$kwParam} OR UPPER(t.merchant_name) LIKE :{$kwParam2})";
                $params[$kwParam] = '%' . $kw . '%';
                $params[$kwParam2] = '%' . $kw . '%';
                break;
        }
    }

    $combinedCondition = '(' . implode(' OR ', $conditions) . ')';

    $stmt = $pdo->prepare("
        UPDATE transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        INNER JOIN plaid_connections pc ON a.plaid_connection_id = pc.id
        SET t.excluded = 1
        WHERE a.user_id = :user_id
          AND pc.plaid_environment = :env
          AND {$combinedCondition}
          AND t.excluded = 0
    ");
    $stmt->execute($params);
    return $stmt->rowCount();
}
