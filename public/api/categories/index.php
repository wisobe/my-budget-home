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
    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
