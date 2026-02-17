<?php
/**
 * AutoCategorizer - matches transaction names against category rules
 */

class AutoCategorizer {
    /**
     * Find the best matching category for a transaction name/merchant.
     * Returns category_id or null if no match.
     */
    public static function match(PDO $pdo, string $transactionName, ?string $merchantName = null): ?string {
        $stmt = $pdo->query('
            SELECT id, category_id, keyword, match_type, priority
            FROM category_rules
            ORDER BY priority DESC, match_type ASC
        ');
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
     * Uses merchant_name if available, otherwise extracts keyword from transaction name.
     */
    public static function learnFromCategorization(PDO $pdo, string $transactionName, ?string $merchantName, string $categoryId): void {
        // Determine keyword: prefer merchant_name, fall back to transaction name
        $keyword = $merchantName ? strtoupper(trim($merchantName)) : strtoupper(trim($transactionName));

        // Skip very short or generic keywords
        if (strlen($keyword) < 3) return;

        // Check if a rule with this keyword already exists
        $checkStmt = $pdo->prepare('SELECT id, category_id FROM category_rules WHERE keyword = :keyword LIMIT 1');
        $checkStmt->execute(['keyword' => $keyword]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            // Update to new category if different
            if ($existing['category_id'] !== $categoryId) {
                $updateStmt = $pdo->prepare('UPDATE category_rules SET category_id = :cat_id WHERE id = :id');
                $updateStmt->execute(['cat_id' => $categoryId, 'id' => $existing['id']]);
            }
        } else {
            // Create new auto-learned rule
            $insertStmt = $pdo->prepare('
                INSERT INTO category_rules (id, category_id, keyword, match_type, priority, auto_learned, created_at)
                VALUES (:id, :category_id, :keyword, :match_type, :priority, 1, NOW())
            ');
            $insertStmt->execute([
                'id' => 'rule_' . uniqid(),
                'category_id' => $categoryId,
                'keyword' => $keyword,
                'match_type' => $merchantName ? 'contains' : 'contains',
                'priority' => 0,
            ]);
        }
    }
}
