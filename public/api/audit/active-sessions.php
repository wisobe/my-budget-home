<?php
/**
 * Active Sessions Endpoint (Admin only)
 * GET /api/audit/active-sessions.php
 * Returns: list of users with active (non-expired, non-2FA-pending) sessions
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    requireAdmin();
    $pdo = Database::getConnection();

    $stmt = $pdo->prepare("
        SELECT 
            u.id AS user_id,
            u.name,
            u.email,
            u.role,
            at.created_at AS session_started,
            at.expires_at,
            (SELECT a2.ip_address FROM audit_log a2 
             WHERE a2.user_id = u.id AND a2.event_type = 'login_success' 
             ORDER BY a2.created_at DESC LIMIT 1) AS last_ip,
            (SELECT a3.created_at FROM audit_log a3 
             WHERE a3.user_id = u.id AND a3.event_type = 'login_success' 
             ORDER BY a3.created_at DESC LIMIT 1) AS last_login
        FROM auth_tokens at
        INNER JOIN users u ON at.user_id = u.id
        WHERE at.expires_at > NOW()
          AND (at.is_2fa_pending = 0 OR at.is_2fa_pending IS NULL)
        GROUP BY u.id
        ORDER BY last_login DESC
    ");
    $stmt->execute();
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    Response::success($sessions);

} catch (Exception $e) {
    Response::error('Failed to fetch active sessions: ' . $e->getMessage(), 500);
}