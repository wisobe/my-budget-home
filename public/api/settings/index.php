<?php
/**
 * Settings Endpoint
 * GET /api/settings/index.php - Get current settings
 * POST /api/settings/index.php - Update settings
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        global $config;
        
        // Check which Plaid environments have credentials configured
        // First check database (app_settings), then fall back to config.php
        $hasSandbox = false;
        $hasProduction = false;
        
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'plaid_%'");
            $stmt->execute();
            $dbSettings = [];
            foreach ($stmt->fetchAll() as $row) {
                $dbSettings[$row['setting_key']] = $row['setting_value'];
            }
            $hasSandbox = !empty($dbSettings['plaid_sandbox_client_id'] ?? '') && !empty($dbSettings['plaid_sandbox_secret'] ?? '');
            $hasProduction = !empty($dbSettings['plaid_production_client_id'] ?? '') && !empty($dbSettings['plaid_production_secret'] ?? '');
        } catch (Exception $e) {
            // DB not available, skip
        }
        
        // Fall back to config.php if not found in DB
        if (!$hasSandbox) {
            $hasSandbox = !empty($config['plaid']['sandbox']['client_id'] ?? '')
                && ($config['plaid']['sandbox']['client_id'] ?? '') !== 'your_sandbox_client_id';
        }
        if (!$hasProduction) {
            $hasProduction = !empty($config['plaid']['production']['client_id'] ?? '')
                && ($config['plaid']['production']['client_id'] ?? '') !== 'your_production_client_id';
        }
        
        // Return safe settings (no secrets)
        Response::success([
            'use_mock_data' => $config['app']['use_mock_data'] ?? true,
            'plaid_sandbox_configured' => $hasSandbox,
            'plaid_production_configured' => $hasProduction,
            'database_host' => $config['database']['host'] ?? 'localhost',
            'database_name' => $config['database']['name'] ?? '',
            'database_connected' => false,
        ]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Settings updates require editing the config file
        // For security, this just tests the connection
        $body = getJsonBody();
        
        if (isset($body['test_database'])) {
            $result = Database::testConnection();
            Response::success($result);
        }
        
        Response::error('Settings must be updated in config.php file on the server', 400);
    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
