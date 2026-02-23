<?php
/**
 * 2FA Setup Endpoint
 * POST /api/auth/2fa-setup.php
 * Action: "generate" — generates a new TOTP secret and recovery codes
 * Action: "confirm" — verifies a code and enables 2FA
 * Action: "disable" — disables 2FA (requires code or recovery code)
 * GET — returns current 2FA status
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/TOTP.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Return 2FA status for the current user
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare("SELECT totp_enabled FROM users WHERE id = :id");
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    Response::success([
        'totp_enabled' => (bool)($user['totp_enabled'] ?? false),
    ]);
}

if ($method !== 'POST') {
    Response::error('Method not allowed', 405);
}

$userId = getCurrentUserId();
$body = getJsonBody();
$action = $body['action'] ?? '';

$pdo = Database::getConnection();

try {
    switch ($action) {
        case 'generate':
            // Generate a new secret (don't enable yet)
            $secret = TOTP::generateSecret();
            $recoveryCodes = TOTP::generateRecoveryCodes(8);

            // Get user email for the OTP URI
            $stmt = $pdo->prepare("SELECT email FROM users WHERE id = :id");
            $stmt->execute(['id' => $userId]);
            $email = $stmt->fetchColumn();

            // Store secret and recovery codes (not enabled yet)
            $stmt = $pdo->prepare("UPDATE users SET totp_secret = :secret, recovery_codes = :codes WHERE id = :id");
            $stmt->execute([
                'secret' => $secret,
                'codes' => json_encode($recoveryCodes),
                'id' => $userId,
            ]);

            $otpauthUri = TOTP::getOtpAuthUri($secret, $email);

            Response::success([
                'otpauth_uri' => $otpauthUri,
                'secret' => $secret,
                'recovery_codes' => $recoveryCodes,
            ]);
            break;

        case 'confirm':
            // Verify the code and enable 2FA
            validateRequired($body, ['code']);
            $code = trim($body['code']);

            $stmt = $pdo->prepare("SELECT totp_secret FROM users WHERE id = :id");
            $stmt->execute(['id' => $userId]);
            $secret = $stmt->fetchColumn();

            if (!$secret) {
                Response::error('No 2FA setup in progress. Generate a secret first.');
            }

            if (!TOTP::verify($secret, $code)) {
                Response::error('Invalid verification code. Please try again.', 400);
            }

            // Enable 2FA
            $stmt = $pdo->prepare("UPDATE users SET totp_enabled = 1 WHERE id = :id");
            $stmt->execute(['id' => $userId]);

            Response::success(['totp_enabled' => true]);
            break;

        case 'disable':
            // Disable 2FA — requires current TOTP code or a recovery code
            validateRequired($body, ['code']);
            $code = trim($body['code']);

            $stmt = $pdo->prepare("SELECT totp_secret, recovery_codes FROM users WHERE id = :id");
            $stmt->execute(['id' => $userId]);
            $row = $stmt->fetch();

            if (!$row || !$row['totp_secret']) {
                Response::error('2FA is not enabled.');
            }

            $valid = TOTP::verify($row['totp_secret'], $code);

            // Also check recovery codes
            if (!$valid && $row['recovery_codes']) {
                $recoveryCodes = json_decode($row['recovery_codes'], true) ?: [];
                $idx = array_search($code, $recoveryCodes, true);
                if ($idx !== false) {
                    $valid = true;
                }
            }

            if (!$valid) {
                Response::error('Invalid code. Provide a valid TOTP code or recovery code.', 400);
            }

            $stmt = $pdo->prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = NULL WHERE id = :id");
            $stmt->execute(['id' => $userId]);

            Response::success(['totp_enabled' => false]);
            break;

        default:
            Response::error('Invalid action. Use: generate, confirm, or disable.', 400);
    }
} catch (Exception $e) {
    Response::error('2FA operation failed: ' . $e->getMessage(), 500);
}
