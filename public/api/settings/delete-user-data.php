<?php
/**
 * Delete User Data Endpoint
 * POST /api/settings/delete-user-data.php
 * 
 * Securely deletes all user financial data (transactions, accounts, connections, budgets, splits, rules).
 * Requires password confirmation. Does NOT delete the user account itself.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

try {
    $userId = getCurrentUserId();
    $body = getJsonBody();

    if (empty($body['password'])) {
        Response::error('Password is required', 400);
    }

    $pdo = Database::getConnection();

    // Verify password
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = :id");
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($body['password'], $user['password_hash'])) {
        Response::error('Invalid password', 403);
    }

    // Delete all user data in proper order (respecting FK constraints)
    $pdo->beginTransaction();

    try {
        // 1. Delete transaction splits (references transactions)
        $pdo->prepare("DELETE ts FROM transaction_splits ts INNER JOIN transactions t ON ts.transaction_id = t.id WHERE t.user_id = :uid")->execute(['uid' => $userId]);

        // 2. Delete transactions
        $pdo->prepare("DELETE FROM transactions WHERE user_id = :uid")->execute(['uid' => $userId]);

        // 3. Delete accounts
        $pdo->prepare("DELETE FROM accounts WHERE user_id = :uid")->execute(['uid' => $userId]);

        // 4. Delete plaid connections
        $pdo->prepare("DELETE FROM plaid_connections WHERE user_id = :uid")->execute(['uid' => $userId]);

        // 5. Delete budgets
        $pdo->prepare("DELETE FROM budgets WHERE user_id = :uid")->execute(['uid' => $userId]);

        // 6. Delete category rules
        $pdo->prepare("DELETE FROM category_rules WHERE user_id = :uid")->execute(['uid' => $userId]);

        // 7. Delete user categories
        $pdo->prepare("DELETE FROM categories WHERE user_id = :uid")->execute(['uid' => $userId]);

        $pdo->commit();

        Response::success(['deleted' => true, 'message' => 'All financial data has been securely deleted']);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
