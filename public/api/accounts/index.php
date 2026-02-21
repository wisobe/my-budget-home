<?php
/**
 * Accounts Endpoint
 * GET  /api/accounts/index.php - List accounts
 * PUT  /api/accounts/index.php - Update account (e.g. toggle excluded)
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $environment = $_GET['plaid_environment'] ?? 'sandbox';
        if (!in_array($environment, ['sandbox', 'production'])) {
            $environment = 'sandbox';
        }

        $stmt = $pdo->prepare('
            SELECT a.* FROM accounts a
            LEFT JOIN plaid_connections c ON a.plaid_connection_id = c.id
            WHERE (c.plaid_environment = :environment OR a.plaid_connection_id IS NULL)
              AND a.user_id = :user_id
            ORDER BY a.institution_name, a.type, a.name
        ');
        $stmt->execute(['environment' => $environment, 'user_id' => $userId]);
        
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $body = getJsonBody();
        validateRequired($body, ['id']);

        // Verify ownership
        $checkStmt = $pdo->prepare('SELECT id FROM accounts WHERE id = :id AND user_id = :user_id');
        $checkStmt->execute(['id' => $body['id'], 'user_id' => $userId]);
        if (!$checkStmt->fetch()) {
            Response::notFound('Account not found');
        }

        $sets = [];
        $params = ['id' => $body['id']];

        if (array_key_exists('excluded', $body)) {
            $sets[] = 'excluded = :excluded';
            $params['excluded'] = $body['excluded'] ? 1 : 0;
        }

        if (empty($sets)) {
            Response::error('Nothing to update');
        }

        $pdo->prepare('UPDATE accounts SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);

        $fetchStmt = $pdo->prepare('SELECT * FROM accounts WHERE id = :id');
        $fetchStmt->execute(['id' => $body['id']]);
        Response::success($fetchStmt->fetch());

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
