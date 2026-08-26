<?php
/**
 * Shared matching helpers for pipe-separated transaction rules.
 */
class RuleMatcher {
    /**
     * A "contains" keyword must be present as a complete word or phrase.
     * Letters and numbers immediately beside it prevent a match.
     */
    public static function contains(string $text, string $keyword): bool {
        $keyword = trim($keyword);
        if ($keyword === '') return false;

        $pattern = '/(?<![\p{L}\p{N}])' . preg_quote($keyword, '/') . '(?![\p{L}\p{N}])/iu';
        return preg_match($pattern, $text) === 1;
    }

    /**
     * Build the equivalent MariaDB REGEXP pattern used by bulk apply/preview.
     */
    public static function containsSqlPattern(string $keyword): string {
        $escaped = preg_quote(strtoupper(trim($keyword)), '/');
        return '(^|[^[:alnum:]])' . $escaped . '([^[:alnum:]]|$)';
    }
}