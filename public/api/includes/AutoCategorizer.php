<?php
/**
 * AutoCategorizer - matches transaction names against category rules
 * Now user-scoped: rules belong to individual users
 */

class AutoCategorizer {
    /**
     * Find the best matching category for a transaction name/merchant.
     * Filters rules by user_id.
     * Returns category_id or null if no match.
     */
    public static function match(PDO $pdo, string $transactionName, ?string $merchantName = null, ?string $userId = null): ?string {
        if (!$userId) return null;
        
        $stmt = $pdo->prepare('
            SELECT id, category_id, keyword, match_type, priority
            FROM category_rules
            WHERE user_id = :user_id
            ORDER BY priority DESC, match_type ASC
        ');
        $stmt->execute(['user_id' => $userId]);
        $rules = $stmt->fetchAll();

        $nameUpper = strtoupper($transactionName);
        $merchantUpper = $merchantName ? strtoupper($merchantName) : '';

        $bestMatch = null;
        $bestPriority = -1;

        foreach ($rules as $rule) {
            $keyword = strtoupper($rule['keyword']);
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

            if ($matched && (int)$rule['priority'] > $bestPriority) {
                $bestMatch = $rule['category_id'];
                $bestPriority = (int)$rule['priority'];
            }
        }

        return $bestMatch;
    }

    /**
     * Auto-learn: create a rule from a manual categorization.
     * Rules are user-scoped.
     */
    public static function learnFromCategorization(PDO $pdo, string $transactionName, ?string $merchantName, string $categoryId, ?string $userId = null): void {
        if (!$userId) return;
        
        $keyword = $merchantName ? strtoupper(trim($merchantName)) : strtoupper(trim($transactionName));

        if (strlen($keyword) < 3) return;

        // Check if a rule with this keyword already exists for this user
        $checkStmt = $pdo->prepare('SELECT id, category_id FROM category_rules WHERE keyword = :keyword AND user_id = :user_id LIMIT 1');
        $checkStmt->execute(['keyword' => $keyword, 'user_id' => $userId]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            if ($existing['category_id'] !== $categoryId) {
                $updateStmt = $pdo->prepare('UPDATE category_rules SET category_id = :cat_id WHERE id = :id');
                $updateStmt->execute(['cat_id' => $categoryId, 'id' => $existing['id']]);
            }
        } else {
            $insertStmt = $pdo->prepare('
                INSERT INTO category_rules (id, user_id, category_id, keyword, match_type, priority, auto_learned, created_at)
                VALUES (:id, :user_id, :category_id, :keyword, :match_type, :priority, 1, NOW())
            ');
            $insertStmt->execute([
                'id' => 'rule_' . uniqid(),
                'user_id' => $userId,
                'category_id' => $categoryId,
                'keyword' => $keyword,
                'match_type' => 'contains',
                'priority' => 0,
            ]);
        }
    }
}
