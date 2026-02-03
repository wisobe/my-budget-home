<?php
/**
 * Database Test Connection Endpoint
 * POST /api/settings/test-db.php
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $result = Database::testConnection();
    Response::success($result);
} catch (Exception $e) {
    Response::success([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
