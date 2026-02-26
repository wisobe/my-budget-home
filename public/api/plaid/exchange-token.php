<?php
/**
 * Plaid Token Exchange Endpoint
 * POST /api/plaid/exchange-token.php
 * 
 * Exchanges a public token from Plaid Link for an access token
 * Associates connection with authenticated user
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['public_token', 'institution_id']);
    
    $environment = $body['plaid_environment'] ?? 'sandbox';
    $plaid = getPlaidClient($environment);
    
    // Exchange public token for access token
    $exchangeResult = $plaid->exchangePublicToken($body['public_token']);
    $accessToken = $exchangeResult['access_token'];
    $itemId = $exchangeResult['item_id'];
    
    // Get institution details
    $institution = $plaid->getInstitution($body['institution_id']);
    $institutionName = $institution['institution']['name'] ?? 'Unknown';
    
    // Get accounts
    $accountsResult = $plaid->getAccounts($accessToken);
    
    $pdo = Database::getConnection();
    
    // Insert plaid connection with user_id
    $connectionId = 'conn_' . uniqid();
    $stmt = $pdo->prepare('
        INSERT INTO plaid_connections (
            id, user_id, institution_id, institution_name, access_token_encrypted, 
            item_id, status, plaid_environment, created_at
        ) VALUES (
            :id, :user_id, :institution_id, :institution_name, :access_token,
            :item_id, :status, :plaid_environment, NOW()
        )
    ');
    $stmt->execute([
        'id' => $connectionId,
        'user_id' => $userId,
        'institution_id' => $body['institution_id'],
        'institution_name' => $institutionName,
        'access_token' => $accessToken,
        'item_id' => $itemId,
        'status' => 'active',
        'plaid_environment' => $environment,
    ]);
    
    // Insert accounts with user_id
    foreach ($accountsResult['accounts'] as $account) {
        $accountStmt = $pdo->prepare('
            INSERT INTO accounts (
                id, user_id, plaid_account_id, plaid_connection_id, name, official_name,
                type, subtype, current_balance, available_balance, currency,
                institution_name, created_at
            ) VALUES (
                :id, :user_id, :plaid_account_id, :plaid_connection_id, :name, :official_name,
                :type, :subtype, :current_balance, :available_balance, :currency,
                :institution_name, NOW()
            )
            ON DUPLICATE KEY UPDATE
                current_balance = :current_balance2,
                available_balance = :available_balance2,
                last_synced = NOW()
        ');
        
        $accountStmt->execute([
            'id' => 'acc_' . uniqid(),
            'user_id' => $userId,
            'plaid_account_id' => $account['account_id'],
            'plaid_connection_id' => $connectionId,
            'name' => $account['name'],
            'official_name' => $account['official_name'] ?? null,
            'type' => $account['type'],
            'subtype' => $account['subtype'] ?? null,
            'current_balance' => $account['balances']['current'] ?? 0,
            'available_balance' => $account['balances']['available'] ?? null,
            'currency' => $account['balances']['iso_currency_code'] ?? 'CAD',
            'institution_name' => $institutionName,
            'current_balance2' => $account['balances']['current'] ?? 0,
            'available_balance2' => $account['balances']['available'] ?? null,
        ]);
    }
    
    Response::success([
        'id' => $connectionId,
        'institution_id' => $body['institution_id'],
        'institution_name' => $institutionName,
        'status' => 'active',
        'plaid_environment' => $environment,
        'accounts_count' => count($accountsResult['accounts']),
        'created_at' => date('c'),
    ]);
} catch (PlaidApiException $e) {
    Response::error('Failed to exchange token: ' . $e->getMessage(), 500, $e->toArray());
} catch (Exception $e) {
    Response::error('Failed to exchange token: ' . $e->getMessage(), 500);
}
