<?php
/**
 * Login Endpoint
 * POST /api/auth/login.php
 * Body: { "email": "...", "password": "..." }
 * Returns: { token, expires_at, user } or { requires_2fa: true, temp_token }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['email', 'password']);
    
    $pdo = Database::getConnection();
    
    // Find user by email
    $stmt = $pdo->prepare("SELECT id, email, name, password_hash, role, allow_sandbox, totp_enabled FROM users WHERE email = :email");
    $stmt->execute(['email' => strtolower(trim($body['email']))]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($body['password'], $user['password_hash'])) {
        AuditLog::log('login_failed', null, null, json_encode(['email' => strtolower(trim($body['email']))]));
        Response::error('Invalid email or password', 401);
    }
    
    // Check if 2FA is enabled
    if (!empty($user['totp_enabled'])) {
        // Check for trusted device token
        $deviceToken = $body['device_token'] ?? null;
        $deviceTrusted = false;
        
        if ($deviceToken) {
            // Create table if not exists
            $pdo->exec("CREATE TABLE IF NOT EXISTS trusted_devices (
                token VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                INDEX idx_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            
            $stmt2 = $pdo->prepare("SELECT token FROM trusted_devices WHERE token = :token AND user_id = :user_id AND expires_at > NOW()");
            $stmt2->execute(['token' => hash('sha256', $deviceToken), 'user_id' => $user['id']]);
            $deviceTrusted = (bool)$stmt2->fetch();
        }
        
        if (!$deviceTrusted) {
            // Issue a short-lived temp token for the 2FA step
            $tempToken = bin2hex(random_bytes(32));
            $tempExpires = date('Y-m-d H:i:s', strtotime('+5 minutes'));
            
            $pdo->prepare("INSERT INTO auth_tokens (token, user_id, expires_at, is_2fa_pending) VALUES (:token, :user_id, :expires, 1)")
                ->execute(['token' => $tempToken, 'user_id' => $user['id'], 'expires' => $tempExpires]);
            
            Response::success([
                'requires_2fa' => true,
                'temp_token' => $tempToken,
            ]);
        }
    }
    
    // No 2FA — issue normal session token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    
    // Clean expired tokens
    $pdo->exec("DELETE FROM auth_tokens WHERE expires_at < NOW()");
    
    // Store token with user_id
    $pdo->prepare("INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (:token, :user_id, :expires)")
        ->execute(['token' => $token, 'user_id' => $user['id'], 'expires' => $expiresAt]);
    
    AuditLog::log('login_success', $user['id']);
    
    Response::success([
        'token' => $token,
        'expires_at' => $expiresAt,
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
            'allow_sandbox' => (bool)$user['allow_sandbox'],
        ],
    ]);
} catch (Exception $e) {
    Response::error('Login failed: ' . $e->getMessage(), 500);
}
