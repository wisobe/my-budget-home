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
        $allowedKeys = ['plaid_environment', 'dark_mode', 'auto_sync', 'show_pending', 'language', 'balance_accounts', 'consent_data_collection', 'consent_data_processing', 'consent_data_storage', 'sidebar_order', 'account_order', 'account_group_order'];

        // Consent keys that require audit logging
        $consentKeys = ['consent_data_collection', 'consent_data_processing', 'consent_data_storage'];
        $consentTypeMap = [
            'consent_data_collection' => 'data_collection',
            'consent_data_processing' => 'data_processing',
            'consent_data_storage' => 'data_storage',
        ];

        // Pre-fetch current consent values for audit comparison
        $currentConsent = [];
        if (array_intersect(array_keys($body), $consentKeys)) {
            $consentPrefixes = array_map(fn($k) => "user_{$userId}_pref_{$k}", $consentKeys);
            $placeholders = implode(',', array_fill(0, count($consentPrefixes), '?'));
            $fetchStmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ($placeholders)");
            $fetchStmt->execute($consentPrefixes);
            foreach ($fetchStmt->fetchAll() as $row) {
                $prefixLen = strlen("user_{$userId}_pref_");
                $key = substr($row['setting_key'], $prefixLen);
                $currentConsent[$key] = $row['setting_value'];
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE setting_value = :value2
        ");

        $auditStmt = $pdo->prepare("
            INSERT INTO consent_audit_log (user_id, consent_type, old_value, new_value, source, ip_address, user_agent)
            VALUES (:user_id, :consent_type, :old_value, :new_value, :source, :ip_address, :user_agent)
        ");

        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        foreach ($body as $key => $value) {
            if (!in_array($key, $allowedKeys)) continue;
            $dbKey = "user_{$userId}_pref_{$key}";
            $stmt->execute([
                'key' => $dbKey,
                'value' => $value,
                'value2' => $value,
            ]);

            // Log consent changes to audit table
            if (in_array($key, $consentKeys)) {
                $oldValue = $currentConsent[$key] ?? null;
                if ($oldValue !== (string)$value) {
                    $auditStmt->execute([
                        'user_id' => $userId,
                        'consent_type' => $consentTypeMap[$key],
                        'old_value' => $oldValue,
                        'new_value' => (string)$value,
                        'source' => 'settings',
                        'ip_address' => $ipAddress,
                        'user_agent' => $userAgent,
                    ]);
                }
            }
        }

        Response::success(['saved' => true]);

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
