<?php
/**
 * AutoExcluder - matches transaction names against exclusion rules
 * User-scoped and environment-scoped.
 */

class AutoExcluder {
    /**
     * Check if a transaction should be excluded based on exclusion rules.
     * Returns true if the transaction matches any exclusion rule.
     */
    public static function shouldExclude(PDO $pdo, string $transactionName, ?string $merchantName = null, ?string $userId = null, string $environment = 'sandbox'): bool {
        if (!$userId) return false;

        $stmt = $pdo->prepare('
            SELECT keyword, match_type
            FROM exclusion_rules
            WHERE user_id = :user_id AND plaid_environment = :env
            ORDER BY priority DESC
        ');
        $stmt->execute(['user_id' => $userId, 'env' => $environment]);
        $rules = $stmt->fetchAll();

        $nameUpper = strtoupper($transactionName);
        $merchantUpper = $merchantName ? strtoupper($merchantName) : '';

        foreach ($rules as $rule) {
            $keywords = array_map('trim', explode('|', strtoupper($rule['keyword'])));

            foreach ($keywords as $keyword) {
                if ($keyword === '') continue;
                $matched = false;
                switch ($rule['match_type']) {
                    case 'exact':
                        $matched = ($nameUpper === $keyword || $merchantUpper === $keyword);
                        break;
                    case 'starts_with':
                        $matched = (strpos($nameUpper, $keyword) === 0 || strpos($merchantUpper, $keyword) === 0);
                        break;
                    case 'contains':
                    default:
                        $matched = (strpos($nameUpper, $keyword) !== false || ($merchantUpper && strpos($merchantUpper, $keyword) !== false));
                        break;
                }
                if ($matched) return true;
            }
        }

        return false;
    }
}
