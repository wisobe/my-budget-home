<?php
/**
 * Audit Log Helper
 * Logs security-relevant events for compliance and access reviews.
 */

class AuditLog {
    /**
     * Log an audit event.
     *
     * @param string      $eventType   e.g. 'login_success', 'login_failed', 'user_created', 'role_changed', '2fa_enabled'
     * @param string|null $userId      The user performing or affected by the action
     * @param string|null $targetUserId The user being acted upon (for admin actions)
     * @param string|null $details     JSON or free-text details
     */
    public static function log(string $eventType, ?string $userId = null, ?string $targetUserId = null, ?string $details = null): void {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare('
                INSERT INTO audit_log (event_type, user_id, target_user_id, ip_address, user_agent, details, created_at)
                VALUES (:event_type, :user_id, :target_user_id, :ip_address, :user_agent, :details, NOW())
            ');
            $stmt->execute([
                'event_type' => $eventType,
                'user_id' => $userId,
                'target_user_id' => $targetUserId,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
                'details' => $details,
            ]);
        } catch (Exception $e) {
            // Silently fail — audit logging should never break the main flow
            error_log('AuditLog error: ' . $e->getMessage());
        }
    }
}
