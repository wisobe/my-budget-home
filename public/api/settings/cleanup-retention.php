<?php
/**
 * Data Retention Cleanup Endpoint
 * POST /api/settings/cleanup-retention.php
 * 
 * Purges data that has exceeded its retention period as defined in the Data Retention Policy:
 * - Audit log entries older than 3 years
 * - Consent audit log entries older than 3 years
 * - Expired authentication tokens
 * 
 * Restricted to administrators only.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/AuditLog.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();

    // Verify the user is an admin
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = :id");
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    if (!$user || $user['role'] !== 'admin') {
        Response::error('Admin access required', 403);
    }

    $results = [];

    // 1. Purge audit log entries older than 3 years
    $stmt = $pdo->prepare("DELETE FROM audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 YEAR)");
    $stmt->execute();
    $results['audit_log_purged'] = $stmt->rowCount();

    // 2. Purge consent audit log entries older than 3 years
    $stmt = $pdo->prepare("DELETE FROM consent_audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 YEAR)");
    $stmt->execute();
    $results['consent_audit_log_purged'] = $stmt->rowCount();

    // 3. Purge expired authentication tokens
    $stmt = $pdo->prepare("DELETE FROM auth_tokens WHERE expires_at < NOW()");
    $stmt->execute();
    $results['expired_tokens_purged'] = $stmt->rowCount();

    // Log the cleanup action
    AuditLog::log('retention_cleanup', $userId, null, json_encode($results));

    Response::success([
        'purged' => $results,
        'message' => 'Retention cleanup completed successfully',
    ]);
} catch (Exception $e) {
    Response::error('Cleanup failed: ' . $e->getMessage(), 500);
}
