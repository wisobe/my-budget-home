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
        
        // Return safe settings (no secrets)
        Response::success([
            'use_mock_data' => $config['app']['use_mock_data'] ?? true,
            'plaid_environment' => $config['plaid']['environment'] ?? 'sandbox',
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
