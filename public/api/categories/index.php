<?php
/**
 * Categories List, Create & Update Endpoint (per-user)
 * GET  /api/categories/index.php - List current user's categories
 * POST /api/categories/index.php - Create category for current user
 * PUT  /api/categories/index.php - Update a category
 */

require_once __DIR__ . '/../includes/bootstrap.php';

/**
 * Seed default categories for a new user if they have none.
 */
function seedDefaultCategories(PDO $pdo, string $userId): void {
    $check = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE user_id = :uid');
    $check->execute(['uid' => $userId]);
    if ((int)$check->fetchColumn() > 0) return;

    $defaults = [
        ['Income',         '#10b981', true],
        ['Groceries',      '#f59e0b', false],
        ['Transportation', '#3b82f6', false],
        ['Utilities',      '#8b5cf6', false],
        ['Entertainment',  '#ec4899', false],
        ['Dining Out',     '#ef4444', false],
        ['Shopping',       '#14b8a6', false],
        ['Health',         '#f97316', false],
        ['Housing',        '#6366f1', false],
        ['Other',          '#6b7280', false],
    ];

    $stmt = $pdo->prepare('
        INSERT INTO categories (id, user_id, name, color, is_income, created_at)
        VALUES (:id, :uid, :name, :color, :is_income, NOW())
    ');
    foreach ($defaults as $d) {
        $stmt->execute([
            'id'        => 'cat_' . uniqid(),
            'uid'       => $userId,
            'name'      => $d[0],
            'color'     => $d[1],
            'is_income' => $d[2] ? 1 : 0,
        ]);
    }
}

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Seed defaults on first access
        seedDefaultCategories($pdo, $userId);

        $stmt = $pdo->prepare('SELECT * FROM categories WHERE user_id = :uid ORDER BY is_income DESC, name');
        $stmt->execute(['uid' => $userId]);
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['name', 'color']);

        // Validate parent_id if provided
        $parentId = $body['parent_id'] ?? null;
        if ($parentId) {
            $parentStmt = $pdo->prepare('SELECT id, parent_id FROM categories WHERE id = :id AND user_id = :uid');
            $parentStmt->execute(['id' => $parentId, 'uid' => $userId]);
            $parent = $parentStmt->fetch();
            if (!$parent) {
                Response::error('Parent category not found');
            }
            if ($parent['parent_id']) {
                Response::error('Cannot nest more than one level deep');
            }
        }

        $id = 'cat_' . uniqid();
        $stmt = $pdo->prepare('
            INSERT INTO categories (id, user_id, name, color, icon, parent_id, is_income, created_at)
            VALUES (:id, :uid, :name, :color, :icon, :parent_id, :is_income, NOW())
        ');
        $stmt->execute([
            'id'        => $id,
            'uid'       => $userId,
            'name'      => $body['name'],
            'color'     => $body['color'],
            'icon'      => $body['icon'] ?? null,
            'parent_id' => $parentId,
            'is_income' => ($body['is_income'] ?? false) ? 1 : 0,
        ]);

        $fetchStmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
        $fetchStmt->execute(['id' => $id]);
        Response::success($fetchStmt->fetch());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $body = getJsonBody();
        if (empty($body['id'])) {
            Response::error('Category ID is required');
        }

        // Check category exists and belongs to user
        $checkStmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id AND user_id = :uid');
        $checkStmt->execute(['id' => $body['id'], 'uid' => $userId]);
        $existing = $checkStmt->fetch();
        if (!$existing) {
            Response::error('Category not found', 404);
        }

        // Validate parent_id if provided
        $parentId = array_key_exists('parent_id', $body) ? $body['parent_id'] : $existing['parent_id'];
        if ($parentId) {
            if ($parentId === $body['id']) {
                Response::error('Category cannot be its own parent');
            }
            $parentStmt = $pdo->prepare('SELECT id, parent_id FROM categories WHERE id = :id AND user_id = :uid');
            $parentStmt->execute(['id' => $parentId, 'uid' => $userId]);
            $parent = $parentStmt->fetch();
            if (!$parent) {
                Response::error('Parent category not found');
            }
            if ($parent['parent_id']) {
                Response::error('Cannot nest more than one level deep');
            }
            $childStmt = $pdo->prepare('SELECT COUNT(*) as cnt FROM categories WHERE parent_id = :id');
            $childStmt->execute(['id' => $body['id']]);
            if ($childStmt->fetch()['cnt'] > 0) {
                Response::error('Cannot set parent on a category that has subcategories');
            }
        }

        $fields = [];
        $params = ['id' => $body['id']];

        if (isset($body['name']))   { $fields[] = 'name = :name';     $params['name']   = $body['name']; }
        if (isset($body['color']))  { $fields[] = 'color = :color';   $params['color']  = $body['color']; }
        if (isset($body['icon']))   { $fields[] = 'icon = :icon';     $params['icon']   = $body['icon']; }
        if (array_key_exists('parent_id', $body)) { $fields[] = 'parent_id = :parent_id'; $params['parent_id'] = $body['parent_id'] ?: null; }
        if (isset($body['is_income'])) { $fields[] = 'is_income = :is_income'; $params['is_income'] = $body['is_income'] ? 1 : 0; }

        if (empty($fields)) {
            Response::error('No fields to update');
        }

        $sql = 'UPDATE categories SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);

        $fetchStmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
        $fetchStmt->execute(['id' => $body['id']]);
        Response::success($fetchStmt->fetch());

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
