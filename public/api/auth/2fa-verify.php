<?php
/**
 * 2FA Verify Endpoint (during login)
 * POST /api/auth/2fa-verify.php
 * Body: { "temp_token": "...", "code": "..." }
 * Returns: { token, expires_at, user }
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/TOTP.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['temp_token', 'code']);
    $trustDevice = !empty($body['trust_device']);

    $pdo = Database::getConnection();
    $code = trim($body['code']);

    // Find the pending 2FA token
    $stmt = $pdo->prepare('
        SELECT at.user_id, at.token, u.totp_secret, u.recovery_codes, u.email, u.name, u.role, u.allow_sandbox
        FROM auth_tokens at
        INNER JOIN users u ON at.user_id = u.id
        WHERE at.token = :token AND at.expires_at > NOW() AND at.is_2fa_pending = 1
    ');
    $stmt->execute(['token' => $body['temp_token']]);
    $row = $stmt->fetch();

    if (!$row) {
        Response::error('Invalid or expired 2FA session. Please log in again.', 401);
    }

    // Verify TOTP code
    $valid = TOTP::verify($row['totp_secret'], $code);

    // Check recovery codes if TOTP fails
    if (!$valid && $row['recovery_codes']) {
        $recoveryCodes = json_decode($row['recovery_codes'], true) ?: [];
        $idx = array_search($code, $recoveryCodes, true);
        if ($idx !== false) {
            $valid = true;
            // Consume the recovery code
            unset($recoveryCodes[$idx]);
            $stmt2 = $pdo->prepare("UPDATE users SET recovery_codes = :codes WHERE id = :id");
            $stmt2->execute([
                'codes' => json_encode(array_values($recoveryCodes)),
                'id' => $row['user_id'],
            ]);
        }
    }

    if (!$valid) {
        AuditLog::log('login_failed', $row['user_id'], null, json_encode(['reason' => '2fa_invalid_code']));
        Response::error('Invalid verification code.', 401);
    }

    // Delete the temp token
    $pdo->prepare("DELETE FROM auth_tokens WHERE token = :token")->execute(['token' => $body['temp_token']]);

    // Issue a real session token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

    $pdo->exec("DELETE FROM auth_tokens WHERE expires_at < NOW()");

    $pdo->prepare("INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (:token, :user_id, :expires)")
        ->execute(['token' => $token, 'user_id' => $row['user_id'], 'expires' => $expiresAt]);

    AuditLog::log('login_success', $row['user_id'], null, json_encode(['method' => '2fa']));

    $responseData = [
        'token' => $token,
        'expires_at' => $expiresAt,
        'user' => [
            'id' => $row['user_id'],
            'email' => $row['email'],
            'name' => $row['name'],
            'role' => $row['role'],
            'allow_sandbox' => (bool)$row['allow_sandbox'],
        ],
    ];

    // Issue device trust token if requested
    if ($trustDevice) {
        $rawDeviceToken = bin2hex(random_bytes(32));
        $hashedDeviceToken = hash('sha256', $rawDeviceToken);
        $deviceExpires = date('Y-m-d H:i:s', strtotime('+30 days'));

        $pdo->exec("CREATE TABLE IF NOT EXISTS trusted_devices (
            token VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_user (user_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Clean expired
        $pdo->exec("DELETE FROM trusted_devices WHERE expires_at < NOW()");

        $pdo->prepare("INSERT INTO trusted_devices (token, user_id, expires_at) VALUES (:token, :user_id, :expires)")
            ->execute(['token' => $hashedDeviceToken, 'user_id' => $row['user_id'], 'expires' => $deviceExpires]);

        $responseData['device_token'] = $rawDeviceToken;
    }

    Response::success($responseData);
} catch (Exception $e) {
    Response::error('2FA verification failed: ' . $e->getMessage(), 500);
}
