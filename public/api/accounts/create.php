<?php
/**
 * Create Manual Account Endpoint
 * POST /api/accounts/create.php
 * Body: { "name", "type", "currency"?, "institution_name"?, "current_balance"? }
 *
 * Manual accounts have no Plaid connection and are never touched by sync.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$ALLOWED_TYPES = ['checking', 'savings', 'credit', 'investment', 'depository', 'loan', 'other'];

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();
    validateRequired($body, ['name', 'type']);

    $name = trim((string) $body['name']);
    if ($name === '' || mb_strlen($name) > 255) {
        Response::error('Account name must be between 1 and 255 characters');
    }

    $type = (string) $body['type'];
    if (!in_array($type, $ALLOWED_TYPES, true)) {
        Response::error('Invalid account type');
    }

    $currency = strtoupper(trim((string) ($body['currency'] ?? 'CAD')));
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        Response::error('Invalid currency code');
    }

    $institution = trim((string) ($body['institution_name'] ?? ''));
    if (mb_strlen($institution) > 255) {
        $institution = mb_substr($institution, 0, 255);
    }

    $balance = isset($body['current_balance']) ? (float) $body['current_balance'] : 0.0;

    $pdo = Database::getConnection();
    $id = 'acc_' . uniqid('', true);

    $stmt = $pdo->prepare('
        INSERT INTO accounts
            (id, user_id, plaid_account_id, plaid_connection_id, name, type, currency,
             institution_name, current_balance, available_balance, excluded, created_at)
        VALUES
            (:id, :user_id, NULL, NULL, :name, :type, :currency,
             :institution_name, :current_balance, :current_balance2, 0, NOW())
    ');
    $stmt->execute([
        'id' => $id,
        'user_id' => $userId,
        'name' => $name,
        'type' => $type,
        'currency' => $currency,
        'institution_name' => $institution !== '' ? $institution : 'Manual',
        'current_balance' => $balance,
        'current_balance2' => $balance,
    ]);

    $fetch = $pdo->prepare('SELECT * FROM accounts WHERE id = :id');
    $fetch->execute(['id' => $id]);

    Response::success($fetch->fetch(), 'Account created');
} catch (Exception $e) {
    Response::error('Failed to create account: ' . $e->getMessage(), 500);
}
