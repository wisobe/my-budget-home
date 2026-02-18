<?php
/**
 * Login Endpoint
 * POST /api/auth/login.php
 * Body: { "email": "...", "password": "..." }
 * Returns: { token, expires_at, user }
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
    $stmt = $pdo->prepare("SELECT id, email, name, password_hash, role FROM users WHERE email = :email");
    $stmt->execute(['email' => strtolower(trim($body['email']))]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($body['password'], $user['password_hash'])) {
        Response::error('Invalid email or password', 401);
    }
    
    // Generate token
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
