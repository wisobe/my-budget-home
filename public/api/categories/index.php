<?php
/**
 * Categories List & Create Endpoint
 * GET /api/categories/index.php - List categories
 * POST /api/categories/index.php - Create category
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (useMockData()) {
            $mockCategories = [
                ['id' => '1', 'name' => 'Income', 'color' => '#10b981', 'is_income' => true, 'created_at' => date('c')],
                ['id' => '2', 'name' => 'Groceries', 'color' => '#f59e0b', 'is_income' => false, 'created_at' => date('c')],
                ['id' => '3', 'name' => 'Transportation', 'color' => '#3b82f6', 'is_income' => false, 'created_at' => date('c')],
                ['id' => '4', 'name' => 'Utilities', 'color' => '#8b5cf6', 'is_income' => false, 'created_at' => date('c')],
                ['id' => '5', 'name' => 'Entertainment', 'color' => '#ec4899', 'is_income' => false, 'created_at' => date('c')],
                ['id' => '6', 'name' => 'Dining Out', 'color' => '#ef4444', 'is_income' => false, 'created_at' => date('c')],
                ['id' => '7', 'name' => 'Shopping', 'color' => '#14b8a6', 'is_income' => false, 'created_at' => date('c')],
                ['id' => '8', 'name' => 'Health', 'color' => '#f97316', 'is_income' => false, 'created_at' => date('c')],
            ];
            Response::success($mockCategories);
        }
        
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
