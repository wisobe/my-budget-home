<?php
/**
 * CsvImport - shared helpers for CSV transaction import.
 * Used by both import-preview.php (dry run) and import.php (write) so the
 * two endpoints can never disagree on validation or duplicate detection.
 */

class CsvImport {
    const MAX_ROWS = 2000;

    /**
     * Parse a date string according to the selected format.
     * Returns 'Y-m-d' or null when unparseable.
     */
    public static function parseDate(?string $raw, string $format): ?string {
        $raw = trim((string) $raw);
        if ($raw === '') return null;

        // Strip a trailing time component ("2026-05-31 14:22:00", "31/05/2026 14:22")
        $raw = preg_replace('/[T\s]\d{1,2}:\d{2}(:\d{2})?.*$/', '', $raw);
        $raw = trim($raw);

        $digits = preg_split('/[^0-9]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);

        if ($format === 'auto') {
            $format = self::guessFormat($raw);
        }

        if (count($digits) < 3) return null;

        switch ($format) {
            case 'DD/MM/YYYY':
                [$d, $m, $y] = [$digits[0], $digits[1], $digits[2]];
                break;
            case 'MM/DD/YYYY':
                [$m, $d, $y] = [$digits[0], $digits[1], $digits[2]];
                break;
            case 'YYYY-MM-DD':
            default:
                [$y, $m, $d] = [$digits[0], $digits[1], $digits[2]];
                break;
        }

        $y = (int) $y; $m = (int) $m; $d = (int) $d;

        // Two-digit years
        if ($y < 100) {
            $y += ($y > 70) ? 1900 : 2000;
        }

        if (!checkdate($m, $d, $y)) return null;

        return sprintf('%04d-%02d-%02d', $y, $m, $d);
    }

    /**
     * Best-effort format detection for a single value.
     */
    public static function guessFormat(string $raw): string {
        $digits = preg_split('/[^0-9]+/', $raw, -1, PREG_SPLIT_NO_EMPTY);
        if (count($digits) < 3) return 'YYYY-MM-DD';
        if (strlen($digits[0]) === 4) return 'YYYY-MM-DD';
        if ((int) $digits[0] > 12) return 'DD/MM/YYYY';
        if ((int) $digits[1] > 12) return 'MM/DD/YYYY';
        return 'DD/MM/YYYY';
    }

    /**
     * Parse a monetary value. Handles:
     *  "1,234.56"  "1 234,56"  "$1,234.56"  "(45.00)"  "-45,00"  "45.00 CR"
     * Returns a float or null when unparseable.
     */
    public static function parseAmount($raw): ?float {
        if ($raw === null) return null;
        $s = trim((string) $raw);
        if ($s === '') return null;

        $negative = false;

        // Parentheses notation
        if (preg_match('/^\((.*)\)$/', $s, $m)) {
            $negative = true;
            $s = $m[1];
        }

        // Trailing/leading CR/DR markers
        if (preg_match('/\b(CR|DR)\b/i', $s, $m)) {
            if (strtoupper($m[1]) === 'CR') $negative = !$negative;
            $s = preg_replace('/\b(CR|DR)\b/i', '', $s);
        }

        // Remove currency symbols, letters, spaces (incl. non-breaking / narrow no-break)
        $s = str_replace(["\xc2\xa0", "\xe2\x80\xaf", "'", "’"], '', $s);
        $s = preg_replace('/[^0-9,.\-+]/u', '', $s);
        $s = trim($s);
        if ($s === '' || $s === '-' || $s === '+') return null;

        if (strpos($s, '-') !== false) {
            $negative = !$negative;
        }
        $s = str_replace(['-', '+'], '', $s);

        $lastComma = strrpos($s, ',');
        $lastDot = strrpos($s, '.');

        if ($lastComma !== false && $lastDot !== false) {
            // The right-most separator is the decimal separator
            if ($lastComma > $lastDot) {
                $s = str_replace('.', '', $s);
                $s = str_replace(',', '.', $s);
            } else {
                $s = str_replace(',', '', $s);
            }
        } elseif ($lastComma !== false) {
            // Comma is decimal separator when it has 1-2 trailing digits
            $tail = strlen($s) - $lastComma - 1;
            $s = ($tail >= 1 && $tail <= 2) ? str_replace(',', '.', $s) : str_replace(',', '', $s);
        } elseif ($lastDot !== false) {
            $tail = strlen($s) - $lastDot - 1;
            if ($tail === 3 && substr_count($s, '.') >= 1 && strlen($s) > 4 && strpos($s, '.') === $lastDot) {
                // Ambiguous "1.234" — treat as thousands only when there is no other hint
                $s = str_replace('.', '', $s);
            }
        }

        if (!is_numeric($s)) return null;

        $value = (float) $s;
        return $negative ? -$value : $value;
    }

    /**
     * Normalize a description for duplicate matching.
     */
    public static function normalizeName(string $name): string {
        $n = strtoupper($name);
        $n = preg_replace('/[^A-Z0-9]+/', ' ', $n);
        return trim(preg_replace('/\s+/', ' ', $n));
    }

    /**
     * Validate + normalize a single incoming row.
     * Returns ['ok' => bool, 'error' => string|null, 'row' => array|null]
     */
    public static function normalizeRow(array $raw, array $mapping): array {
        $dateFormat = $mapping['date_format'] ?? 'auto';
        $signConvention = ($mapping['sign_convention'] ?? 'positive_expense');

        $date = self::parseDate($raw['date'] ?? null, $dateFormat);
        if ($date === null) {
            return ['ok' => false, 'error' => 'invalid_date', 'row' => null];
        }

        $name = trim((string) ($raw['name'] ?? ''));
        if ($name === '') {
            return ['ok' => false, 'error' => 'missing_description', 'row' => null];
        }
        if (mb_strlen($name) > 255) {
            $name = mb_substr($name, 0, 255);
        }

        $amount = null;
        if (array_key_exists('debit', $raw) || array_key_exists('credit', $raw)) {
            $debit = self::parseAmount($raw['debit'] ?? null);
            $credit = self::parseAmount($raw['credit'] ?? null);
            if ($debit !== null && abs($debit) > 0) {
                $amount = abs($debit);           // money out -> expense (positive)
            } elseif ($credit !== null && abs($credit) > 0) {
                $amount = -abs($credit);         // money in -> income (negative)
            }
        } else {
            $parsed = self::parseAmount($raw['amount'] ?? null);
            if ($parsed !== null) {
                // App convention (Plaid): positive = expense, negative = income
                $amount = ($signConvention === 'positive_income') ? -$parsed : $parsed;
            }
        }

        if ($amount === null) {
            return ['ok' => false, 'error' => 'invalid_amount', 'row' => null];
        }
        if (abs($amount) < 0.005) {
            return ['ok' => false, 'error' => 'zero_amount', 'row' => null];
        }

        $merchant = isset($raw['merchant_name']) ? trim((string) $raw['merchant_name']) : '';
        $notes = isset($raw['notes']) ? trim((string) $raw['notes']) : '';
        $currency = isset($raw['currency']) ? strtoupper(trim((string) $raw['currency'])) : '';

        return [
            'ok' => true,
            'error' => null,
            'row' => [
                'date' => $date,
                'name' => $name,
                'merchant_name' => $merchant !== '' ? mb_substr($merchant, 0, 255) : null,
                'amount' => round($amount, 2),
                'notes' => $notes !== '' ? $notes : null,
                'currency' => preg_match('/^[A-Z]{3}$/', $currency) ? $currency : null,
            ],
        ];
    }

    /**
     * Load existing transaction fingerprints for an account across the date range
     * covered by the import, so duplicates can be detected without N queries.
     * Returns a set keyed by "date|amount|normalized name".
     */
    public static function loadFingerprints(PDO $pdo, string $accountId, array $dates): array {
        if (empty($dates)) return [];
        $min = min($dates);
        $max = max($dates);

        $stmt = $pdo->prepare('
            SELECT date, amount, name
            FROM transactions
            WHERE account_id = :account_id AND date BETWEEN :min AND :max
        ');
        $stmt->execute(['account_id' => $accountId, 'min' => $min, 'max' => $max]);

        $set = [];
        foreach ($stmt->fetchAll() as $row) {
            $set[self::fingerprint($row['date'], (float) $row['amount'], $row['name'])] = true;
        }
        return $set;
    }

    public static function fingerprint(string $date, float $amount, string $name): string {
        return substr($date, 0, 10) . '|' . number_format($amount, 2, '.', '') . '|' . self::normalizeName($name);
    }
}
