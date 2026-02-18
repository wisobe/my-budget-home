<?php
/**
 * Change Password Endpoint
 * POST /api/auth/change-password.php
 * Body: { "current_password": "...", "new_password": "..." }
 * Requires valid auth token
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['current_password', 'new_password']);
    
    if (strlen($body['new_password']) < 6) {
        Response::error('New password must be at least 6 characters');
    }
    
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = :id");
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($body['current_password'], $user['password_hash'])) {
        Response::error('Current password is incorrect', 401);
    }
    
    $newHash = password_hash($body['new_password'], PASSWORD_BCRYPT);
    $pdo->prepare("UPDATE users SET password_hash = :hash WHERE id = :id")
        ->execute(['hash' => $newHash, 'id' => $userId]);
    
    Response::success(null, 'Password changed successfully');
} catch (Exception $e) {
    Response::error('Failed to change password: ' . $e->getMessage(), 500);
}
