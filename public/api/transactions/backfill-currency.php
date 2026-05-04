<?php
/**
 * Backfill currency / FX conversion for existing transactions.
 * POST /api/transactions/backfill-currency.php
 * Body: { "dry_run": true|false }
 *
 * Strategy: we cannot ask Plaid for historical iso_currency_code via /sync
 * without re-fetching, so we use the account's currency as a heuristic:
 *   - For accounts whose currency != CAD, treat the stored `amount` as the
 *     original foreign-currency amount and convert to CAD using the
 *     transaction date's BoC rate.
 *   - We skip rows that already have iso_currency_code set, or that have
 *     amount_overridden = 1.
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/FxRates.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    $dryRun = !empty($body['dry_run']);

    $pdo = Database::getConnection();

    $stmt = $pdo->prepare("
        SELECT t.id, t.date, t.amount, t.name, a.currency AS account_currency
        FROM transactions t
        INNER JOIN accounts a ON t.account_id = a.id
        WHERE a.user_id = :user_id
          AND t.iso_currency_code IS NULL
          AND COALESCE(t.amount_overridden, 0) = 0
          AND a.currency IS NOT NULL
          AND UPPER(a.currency) <> 'CAD'
    ");
    $stmt->execute(['user_id' => $userId]);
    $rows = $stmt->fetchAll();

    $converted = 0;
    $skipped = 0;
    $previews = [];

    if (!$dryRun) {
        $upd = $pdo->prepare('
            UPDATE transactions
            SET amount = :cad, iso_currency_code = :ccy, original_amount = :orig, fx_rate = :rate, updated_at = NOW()
            WHERE id = :id
        ');
    }

    foreach ($rows as $r) {
        $ccy = strtoupper($r['account_currency']);
        $conv = FxRates::convertToCad($pdo, (float)$r['amount'], $ccy, $r['date']);
        if (!$conv) { $skipped++; continue; }

        if ($dryRun) {
            if (count($previews) < 50) {
                $previews[] = [
                    'id' => $r['id'],
                    'name' => $r['name'],
                    'date' => $r['date'],
                    'currency' => $ccy,
                    'original_amount' => (float)$r['amount'],
                    'cad_amount' => $conv['cad_amount'],
                    'rate' => $conv['rate'],
                ];
            }
        } else {
            $upd->execute([
                'cad' => $conv['cad_amount'],
                'ccy' => $ccy,
                'orig' => (float)$r['amount'],
                'rate' => $conv['rate'],
                'id' => $r['id'],
            ]);
        }
        $converted++;
    }

    Response::success([
        'dry_run' => $dryRun,
        'converted' => $converted,
        'skipped' => $skipped,
        'total_candidates' => count($rows),
        'preview' => $previews,
    ], $dryRun ? 'Backfill preview' : 'Backfill complete');
} catch (Exception $e) {
    Response::error('Backfill failed: ' . $e->getMessage(), 500);
}
