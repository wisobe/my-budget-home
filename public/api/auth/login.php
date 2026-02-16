<?php
/**
 * Login Endpoint
 * POST /api/auth/login.php
 * Body: { "password": "..." }
 * Returns: { token, expires_at }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $body = getJsonBody();
    validateRequired($body, ['password']);
    
    $pdo = Database::getConnection();
    
    // Ensure tables exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS auth_tokens (
        token VARCHAR(64) PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Get or create default password hash
    $stmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'password_hash'");
    $stmt->execute();
    $row = $stmt->fetch();
    
    if (!$row) {
        // First time: create default password "budget2024"
        $defaultHash = password_hash('budget2024', PASSWORD_BCRYPT);
        $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('password_hash', :hash)")
            ->execute(['hash' => $defaultHash]);
        $passwordHash = $defaultHash;
    } else {
        $passwordHash = $row['setting_value'];
    }
    
    if (!password_verify($body['password'], $passwordHash)) {
        Response::error('Invalid password', 401);
    }
    
    // Generate token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));
    
    // Clean expired tokens
    $pdo->exec("DELETE FROM auth_tokens WHERE expires_at < NOW()");
    
    // Store token
    $pdo->prepare("INSERT INTO auth_tokens (token, expires_at) VALUES (:token, :expires)")
        ->execute(['token' => $token, 'expires' => $expiresAt]);
    
    Response::success(['token' => $token, 'expires_at' => $expiresAt]);
} catch (Exception $e) {
    Response::error('Login failed: ' . $e->getMessage(), 500);
}
