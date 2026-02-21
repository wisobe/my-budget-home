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

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.user_id = :user_id
            ORDER BY r.priority DESC, r.keyword ASC
        ');
        $stmt->execute(['user_id' => $userId]);
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['category_id', 'keyword']);

        $id = 'rule_' . uniqid();
        $stmt = $pdo->prepare('
            INSERT INTO category_rules (id, user_id, category_id, keyword, match_type, priority, auto_learned, created_at)
            VALUES (:id, :user_id, :category_id, :keyword, :match_type, :priority, :auto_learned, NOW())
            ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), priority = VALUES(priority)
        ');
        $stmt->execute([
            'id' => $id,
            'user_id' => $userId,
            'category_id' => $body['category_id'],
            'keyword' => strtoupper(trim($body['keyword'])),
            'match_type' => $body['match_type'] ?? 'contains',
            'priority' => $body['priority'] ?? 0,
            'auto_learned' => ($body['auto_learned'] ?? false) ? 1 : 0,
        ]);

        $fetchStmt = $pdo->prepare('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.id = :id
        ');
        $fetchStmt->execute(['id' => $id]);
        Response::success($fetchStmt->fetch());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        // Verify ownership
        $checkStmt = $pdo->prepare('SELECT id FROM category_rules WHERE id = :id AND user_id = :user_id');
        $checkStmt->execute(['id' => $body['id'], 'user_id' => $userId]);
        if (!$checkStmt->fetch()) {
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

        $fetchStmt = $pdo->prepare('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.id = :id
        ');
        $fetchStmt->execute(['id' => $body['id']]);
        Response::success($fetchStmt->fetch());

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
