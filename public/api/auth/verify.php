<?php
/**
 * Verify Auth Status Endpoint
 * GET /api/auth/verify.php
 * Returns: { auth_enabled: bool, token_valid: bool, user?: {...} }
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    $pdo = Database::getConnection();
    
    // Check if any users exist (auth is enabled when users exist)
    $authEnabled = false;
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users");
        $stmt->execute();
        $authEnabled = ((int)$stmt->fetchColumn()) > 0;
    } catch (Exception $e) {
        // Table doesn't exist
    }
    
    // Check if provided token is valid and get user info
    $tokenValid = false;
    $user = null;
    $authHeader = getAuthorizationHeader();
    if (preg_match('/Bearer\s+(.+)/i', $authHeader, $matches)) {
        try {
            $stmt = $pdo->prepare('
                SELECT u.id, u.email, u.name, u.role
                FROM auth_tokens at
                INNER JOIN users u ON at.user_id = u.id
                WHERE at.token = :token AND at.expires_at > NOW()
            ');
            $stmt->execute(['token' => $matches[1]]);
            $row = $stmt->fetch();
            if ($row) {
                $tokenValid = true;
                $user = $row;
            }
        } catch (Exception $e) {
            // Table doesn't exist
        }
    }
    
    Response::success([
        'auth_enabled' => $authEnabled,
        'token_valid' => $tokenValid,
        'user' => $user,
    ]);
} catch (Exception $e) {
    Response::error('Verify failed: ' . $e->getMessage(), 500);
}
