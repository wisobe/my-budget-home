<?php
/**
 * User Preferences Endpoint
 * GET  /api/settings/user-preferences.php - Get current user's preferences
 * POST /api/settings/user-preferences.php - Save current user's preferences
 *
 * Stores per-user settings like plaid_environment preference.
 * Uses app_settings with user-scoped keys: user_{userId}_pref_{key}
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE :prefix");
        $stmt->execute(['prefix' => "user_{$userId}_pref_%"]);
        $rows = $stmt->fetchAll();

        $prefs = [];
        $prefixLen = strlen("user_{$userId}_pref_");
        foreach ($rows as $row) {
            $key = substr($row['setting_key'], $prefixLen);
            $prefs[$key] = $row['setting_value'];
        }

        Response::success($prefs);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();

        // Only allow known preference keys
        $allowedKeys = ['plaid_environment', 'dark_mode', 'auto_sync', 'show_pending', 'language'];

        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE setting_value = :value2
        ");

        foreach ($body as $key => $value) {
            if (!in_array($key, $allowedKeys)) continue;
            $dbKey = "user_{$userId}_pref_{$key}";
            $stmt->execute([
                'key' => $dbKey,
                'value' => $value,
                'value2' => $value,
            ]);
        }

        Response::success(['saved' => true]);

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
