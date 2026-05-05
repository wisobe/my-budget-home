<?php
/**
 * Subscription Detection Tuning
 * Loads tunable parameters from app_settings, with sensible defaults.
 * Used by both /subscriptions/index.php and /subscriptions/debug.php
 */

class SubscriptionTuning {
    public static function defaults(): array {
        return [
            'lookback_months'            => 18,
            'min_occurrences'            => 2,
            'min_key_length'             => 2,
            'fuzzy_min_prefix'           => 4,
            // bucket day ranges [min, expected, max]
            'weekly_min'    => 4,   'weekly_days'    => 7,   'weekly_max'    => 11,
            'biweekly_min'  => 11,  'biweekly_days'  => 14,  'biweekly_max'  => 21,
            'monthly_min'   => 21,  'monthly_days'   => 30,  'monthly_max'   => 38,
            'quarterly_min' => 80,  'quarterly_days' => 91,  'quarterly_max' => 105,
            'annual_min'    => 340, 'annual_days'    => 365, 'annual_max'    => 400,
            // variance checks
            'interval_variance_pct'        => 20,   // % deviation allowed from expected interval
            'interval_variance_min_count'  => 3,    // skip check if intervals count <= this
            'amount_variance_pct'          => 10,   // % std-dev / mean allowed
            'amount_variance_min_count'    => 3,    // skip check if txn count <= this
            // status
            'due_soon_multiplier'      => 0.8,
            'missed_multiplier'        => 1.5,
            'price_change_threshold'   => 5,        // % change to flag as price change
        ];
    }

    /** Load from app_settings, merging on top of defaults. */
    public static function load(PDO $pdo): array {
        $params = self::defaults();
        try {
            $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'sub_tune_%'");
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $key = substr($row['setting_key'], 9); // strip 'sub_tune_'
                if (array_key_exists($key, $params)) {
                    $params[$key] = is_numeric($row['setting_value'])
                        ? (str_contains($row['setting_value'], '.') ? (float)$row['setting_value'] : (int)$row['setting_value'])
                        : $row['setting_value'];
                }
            }
        } catch (Exception $e) {
            // app_settings may not exist; return defaults
        }
        return $params;
    }

    /** Save params (admin) */
    public static function save(PDO $pdo, array $values): void {
        $defaults = self::defaults();
        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (:key, :value)
            ON DUPLICATE KEY UPDATE setting_value = :value2
        ");
        foreach ($values as $key => $value) {
            if (!array_key_exists($key, $defaults)) continue;
            $stmt->execute([
                'key' => 'sub_tune_' . $key,
                'value' => (string)$value,
                'value2' => (string)$value,
            ]);
        }
    }

    /** Reset (delete all tuning rows) */
    public static function reset(PDO $pdo): void {
        $pdo->exec("DELETE FROM app_settings WHERE setting_key LIKE 'sub_tune_%'");
    }

    /** Apply a draft override map on top of base params (used for live testing). */
    public static function withOverrides(array $base, array $overrides): array {
        foreach ($overrides as $k => $v) {
            if (array_key_exists($k, $base) && $v !== '' && $v !== null) {
                $base[$k] = is_numeric($v)
                    ? (str_contains((string)$v, '.') ? (float)$v : (int)$v)
                    : $v;
            }
        }
        return $base;
    }
}
