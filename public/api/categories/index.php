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
        
        $stmt = $pdo->prepare('
            INSERT INTO categories (id, name, color, icon, is_income, created_at)
            VALUES (:id, :name, :color, :icon, :is_income, NOW())
        ');
        
        $id = 'cat_' . uniqid();
        $stmt->execute([
            'id' => $id,
            'name' => $body['name'],
            'color' => $body['color'],
            'icon' => $body['icon'] ?? null,
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
