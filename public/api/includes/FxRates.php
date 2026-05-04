<?php
/**
 * FxRates — Foreign exchange rate helper.
 *
 * Uses the Bank of Canada Valet API (free, no key) to convert foreign currencies
 * to CAD. Rates are cached in the `fx_rates` table by (currency_code, rate_date).
 *
 * Endpoint: https://www.bankofcanada.ca/valet/observations/FX{CCY}CAD/json
 *   FX{USD,EUR,GBP,JPY,...}CAD series, daily observations, business days only.
 *   We fall back to the most recent observation on/before the requested date.
 */
class FxRates {
    /** Currencies the Bank of Canada publishes daily noon rates for (against CAD). */
    private const SUPPORTED = [
        'USD','EUR','GBP','JPY','CHF','AUD','CNY','HKD','INR','KRW',
        'MXN','NZD','NOK','SEK','SGD','TRY','ZAR','BRL','RUB','IDR',
        'PEN','VND','MYR'
    ];

    /**
     * Convert an amount from $fromCcy to CAD on a given date.
     * Returns ['cad_amount' => float, 'rate' => float] or null on failure.
     * If $fromCcy is CAD, returns rate=1.0.
     */
    public static function convertToCad(PDO $pdo, float $amount, string $fromCcy, string $date): ?array {
        $fromCcy = strtoupper(trim($fromCcy));
        if ($fromCcy === '' || $fromCcy === 'CAD') {
            return ['cad_amount' => round($amount, 2), 'rate' => 1.0];
        }
        $rate = self::getRate($pdo, $fromCcy, $date);
        if ($rate === null) return null;
        return ['cad_amount' => round($amount * $rate, 2), 'rate' => $rate];
    }

    /**
     * Get the CAD value of 1 unit of $ccy on $date (or the most recent
     * business day on/before that date). Caches successful lookups.
     */
    public static function getRate(PDO $pdo, string $ccy, string $date): ?float {
        $ccy = strtoupper(trim($ccy));
        if ($ccy === 'CAD') return 1.0;
        if (!in_array($ccy, self::SUPPORTED, true)) {
            error_log("FxRates: unsupported currency {$ccy}");
            return null;
        }

        // 1) Cached exact date?
        $stmt = $pdo->prepare('SELECT rate FROM fx_rates WHERE currency_code = :c AND rate_date = :d');
        $stmt->execute(['c' => $ccy, 'd' => $date]);
        $cached = $stmt->fetchColumn();
        if ($cached !== false) return (float)$cached;

        // 2) Cached most-recent before date?
        $stmt = $pdo->prepare('SELECT rate, rate_date FROM fx_rates WHERE currency_code = :c AND rate_date <= :d ORDER BY rate_date DESC LIMIT 1');
        $stmt->execute(['c' => $ccy, 'd' => $date]);
        $row = $stmt->fetch();
        $cachedRecent = $row ? (float)$row['rate'] : null;
        $cachedRecentDate = $row ? $row['rate_date'] : null;

        // 3) Fetch a window from Bank of Canada (10 days back through date) to populate cache
        $start = date('Y-m-d', strtotime($date . ' -14 days'));
        $end = $date;
        $series = "FX{$ccy}CAD";
        $url = "https://www.bankofcanada.ca/valet/observations/{$series}/json?start_date={$start}&end_date={$end}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 8,
        ]);
        $resp = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http !== 200 || !$resp) {
            error_log("FxRates: BoC fetch failed http={$http} url={$url}");
            return $cachedRecent; // best-effort fallback
        }
        $data = json_decode($resp, true);
        $observations = $data['observations'] ?? [];
        if (!$observations) return $cachedRecent;

        $insStmt = $pdo->prepare('INSERT IGNORE INTO fx_rates (currency_code, rate_date, rate) VALUES (:c, :d, :r)');
        $latestForDate = null;
        foreach ($observations as $obs) {
            $obsDate = $obs['d'] ?? null;
            $obsRate = $obs[$series]['v'] ?? null;
            if (!$obsDate || $obsRate === null || $obsRate === '') continue;
            $insStmt->execute(['c' => $ccy, 'd' => $obsDate, 'r' => $obsRate]);
            if ($obsDate <= $date) $latestForDate = (float)$obsRate;
        }
        return $latestForDate ?? $cachedRecent;
    }
}
