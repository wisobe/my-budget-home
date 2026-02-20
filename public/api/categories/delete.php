<?php
/**
 * Category Delete Endpoint (per-user)
 * POST /api/categories/delete.php
 * Body: { "id": "..." }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['id']);
    
    $pdo = Database::getConnection();
    
    // Verify category belongs to user
    $checkStmt = $pdo->prepare('SELECT id FROM categories WHERE id = :id AND user_id = :uid');
    $checkStmt->execute(['id' => $body['id'], 'uid' => $userId]);
    if (!$checkStmt->fetch()) {
        Response::notFound('Category not found');
    }
    
    // Find user's "Other" category to reassign transactions
    $otherStmt = $pdo->prepare("SELECT id FROM categories WHERE user_id = :uid AND name = 'Other' AND parent_id IS NULL LIMIT 1");
    $otherStmt->execute(['uid' => $userId]);
    $otherCat = $otherStmt->fetch();
    $defaultCatId = $otherCat ? $otherCat['id'] : null;
    
    // Move transactions to user's "Other" category (or NULL)
    $pdo->prepare('UPDATE transactions SET category_id = :default_cat WHERE category_id = :id')
        ->execute(['default_cat' => $defaultCatId, 'id' => $body['id']]);
    
    // Also update any splits referencing this category
    $pdo->prepare('UPDATE transaction_splits SET category_id = :default_cat WHERE category_id = :id')
        ->execute(['default_cat' => $defaultCatId, 'id' => $body['id']]);
    
    // Move child categories to top-level
    $pdo->prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = :id')
        ->execute(['id' => $body['id']]);
    
    // Delete category
    $stmt = $pdo->prepare('DELETE FROM categories WHERE id = :id AND user_id = :uid');
    $stmt->execute(['id' => $body['id'], 'uid' => $userId]);
    
    if ($stmt->rowCount() === 0) {
        Response::notFound('Category not found');
    }
    
    Response::success(null, 'Category deleted');
} catch (Exception $e) {
    Response::error('Failed to delete category: ' . $e->getMessage(), 500);
}
