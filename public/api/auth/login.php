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
    $stmt = $pdo->prepare("SELECT id, email, name, password_hash, role, totp_enabled FROM users WHERE email = :email");
    $stmt->execute(['email' => strtolower(trim($body['email']))]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($body['password'], $user['password_hash'])) {
        Response::error('Invalid email or password', 401);
    }
    
    // Check if 2FA is enabled
    if (!empty($user['totp_enabled'])) {
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
    
    // No 2FA — issue normal session token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    
    // Clean expired tokens
    $pdo->exec("DELETE FROM auth_tokens WHERE expires_at < NOW()");
    
    // Store token with user_id
    $pdo->prepare("INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (:token, :user_id, :expires)")
        ->execute(['token' => $token, 'user_id' => $user['id'], 'expires' => $expiresAt]);
    
    Response::success([
        'token' => $token,
        'expires_at' => $expiresAt,
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
        ],
    ]);
} catch (Exception $e) {
    Response::error('Login failed: ' . $e->getMessage(), 500);
}
