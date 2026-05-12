<?php
/**
 * App Config Endpoint
 * GET  -> { reload_after_sync: bool } (any authenticated user)
 * POST -> save app-wide config (admin only)
 *
 * Stored in app_settings under keys prefixed 'app_cfg_*'.
 */
require_once __DIR__ . '/../includes/bootstrap.php';

getCurrentUserId(); // require auth

$pdo = Database::getConnection();

$defaults = [
    'reload_after_sync' => true,
];

function loadAppConfig(PDO $pdo, array $defaults): array {
    $out = $defaults;
    try {
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'app_cfg_%'");
        $stmt->execute();
        foreach ($stmt->fetchAll() as $row) {
            $key = substr($row['setting_key'], 8); // strip 'app_cfg_'
            if (!array_key_exists($key, $defaults)) continue;
            $val = $row['setting_value'];
            if (is_bool($defaults[$key])) {
                $out[$key] = ($val === '1' || $val === 'true');
            } else {
                $out[$key] = $val;
            }
        }
    } catch (Exception $e) {
        // table missing -> defaults
    }
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    Response::success(loadAppConfig($pdo, $defaults));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();
    $body = getJsonBody();
    $stmt = $pdo->prepare("
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES (:key, :value)
        ON DUPLICATE KEY UPDATE setting_value = :value2
    ");
    foreach ($body as $key => $value) {
        if (!array_key_exists($key, $defaults)) continue;
        $stored = is_bool($defaults[$key]) ? ($value ? '1' : '0') : (string)$value;
        $stmt->execute([
            'key' => 'app_cfg_' . $key,
            'value' => $stored,
            'value2' => $stored,
        ]);
    }
    Response::success(loadAppConfig($pdo, $defaults));
}

Response::error('Method not allowed', 405);
