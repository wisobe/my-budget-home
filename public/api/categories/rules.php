<?php
/**
 * Category Rules CRUD Endpoint
 * GET    /api/categories/rules.php - List all rules
 * POST   /api/categories/rules.php - Create a rule
 * DELETE /api/categories/rules.php - Delete a rule
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->query('
            SELECT r.*, c.name as category_name, c.color as category_color
            FROM category_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            ORDER BY r.priority DESC, r.keyword ASC
        ');
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['category_id', 'keyword']);

        $id = 'rule_' . uniqid();
        $stmt = $pdo->prepare('
            INSERT INTO category_rules (id, category_id, keyword, match_type, priority, auto_learned, created_at)
            VALUES (:id, :category_id, :keyword, :match_type, :priority, :auto_learned, NOW())
            ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), priority = VALUES(priority)
        ');
        $stmt->execute([
            'id' => $id,
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

    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        $stmt = $pdo->prepare('DELETE FROM category_rules WHERE id = :id');
        $stmt->execute(['id' => $body['id']]);

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
