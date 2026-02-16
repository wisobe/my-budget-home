<?php
/**
 * Verify Auth Status Endpoint
 * GET /api/auth/verify.php
 * Returns: { auth_enabled: bool, token_valid: bool }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $pdo = Database::getConnection();
    
    // Check if auth is enabled (password_hash exists)
    $authEnabled = false;
    try {
        $stmt = $pdo->prepare("SELECT 1 FROM app_settings WHERE setting_key = 'password_hash' LIMIT 1");
        $stmt->execute();
        $authEnabled = (bool)$stmt->fetch();
    } catch (Exception $e) {
        // Table doesn't exist
    }
    
    // Check if provided token is valid
    $tokenValid = false;
    $authHeader = getAuthorizationHeader();
    if (preg_match('/Bearer\s+(.+)/i', $authHeader, $matches)) {
        try {
            $stmt = $pdo->prepare('SELECT 1 FROM auth_tokens WHERE token = :token AND expires_at > NOW()');
            $stmt->execute(['token' => $matches[1]]);
            $tokenValid = (bool)$stmt->fetch();
        } catch (Exception $e) {
            // Table doesn't exist
        }
    }
    
    Response::success([
        'auth_enabled' => $authEnabled,
        'token_valid' => $tokenValid,
    ]);
} catch (Exception $e) {
    Response::error('Verify failed: ' . $e->getMessage(), 500);
}
