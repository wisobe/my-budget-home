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

// Manually verify auth (this endpoint is under /auth/ but requires authentication)
requireAuthToken();

try {
    $body = getJsonBody();
    validateRequired($body, ['current_password', 'new_password']);
    
    if (strlen($body['new_password']) < 6) {
        Response::error('New password must be at least 6 characters');
    }
    
    $pdo = Database::getConnection();
    
    $stmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'password_hash'");
    $stmt->execute();
    $row = $stmt->fetch();
    
    if (!$row || !password_verify($body['current_password'], $row['setting_value'])) {
        Response::error('Current password is incorrect', 401);
    }
    
    $newHash = password_hash($body['new_password'], PASSWORD_BCRYPT);
    $pdo->prepare("UPDATE app_settings SET setting_value = :hash WHERE setting_key = 'password_hash'")
        ->execute(['hash' => $newHash]);
    
    Response::success(null, 'Password changed successfully');
} catch (Exception $e) {
    Response::error('Failed to change password: ' . $e->getMessage(), 500);
}
