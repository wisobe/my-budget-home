<?php
/**
 * Category Rules CRUD Endpoint
 * GET    /api/categories/rules.php - List rules for current user
 * POST   /api/categories/rules.php - Create a rule
 * DELETE /api/categories/rules.php - Delete a rule
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $environment = getPlaidEnvironment();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.user_id = :user_id AND r.plaid_environment = :env
            ORDER BY r.priority DESC, r.keyword ASC
        ');
        $stmt->execute(['user_id' => $userId, 'env' => $environment]);
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['category_id', 'keyword']);

        $id = 'rule_' . uniqid();
        $keyword = strtoupper(trim($body['keyword']));
        $matchType = $body['match_type'] ?? 'contains';
        $categoryId = $body['category_id'];
        $applyToExisting = !empty($body['apply_to_existing']);

        $stmt = $pdo->prepare('
            INSERT INTO category_rules (id, user_id, category_id, keyword, match_type, priority, auto_learned, plaid_environment, created_at)
            VALUES (:id, :user_id, :category_id, :keyword, :match_type, :priority, :auto_learned, :env, NOW())
            ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), priority = VALUES(priority)
        ');
        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
            'category_id' => $categoryId,
            'keyword' => $keyword,
            'match_type' => $matchType,
            'priority' => $body['priority'] ?? 0,
            'auto_learned' => ($body['auto_learned'] ?? false) ? 1 : 0,
            'env' => $environment,
        ]);

        $affected = 0;
        if ($applyToExisting) {
            $affected = applyRuleToExistingTransactions($pdo, $userId, $keyword, $matchType, $categoryId, $environment);
        }

        $fetchStmt = $pdo->prepare('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.id = :id
        ');
        $fetchStmt->execute(['id' => $id]);
        $rule = $fetchStmt->fetch();
        $rule['applied_count'] = $affected;
        Response::success($rule);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        // Verify ownership
        $checkStmt = $pdo->prepare('SELECT id, keyword, match_type, category_id FROM category_rules WHERE id = :id AND user_id = :user_id');
        $checkStmt->execute(['id' => $body['id'], 'user_id' => $userId]);
        $existingRule = $checkStmt->fetch();
        if (!$existingRule) {
            Response::notFound('Rule not found');
        }

        $sets = [];
        $params = ['id' => $body['id']];
        if (isset($body['keyword'])) { $sets[] = 'keyword = :keyword'; $params['keyword'] = strtoupper(trim($body['keyword'])); }
        if (isset($body['category_id'])) { $sets[] = 'category_id = :category_id'; $params['category_id'] = $body['category_id']; }
        if (isset($body['match_type'])) { $sets[] = 'match_type = :match_type'; $params['match_type'] = $body['match_type']; }
        if (isset($body['priority'])) { $sets[] = 'priority = :priority'; $params['priority'] = (int)$body['priority']; }

        if (empty($sets)) {
            Response::error('Nothing to update');
        }

        $pdo->prepare('UPDATE category_rules SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);

        $applyToExisting = !empty($body['apply_to_existing']);
        $affected = 0;
        if ($applyToExisting) {
            $keyword = isset($body['keyword']) ? strtoupper(trim($body['keyword'])) : $existingRule['keyword'];
            $matchType = $body['match_type'] ?? $existingRule['match_type'];
            $categoryId = $body['category_id'] ?? $existingRule['category_id'];
            $affected = applyRuleToExistingTransactions($pdo, $userId, $keyword, $matchType, $categoryId, $environment);
        }

        $fetchStmt = $pdo->prepare('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.id = :id
        ');
        $fetchStmt->execute(['id' => $body['id']]);
        $rule = $fetchStmt->fetch();
        $rule['applied_count'] = $affected;
        Response::success($rule);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        // Only delete own rules
        $stmt = $pdo->prepare('DELETE FROM category_rules WHERE id = :id AND user_id = :user_id');
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
 * Apply a rule to all existing matching transactions for a user in the given environment.
 * Returns the number of transactions updated.
 */
function applyRuleToExistingTransactions(PDO $pdo, string $userId, string $keyword, string $matchType, string $categoryId, string $environment = 'sandbox'): int {
    $keywords = array_filter(array_map('trim', explode('|', $keyword)));
    if (empty($keywords)) return 0;

    $conditions = [];
    $params = [
        'category_id' => $categoryId,
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
        SET t.category_id = :category_id
        WHERE a.user_id = :user_id
          AND pc.plaid_environment = :env
          AND {$combinedCondition}
    ");
    $stmt->execute($params);
    return $stmt->rowCount();
}
