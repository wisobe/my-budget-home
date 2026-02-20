<?php
/**
 * Categories List & Create Endpoint
 * GET /api/categories/index.php - List categories
 * POST /api/categories/index.php - Create category
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        
        $pdo = Database::getConnection();
        $stmt = $pdo->query('SELECT * FROM categories ORDER BY is_income DESC, name');
        Response::success($stmt->fetchAll());
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['name', 'color']);
        
        $pdo = Database::getConnection();
        
        // Validate parent_id if provided
        $parentId = $body['parent_id'] ?? null;
        if ($parentId) {
            // Ensure parent exists and is not itself a child
            $parentStmt = $pdo->prepare('SELECT id, parent_id FROM categories WHERE id = :id');
            $parentStmt->execute(['id' => $parentId]);
            $parent = $parentStmt->fetch();
            if (!$parent) {
                Response::error('Parent category not found');
            }
            if ($parent['parent_id']) {
                Response::error('Cannot nest more than one level deep');
            }
        }
        
        $stmt = $pdo->prepare('
            INSERT INTO categories (id, name, color, icon, parent_id, is_income, created_at)
            VALUES (:id, :name, :color, :icon, :parent_id, :is_income, NOW())
        ');
        
        $id = 'cat_' . uniqid();
        $stmt->execute([
            'id' => $id,
            'name' => $body['name'],
            'color' => $body['color'],
            'icon' => $body['icon'] ?? null,
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
        
        $pdo = Database::getConnection();
        
        // Check category exists
        $checkStmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
        $checkStmt->execute(['id' => $body['id']]);
        $existing = $checkStmt->fetch();
        if (!$existing) {
            Response::error('Category not found', 404);
        }
        
        // Validate parent_id if provided
        $parentId = array_key_exists('parent_id', $body) ? $body['parent_id'] : $existing['parent_id'];
        if ($parentId) {
            // Can't be your own parent
            if ($parentId === $body['id']) {
                Response::error('Category cannot be its own parent');
            }
            // Ensure parent exists and is not itself a child
            $parentStmt = $pdo->prepare('SELECT id, parent_id FROM categories WHERE id = :id');
            $parentStmt->execute(['id' => $parentId]);
            $parent = $parentStmt->fetch();
            if (!$parent) {
                Response::error('Parent category not found');
            }
            if ($parent['parent_id']) {
                Response::error('Cannot nest more than one level deep');
            }
            // Can't set parent if this category has children
            $childStmt = $pdo->prepare('SELECT COUNT(*) as cnt FROM categories WHERE parent_id = :id');
            $childStmt->execute(['id' => $body['id']]);
            if ($childStmt->fetch()['cnt'] > 0) {
                Response::error('Cannot set parent on a category that has subcategories');
            }
        }
        
        $fields = [];
        $params = ['id' => $body['id']];
        
        if (isset($body['name'])) { $fields[] = 'name = :name'; $params['name'] = $body['name']; }
        if (isset($body['color'])) { $fields[] = 'color = :color'; $params['color'] = $body['color']; }
        if (isset($body['icon'])) { $fields[] = 'icon = :icon'; $params['icon'] = $body['icon']; }
        if (array_key_exists('parent_id', $body)) { $fields[] = 'parent_id = :parent_id'; $params['parent_id'] = $body['parent_id'] ?: null; }
        if (isset($body['is_income'])) { $fields[] = 'is_income = :is_income'; $params['is_income'] = $body['is_income'] ? 1 : 0; }
        
        if (empty($fields)) {
            Response::error('No fields to update');
        }
        
        $sql = 'UPDATE categories SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        $fetchStmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
        $fetchStmt->execute(['id' => $body['id']]);
        Response::success($fetchStmt->fetch());
        
    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
