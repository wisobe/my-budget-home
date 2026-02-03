<?php
/**
 * Category Delete Endpoint
 * DELETE /api/categories/delete.php
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['id']);
    
    $pdo = Database::getConnection();
    
    // Set transactions to uncategorized
    $pdo->prepare('UPDATE transactions SET category_id = NULL WHERE category_id = :id')
        ->execute(['id' => $body['id']]);
    
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
