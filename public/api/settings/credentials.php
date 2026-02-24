<?php
/**
 * Plaid Credentials Management Endpoint (Admin only)
 * GET  /api/settings/credentials.php - Get current Plaid credentials (masked)
 * POST /api/settings/credentials.php - Save Plaid credentials
 */

require_once __DIR__ . '/../includes/bootstrap.php';

// Admin only
requireAdmin();

try {
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Read credentials from app_settings
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'plaid_%'");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        // Mask secrets (show last 4 chars only)
        $mask = function($val) {
            if (empty($val)) return '';
            if (strlen($val) <= 4) return '****';
            return str_repeat('*', strlen($val) - 4) . substr($val, -4);
        };

        Response::success([
            'sandbox' => [
                'client_id' => $settings['plaid_sandbox_client_id'] ?? '',
                'secret' => $mask($settings['plaid_sandbox_secret'] ?? ''),
                'country_codes' => $settings['plaid_sandbox_country_codes'] ?? 'CA',
                'products' => $settings['plaid_sandbox_products'] ?? 'transactions',
                'has_credentials' => !empty($settings['plaid_sandbox_client_id']) && !empty($settings['plaid_sandbox_secret']),
            ],
            'production' => [
                'client_id' => $settings['plaid_production_client_id'] ?? '',
                'secret' => $mask($settings['plaid_production_secret'] ?? ''),
                'country_codes' => $settings['plaid_production_country_codes'] ?? 'CA',
                'products' => $settings['plaid_production_products'] ?? 'transactions',
                'has_credentials' => !empty($settings['plaid_production_client_id']) && !empty($settings['plaid_production_secret']),
            ],
        ]);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        $environment = $body['environment'] ?? '';

        if (!in_array($environment, ['sandbox', 'production'])) {
            Response::error('Invalid environment. Must be "sandbox" or "production".', 400);
        }

        $clientId = trim($body['client_id'] ?? '');
        $secret = trim($body['secret'] ?? '');

        if (empty($clientId) || empty($secret)) {
            Response::error('Both client_id and secret are required.', 400);
        }

        // Upsert into app_settings
        $keys = [
            "plaid_{$environment}_client_id" => $clientId,
            "plaid_{$environment}_secret" => $secret,
        ];

        // Also store country_codes and products with defaults
        $keys["plaid_{$environment}_country_codes"] = $body['country_codes'] ?? 'CA';
        $keys["plaid_{$environment}_products"] = $body['products'] ?? 'transactions';

        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE setting_value = :value2
        ");

        foreach ($keys as $key => $value) {
            $stmt->execute([
                'key' => $key,
                'value' => $value,
                'value2' => $value,
            ]);
        }

        Response::success(['saved' => true, 'environment' => $environment]);

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
