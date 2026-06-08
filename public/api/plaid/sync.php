<?php
/**
 * Plaid Transaction Sync Endpoint
 * POST /api/plaid/sync.php
 * 
 * Syncs transactions for a specific Plaid connection (owned by authenticated user)
 */

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/AutoCategorizer.php';
require_once __DIR__ . '/../includes/AutoExcluder.php';
require_once __DIR__ . '/../includes/FxRates.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['connection_id']);
    
    $environment = getPlaidEnvironment();
    $pdo = Database::getConnection();
    $plaid = getPlaidClient($environment);
    
    // Get connection - verify ownership
    $stmt = $pdo->prepare('
        SELECT id, access_token_encrypted, sync_cursor 
        FROM plaid_connections 
        WHERE id = :id AND user_id = :user_id
    ');
    $stmt->execute(['id' => $body['connection_id'], 'user_id' => $userId]);
    $connection = $stmt->fetch();
    
    if (!$connection) {
        Response::notFound('Connection not found');
    }
    
    $accessToken = $connection['access_token_encrypted'];
    $cursor = $connection['sync_cursor'];
    
    $added = 0;
    $modified = 0;
    $removed = 0;
    $hasMore = true;
    
    while ($hasMore) {
        $syncResult = $plaid->syncTransactions($accessToken, $cursor);
        
        foreach ($syncResult['added'] as $tx) {
            $accountStmt = $pdo->prepare('
                SELECT id FROM accounts WHERE plaid_account_id = :plaid_account_id AND user_id = :user_id
            ');
            $accountStmt->execute(['plaid_account_id' => $tx['account_id'], 'user_id' => $userId]);
            $account = $accountStmt->fetch();
            
            if ($account) {
                $autoCategoryId = AutoCategorizer::match($pdo, $tx['name'], $tx['merchant_name'] ?? null, $userId, $environment);
                $autoExclude = AutoExcluder::shouldExclude($pdo, $tx['name'], $tx['merchant_name'] ?? null, $userId, $environment);

                // Currency conversion: convert non-CAD amounts to CAD using BoC rates.
                $isoCurrency = $tx['iso_currency_code'] ?? ($tx['unofficial_currency_code'] ?? null);
                $rawAmount = (float)$tx['amount'];
                $cadAmount = $rawAmount;
                $originalAmount = null;
                $fxRate = null;
                if ($isoCurrency && strtoupper($isoCurrency) !== 'CAD') {
                    $conv = FxRates::convertToCad($pdo, $rawAmount, $isoCurrency, $tx['date']);
                    if ($conv) {
                        $cadAmount = $conv['cad_amount'];
                        $originalAmount = $rawAmount;
                        $fxRate = $conv['rate'];
                    }
                }

                $insertStmt = $pdo->prepare('
                    INSERT INTO transactions (
                        id, plaid_transaction_id, account_id, date, name,
                        merchant_name, amount, iso_currency_code, original_amount, fx_rate,
                        category_id, pending, excluded, created_at, updated_at
                    ) VALUES (
                        :id, :plaid_tx_id, :account_id, :date, :name,
                        :merchant_name, :amount, :iso_ccy, :orig_amount, :fx_rate,
                        :category_id, :pending, :excluded, NOW(), NOW()
                    )
                    ON DUPLICATE KEY UPDATE
                        amount = IF(amount_overridden = 1, amount, :amount2),
                        iso_currency_code = :iso_ccy2,
                        original_amount = IF(amount_overridden = 1, original_amount, :orig_amount2),
                        fx_rate = IF(amount_overridden = 1, fx_rate, :fx_rate2),
                        pending = :pending2,
                        updated_at = NOW()
                ');

                $insertStmt->execute([
                    'id' => 'tx_' . uniqid(),
                    'plaid_tx_id' => $tx['transaction_id'],
                    'account_id' => $account['id'],
                    'date' => $tx['date'],
                    'name' => $tx['name'],
                    'merchant_name' => $tx['merchant_name'] ?? null,
                    'amount' => $cadAmount,
                    'iso_ccy' => $isoCurrency,
                    'orig_amount' => $originalAmount,
                    'fx_rate' => $fxRate,
                    'category_id' => $autoCategoryId,
                    'pending' => $tx['pending'] ? 1 : 0,
                    'excluded' => $autoExclude ? 1 : 0,
                    'amount2' => $cadAmount,
                    'iso_ccy2' => $isoCurrency,
                    'orig_amount2' => $originalAmount,
                    'fx_rate2' => $fxRate,
                    'pending2' => $tx['pending'] ? 1 : 0,
                ]);
                $added++;
            }
        }

        foreach ($syncResult['modified'] as $tx) {
            $isoCurrency = $tx['iso_currency_code'] ?? ($tx['unofficial_currency_code'] ?? null);
            $rawAmount = (float)$tx['amount'];
            $cadAmount = $rawAmount;
            $originalAmount = null;
            $fxRate = null;
            if ($isoCurrency && strtoupper($isoCurrency) !== 'CAD') {
                $conv = FxRates::convertToCad($pdo, $rawAmount, $isoCurrency, $tx['date']);
                if ($conv) {
                    $cadAmount = $conv['cad_amount'];
                    $originalAmount = $rawAmount;
                    $fxRate = $conv['rate'];
                }
            }
            $updateStmt = $pdo->prepare('
                UPDATE transactions SET
                    amount = IF(amount_overridden = 1, amount, :amount),
                    iso_currency_code = :iso_ccy,
                    original_amount = IF(amount_overridden = 1, original_amount, :orig_amount),
                    fx_rate = IF(amount_overridden = 1, fx_rate, :fx_rate),
                    pending = :pending,
                    name = :name,
                    updated_at = NOW()
                WHERE plaid_transaction_id = :plaid_tx_id
            ');
            $updateStmt->execute([
                'amount' => $cadAmount,
                'iso_ccy' => $isoCurrency,
                'orig_amount' => $originalAmount,
                'fx_rate' => $fxRate,
                'pending' => $tx['pending'] ? 1 : 0,
                'name' => $tx['name'],
                'plaid_tx_id' => $tx['transaction_id'],
            ]);
            $modified++;
        }
        
        foreach ($syncResult['removed'] as $tx) {
            $deleteStmt = $pdo->prepare('
                DELETE FROM transactions WHERE plaid_transaction_id = :plaid_tx_id
            ');
            $deleteStmt->execute(['plaid_tx_id' => $tx['transaction_id']]);
            $removed++;
        }
        
        $cursor = $syncResult['next_cursor'];
        $hasMore = $syncResult['has_more'];
    }
    
    // Update connection
    $updateConnStmt = $pdo->prepare('
        UPDATE plaid_connections SET
            sync_cursor = :cursor,
            last_synced = NOW(),
            status = :status,
            error_message = NULL
        WHERE id = :id AND user_id = :user_id
    ');
    $updateConnStmt->execute([
        'cursor' => $cursor,
        'status' => 'active',
        'id' => $body['connection_id'],
        'user_id' => $userId,
    ]);
    
    // Update account balances & discover new accounts
    $accountsUpdated = 0;
    try {
        $accountsResult = $plaid->getAccounts($accessToken);
        
        // Get institution name for potential new accounts
        $instStmt = $pdo->prepare('SELECT institution_name FROM plaid_connections WHERE id = :id');
        $instStmt->execute(['id' => $body['connection_id']]);
        $institutionName = $instStmt->fetchColumn() ?: 'Unknown';
        
        foreach ($accountsResult['accounts'] as $account) {
            $checkStmt = $pdo->prepare('SELECT id FROM accounts WHERE plaid_account_id = :plaid_account_id AND user_id = :user_id');
            $checkStmt->execute(['plaid_account_id' => $account['account_id'], 'user_id' => $userId]);
            $existingAccount = $checkStmt->fetch();
            
            if ($existingAccount) {
                $updateAccStmt = $pdo->prepare('
                    UPDATE accounts SET
                        current_balance = :current_balance,
                        available_balance = :available_balance,
                        last_synced = NOW()
                    WHERE plaid_account_id = :plaid_account_id AND user_id = :user_id
                ');
                $updateAccStmt->execute([
                    'current_balance' => $account['balances']['current'] ?? 0,
                    'available_balance' => $account['balances']['available'] ?? null,
                    'plaid_account_id' => $account['account_id'],
                    'user_id' => $userId,
                ]);
            } else {
                $insertAccStmt = $pdo->prepare('
                    INSERT INTO accounts (
                        id, user_id, plaid_account_id, plaid_connection_id, name, official_name,
                        type, subtype, current_balance, available_balance, currency,
                        institution_name, created_at, last_synced
                    ) VALUES (
                        :id, :user_id, :plaid_account_id, :plaid_connection_id, :name, :official_name,
                        :type, :subtype, :current_balance, :available_balance, :currency,
                        :institution_name, NOW(), NOW()
                    )
                ');
                $insertAccStmt->execute([
                    'id' => 'acc_' . uniqid(),
                    'user_id' => $userId,
                    'plaid_account_id' => $account['account_id'],
                    'plaid_connection_id' => $body['connection_id'],
                    'name' => $account['name'],
                    'official_name' => $account['official_name'] ?? null,
                    'type' => $account['type'],
                    'subtype' => $account['subtype'] ?? null,
                    'current_balance' => $account['balances']['current'] ?? 0,
                    'available_balance' => $account['balances']['available'] ?? null,
                    'currency' => $account['balances']['iso_currency_code'] ?? 'CAD',
                    'institution_name' => $institutionName,
                ]);
            }
            $accountsUpdated++;
        }
    } catch (Exception $accEx) {
        // Account discovery/balance update failed — don't break the sync
    }
    
    Response::success([
        'added' => $added,
        'modified' => $modified,
        'removed' => $removed,
        'accounts_updated' => $accountsUpdated,
    ]);
} catch (Exception $e) {
    if (isset($body['connection_id'])) {
        try {
            $pdo = Database::getConnection();

            // Classify the error so we only force a re-login when Plaid actually
            // requires it. Transient bank-side issues keep the connection "active"
            // and will simply be retried on the next sync — this avoids prompting
            // the user to re-link for things like INSTITUTION_DOWN.
            $reauthCodes = [
                'ITEM_LOGIN_REQUIRED',
                'PENDING_EXPIRATION',
                'PENDING_DISCONNECT',
                'USER_PERMISSION_REVOKED',
                'ACCESS_NOT_GRANTED',
                'NEW_CONSENT_REQUIRED',
                'ITEM_LOCKED',
            ];
            $transientCodes = [
                'INSTITUTION_DOWN',
                'INSTITUTION_NOT_RESPONDING',
                'INSTITUTION_NOT_AVAILABLE',
                'INSTITUTION_NO_LONGER_SUPPORTED',
                'RATE_LIMIT_EXCEEDED',
                'INTERNAL_SERVER_ERROR',
                'PLANNED_MAINTENANCE',
                'API_ERROR',
                'NO_ACCOUNTS',
            ];

            $errorCode = null;
            $errorType = null;
            $errorText = $e->getMessage();
            if ($e instanceof PlaidApiException) {
                $errorCode = $e->errorCode;
                $errorType = $e->errorType;
            }

            $needsReauth = $errorCode && in_array($errorCode, $reauthCodes, true);
            $isTransient = !$needsReauth; // anything not explicitly reauth = treat as transient
            // Only flip to 'error' (and prompt user to re-link) when Plaid explicitly says so.
            $status = $needsReauth ? 'error' : 'active';

            $payload = json_encode([
                'code' => $errorCode,
                'type' => $errorType,
                'message' => $errorText,
                'transient' => $isTransient,
                'needs_reauth' => $needsReauth,
                'at' => date('c'),
            ]);

            $errorStmt = $pdo->prepare('
                UPDATE plaid_connections SET status = :status, error_message = :error WHERE id = :id
            ');
            $errorStmt->execute([
                'status' => $status,
                'error' => $payload,
                'id' => $body['connection_id'],
            ]);
        } catch (Exception $innerEx) {}
    }

    if ($e instanceof PlaidApiException) {
        Response::error('Failed to sync transactions: ' . $e->getMessage(), 500, $e->toArray());
    } else {
        Response::error('Failed to sync transactions: ' . $e->getMessage(), 500);
    }
}
