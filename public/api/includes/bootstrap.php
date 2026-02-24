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

/**
 * Get a Plaid client for the specified environment.
 */
function getPlaidClient(string $environment = 'sandbox'): PlaidClient {
    global $config;
    
    if (!in_array($environment, ['sandbox', 'production'])) {
        $environment = 'sandbox';
    }
    
    // Try loading credentials from database (app_settings) first
    $plaidConfig = null;
    try {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE :prefix");
        $stmt->execute(['prefix' => "plaid_{$environment}_%"]);
        $rows = $stmt->fetchAll();
        
        if (!empty($rows)) {
            $dbSettings = [];
            foreach ($rows as $row) {
                $dbSettings[$row['setting_key']] = $row['setting_value'];
            }
            
            $clientId = $dbSettings["plaid_{$environment}_client_id"] ?? '';
            $secret = $dbSettings["plaid_{$environment}_secret"] ?? '';
            
            if (!empty($clientId) && !empty($secret)) {
                $countryCodes = $dbSettings["plaid_{$environment}_country_codes"] ?? 'CA';
                $products = $dbSettings["plaid_{$environment}_products"] ?? 'transactions';
                $plaidConfig = [
                    'client_id' => $clientId,
                    'secret' => $secret,
                    'country_codes' => is_string($countryCodes) ? explode(',', $countryCodes) : $countryCodes,
                    'products' => is_string($products) ? explode(',', $products) : $products,
                    'environment' => $environment,
                ];
            }
        }
    } catch (Exception $e) {
        // DB not available or table missing, fall through to config.php
    }
    
    // Fallback to config.php
    if ($plaidConfig === null) {
        if (isset($config['plaid'][$environment])) {
            $plaidConfig = $config['plaid'][$environment];
            $plaidConfig['environment'] = $environment;
        } else {
            $plaidConfig = $config['plaid'];
        }
    }
    
    return new PlaidClient($plaidConfig);
}

/**
 * Get Plaid environment from request body or query string
 */
function getPlaidEnvironment(): string {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (isset($body['plaid_environment']) && in_array($body['plaid_environment'], ['sandbox', 'production'])) {
        return $body['plaid_environment'];
    }
    if (isset($_GET['plaid_environment']) && in_array($_GET['plaid_environment'], ['sandbox', 'production'])) {
        return $_GET['plaid_environment'];
    }
    return 'sandbox';
}

// Helper to validate required fields
function validateRequired(array $data, array $fields): void {
    foreach ($fields as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            Response::error("Missing required field: {$field}");
        }
    }
}

/**
 * Get Authorization header from various sources (Apache compatibility)
 */
function getAuthorizationHeader(): string {
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            return $headers['Authorization'];
        }
    }
    return '';
}

/**
 * Verify auth token and return user_id
 */
function requireAuthToken(): string {
    $authHeader = getAuthorizationHeader();
    if (!preg_match('/Bearer\s+(.+)/i', $authHeader, $matches)) {
        Response::unauthorized('Authentication required');
    }
    try {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('
            SELECT at.user_id FROM auth_tokens at
            INNER JOIN users u ON at.user_id = u.id
            WHERE at.token = :token AND at.expires_at > NOW() AND (at.is_2fa_pending IS NULL OR at.is_2fa_pending = 0)
        ');
        $stmt->execute(['token' => $matches[1]]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::unauthorized('Invalid or expired token');
        }
        return $row['user_id'];
    } catch (PDOException $e) {
        Response::unauthorized('Authentication failed');
    }
    return ''; // unreachable but keeps static analysis happy
}

/**
 * Get the current authenticated user's ID.
 * Returns the user_id stored by the auto-auth middleware.
 */
function getCurrentUserId(): string {
    global $_currentUserId;
    if (empty($_currentUserId)) {
        Response::unauthorized('Authentication required');
    }
    return $_currentUserId;
}

/**
 * Get the current authenticated user's full record.
 */
function getCurrentUser(): array {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare('SELECT id, email, name, role, created_at FROM users WHERE id = :id');
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        Response::unauthorized('User not found');
    }
    return $user;
}

/**
 * Require the current user to be an admin.
 */
function requireAdmin(): array {
    $user = getCurrentUser();
    if ($user['role'] !== 'admin') {
        Response::error('Admin access required', 403);
    }
    return $user;
}

// ============================================================
// Auto-auth middleware: protect all endpoints except auth/login and auth/verify
// ============================================================
$_currentUserId = null;
$_requestUri = $_SERVER['REQUEST_URI'] ?? '';
$_isOpenAuthEndpoint = preg_match('#/auth/(login|verify|2fa-verify)\.php#', $_requestUri);

if (!$_isOpenAuthEndpoint && $_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
    try {
        $pdo = Database::getConnection();
        // Check if any users exist (if not, allow unauthenticated access for setup)
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users");
        $stmt->execute();
        $userCount = (int)$stmt->fetchColumn();
        
        if ($userCount > 0) {
            $_currentUserId = requireAuthToken();
        }
    } catch (Exception $e) {
        // Tables don't exist yet (first-time setup), skip auth
    }
}
