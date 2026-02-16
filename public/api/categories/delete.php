<?php
/**
 * Category Delete Endpoint
 * POST /api/categories/delete.php
 * Body: { "id": "..." }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['id']);
    
    $pdo = Database::getConnection();
    
    // Move transactions to "Other" category (cat_other) instead of NULL
    $pdo->prepare('UPDATE transactions SET category_id = :default_cat WHERE category_id = :id')
        ->execute(['default_cat' => 'cat_other', 'id' => $body['id']]);
    
    // Also update any splits referencing this category
    $pdo->prepare('UPDATE transaction_splits SET category_id = :default_cat WHERE category_id = :id')
        ->execute(['default_cat' => 'cat_other', 'id' => $body['id']]);
    
    // Delete category
    $stmt = $pdo->prepare('DELETE FROM categories WHERE id = :id');
    $stmt->execute(['id' => $body['id']]);
    
    if ($stmt->rowCount() === 0) {
        Response::notFound('Category not found');
    }
    
    Response::success(null, 'Category deleted');
} catch (Exception $e) {
    Response::error('Failed to delete category: ' . $e->getMessage(), 500);
}
