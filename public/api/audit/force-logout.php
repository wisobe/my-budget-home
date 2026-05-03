<?php
/**
 * Force Logout Endpoint (Admin only)
 * POST /api/audit/force-logout.php  { user_id: string }
 * Revokes all active auth tokens for a given user.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $admin = requireAdmin();
    $body = getJsonBody();
    validateRequired($body, ['user_id']);

    $targetUserId = $body['user_id'];
    $pdo = Database::getConnection();

    // Verify the target user exists
    $userStmt = $pdo->prepare('SELECT id, email FROM users WHERE id = :id');
    $userStmt->execute(['id' => $targetUserId]);
    $targetUser = $userStmt->fetch();
    if (!$targetUser) {
        Response::error('User not found', 404);
    }

    // Delete all auth tokens for this user (active + pending 2fa)
    $stmt = $pdo->prepare('DELETE FROM auth_tokens WHERE user_id = :user_id');
    $stmt->execute(['user_id' => $targetUserId]);
    $revoked = $stmt->rowCount();

    AuditLog::log(
        'force_logout',
        $admin['id'],
        $targetUserId,
        json_encode(['email' => $targetUser['email'], 'revoked_tokens' => $revoked])
    );

    Response::success(['revoked' => $revoked]);
} catch (Exception $e) {
    Response::error('Failed to force logout: ' . $e->getMessage(), 500);
}
