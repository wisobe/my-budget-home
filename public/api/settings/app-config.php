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

function ensureAppSettingsTable(PDO $pdo): void {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Exception $e) {
        throw new Exception('The app_settings table is missing and could not be created automatically. Please run public/api/schema.sql or create the app_settings table manually. Database error: ' . $e->getMessage());
    }
}

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
    try {
        // Ensure table exists (in case schema is older than this feature).
        ensureAppSettingsTable($pdo);

        $body = getJsonBody();
        $existsStmt = $pdo->prepare("SELECT COUNT(*) FROM app_settings WHERE setting_key = :setting_key");
        $insertStmt = $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES (:setting_key, :setting_value)");
        $updateStmt = $pdo->prepare("UPDATE app_settings SET setting_value = :setting_value WHERE setting_key = :setting_key");

        foreach ($body as $key => $value) {
            if (!array_key_exists($key, $defaults)) continue;
            $stored = is_bool($defaults[$key]) ? ($value ? '1' : '0') : (string)$value;
            $settingKey = 'app_cfg_' . $key;

            $existsStmt->execute(['setting_key' => $settingKey]);
            $stmt = ((int)$existsStmt->fetchColumn() > 0) ? $updateStmt : $insertStmt;
            $stmt->execute([
                'setting_key' => $settingKey,
                'setting_value' => $stored,
            ]);
        }
        Response::success(loadAppConfig($pdo, $defaults));
    } catch (Exception $e) {
        Response::error('Save failed: ' . $e->getMessage(), 500);
    }
}

Response::error('Method not allowed', 405);
