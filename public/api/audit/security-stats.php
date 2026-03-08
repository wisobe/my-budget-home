<?php
/**
 * Security Monitoring Stats Endpoint (Admin only)
 * GET /api/audit/security-stats.php
 * Returns: failed login counts (last 24h, 7d, 30d), unique IPs with failures,
 *          accounts with repeated failures, and recent suspicious activity.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    requireAdmin();
    $pdo = Database::getConnection();

    // Failed logins in last 24h, 7d, 30d
    $periods = [
        'last_24h' => '24 HOUR',
        'last_7d'  => '7 DAY',
        'last_30d' => '30 DAY',
    ];

    $failedLogins = [];
    foreach ($periods as $key => $interval) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE event_type = 'login_failed' AND created_at >= DATE_SUB(NOW(), INTERVAL $interval)");
        $stmt->execute();
        $failedLogins[$key] = (int)$stmt->fetchColumn();
    }

    // Successful logins for comparison
    $successfulLogins = [];
    foreach ($periods as $key => $interval) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE event_type = 'login_success' AND created_at >= DATE_SUB(NOW(), INTERVAL $interval)");
        $stmt->execute();
        $successfulLogins[$key] = (int)$stmt->fetchColumn();
    }

    // Unique IPs with failed logins in last 7 days
    $stmt = $pdo->prepare("
        SELECT ip_address, COUNT(*) as failure_count 
        FROM audit_log 
        WHERE event_type = 'login_failed' 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY failure_count DESC
        LIMIT 10
    ");
    $stmt->execute();
    $suspiciousIps = $stmt->fetchAll();

    // Accounts targeted by failed logins in last 7 days
    $stmt = $pdo->prepare("
        SELECT details, COUNT(*) as failure_count
        FROM audit_log
        WHERE event_type = 'login_failed'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND details IS NOT NULL
        GROUP BY details
        ORDER BY failure_count DESC
        LIMIT 10
    ");
    $stmt->execute();
    $targetedAccounts = [];
    foreach ($stmt->fetchAll() as $row) {
        $d = json_decode($row['details'], true);
        if ($d && isset($d['email'])) {
            $targetedAccounts[] = [
                'email' => $d['email'],
                'failure_count' => (int)$row['failure_count'],
            ];
        }
    }

    // Security events summary (2FA changes, password changes) in last 30 days
    $stmt = $pdo->prepare("
        SELECT event_type, COUNT(*) as count
        FROM audit_log
        WHERE event_type IN ('2fa_enabled', '2fa_disabled', 'password_changed', 'user_created', 'user_deleted')
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY event_type
    ");
    $stmt->execute();
    $securityEvents = [];
    foreach ($stmt->fetchAll() as $row) {
        $securityEvents[$row['event_type']] = (int)$row['count'];
    }

    // Determine overall status
    $status = 'healthy'; // green
    $alerts = [];

    if ($failedLogins['last_24h'] >= 10) {
        $status = 'warning';
        $alerts[] = 'High number of failed login attempts in the last 24 hours (' . $failedLogins['last_24h'] . ')';
    }
    if ($failedLogins['last_24h'] >= 25) {
        $status = 'critical';
    }

    foreach ($suspiciousIps as $ip) {
        if ((int)$ip['failure_count'] >= 5) {
            if ($status === 'healthy') $status = 'warning';
            $alerts[] = 'IP ' . $ip['ip_address'] . ' has ' . $ip['failure_count'] . ' failed attempts in 7 days';
        }
    }

    foreach ($targetedAccounts as $acct) {
        if ($acct['failure_count'] >= 5) {
            if ($status === 'healthy') $status = 'warning';
            $alerts[] = 'Account ' . $acct['email'] . ' targeted with ' . $acct['failure_count'] . ' failed attempts in 7 days';
        }
    }

    if (!empty($securityEvents['2fa_disabled']) && $securityEvents['2fa_disabled'] > 0) {
        $alerts[] = $securityEvents['2fa_disabled'] . ' user(s) disabled 2FA in the last 30 days';
    }

    Response::success([
        'status' => $status,
        'alerts' => $alerts,
        'failed_logins' => $failedLogins,
        'successful_logins' => $successfulLogins,
        'suspicious_ips' => $suspiciousIps,
        'targeted_accounts' => $targetedAccounts,
        'security_events' => $securityEvents,
    ]);

} catch (Exception $e) {
    Response::error('Failed to fetch security stats: ' . $e->getMessage(), 500);
}
