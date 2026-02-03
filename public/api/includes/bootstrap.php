<?php
/**
 * Bootstrap file - Initializes the API
 * Include this file at the top of every API endpoint
 */

// Error handling
error_reporting(E_ALL);
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// Load configuration
$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Configuration file not found. Please copy config.sample.php to config.php and update settings.',
    ]);
    exit;
}

$config = require $configPath;

// Load classes
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/PlaidClient.php';
require_once __DIR__ . '/Response.php';

// Initialize components
Response::init($config['app']['allowed_origins'] ?? ['*']);
Database::init($config['database']);

// Handle CORS preflight
Response::handlePreflight();

// Helper function to get JSON request body
function getJsonBody(): array {
    $body = file_get_contents('php://input');
    return json_decode($body, true) ?? [];
}

// Helper function to check if using mock data
function useMockData(): bool {
    global $config;
    return $config['app']['use_mock_data'] ?? true;
}

// Helper function to get Plaid client
function getPlaidClient(): PlaidClient {
    global $config;
    return new PlaidClient($config['plaid']);
}

// Helper to validate required fields
function validateRequired(array $data, array $fields): void {
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            Response::error("Missing required field: {$field}");
        }
    }
}
