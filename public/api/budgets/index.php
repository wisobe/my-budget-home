<?php
/**
 * Budgets CRUD Endpoint (per-user)
 * GET    /api/budgets/ - List budgets with spent amounts for current period
 * POST   /api/budgets/ - Create or update a budget
 * PUT    /api/budgets/ - Update a budget
 * DELETE /api/budgets/ - Delete a budget
 */

require_once __DIR__ . '/../includes/bootstrap.php';

/**
 * Calculate the date range for a budget period relative to a reference date.
 */
function getPeriodRange(string $period, string $refDate = null): array {
    $ref = $refDate ? new DateTime($refDate) : new DateTime();
    
    switch ($period) {
        case 'weekly':
            $start = (clone $ref)->modify('monday this week');
            $end = (clone $start)->modify('+6 days');
            break;
        case 'yearly':
            $start = new DateTime($ref->format('Y') . '-01-01');
            $end = new DateTime($ref->format('Y') . '-12-31');
            break;
        case 'monthly':
        default:
            $start = new DateTime($ref->format('Y-m') . '-01');
            $end = (clone $start)->modify('last day of this month');
            break;
    }
    
    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

try {
    $userId = getCurrentUserId();
    $pdo = Database::getConnection();
    $environment = getPlaidEnvironment();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // List all budgets with spent amounts
        $stmt = $pdo->prepare('
            SELECT b.*, c.name AS category_name, c.color AS category_color, c.parent_id, c.is_income
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = :uid AND b.plaid_environment = :env
            ORDER BY c.is_income ASC, c.name ASC
        ');
        $stmt->execute(['uid' => $userId, 'env' => $environment]);
        $budgets = $stmt->fetchAll();

        // Calculate spent for each budget based on its period
        foreach ($budgets as &$budget) {
            [$startDate, $endDate] = getPeriodRange($budget['period']);
            $budget['period_start'] = $startDate;
            $budget['period_end'] = $endDate;

            // Get spent: sum of transactions in this category (and child categories) for the period
            // For expense categories, amount > 0 means spending
            // For income categories, amount < 0 means income received
            $spentStmt = $pdo->prepare('
                SELECT COALESCE(SUM(ABS(t.amount)), 0) as spent
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE a.user_id = :uid
                  AND t.excluded = 0
                  AND t.date BETWEEN :start AND :end
                  AND (
                    t.category_id = :cat_id
                    OR t.category_id IN (SELECT id FROM categories WHERE parent_id = :cat_id2)
                  )
            ');
            $spentStmt->execute([
                'uid' => $userId,
                'start' => $startDate,
                'end' => $endDate,
                'cat_id' => $budget['category_id'],
                'cat_id2' => $budget['category_id'],
            ]);
            $budget['spent'] = (float)$spentStmt->fetchColumn();

            // Also account for splits assigned to this category
            $splitStmt = $pdo->prepare('
                SELECT COALESCE(SUM(ABS(ts.amount)), 0) as split_spent
                FROM transaction_splits ts
                JOIN transactions t ON ts.transaction_id = t.id
                JOIN accounts a ON t.account_id = a.id
                WHERE a.user_id = :uid
                  AND ts.is_excluded = 0
                  AND t.date BETWEEN :start AND :end
                  AND (
                    ts.category_id = :cat_id
                    OR ts.category_id IN (SELECT id FROM categories WHERE parent_id = :cat_id2)
                  )
                  AND t.id IN (SELECT transaction_id FROM transaction_splits)
            ');
            $splitStmt->execute([
                'uid' => $userId,
                'start' => $startDate,
                'end' => $endDate,
                'cat_id' => $budget['category_id'],
                'cat_id2' => $budget['category_id'],
            ]);
            // For split transactions, use split amounts instead of transaction amount
            // We need to subtract the main transaction amount if it was already counted and has splits
            $splitSpent = (float)$splitStmt->fetchColumn();
            
            // Get the sum of main transactions that HAVE splits (to avoid double counting)
            $mainWithSplitsStmt = $pdo->prepare('
                SELECT COALESCE(SUM(ABS(t.amount)), 0) as main_spent
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE a.user_id = :uid
                  AND t.excluded = 0
                  AND t.date BETWEEN :start AND :end
                  AND (
                    t.category_id = :cat_id
                    OR t.category_id IN (SELECT id FROM categories WHERE parent_id = :cat_id2)
                  )
                  AND t.id IN (SELECT transaction_id FROM transaction_splits)
            ');
            $mainWithSplitsStmt->execute([
                'uid' => $userId,
                'start' => $startDate,
                'end' => $endDate,
                'cat_id' => $budget['category_id'],
                'cat_id2' => $budget['category_id'],
            ]);
            $mainWithSplits = (float)$mainWithSplitsStmt->fetchColumn();
            
            // Final spent = (transactions without splits) + (split amounts for this category)
            $budget['spent'] = $budget['spent'] - $mainWithSplits + $splitSpent;
            
            $budget['amount'] = (float)$budget['amount'];
            $budget['percentage'] = $budget['amount'] > 0 
                ? round(($budget['spent'] / $budget['amount']) * 100, 1) 
                : 0;
        }
        unset($budget);

        Response::success($budgets);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $body = getJsonBody();
        validateRequired($body, ['category_id', 'amount', 'period']);

        if (!in_array($body['period'], ['weekly', 'monthly', 'yearly'])) {
            Response::error('Invalid period. Must be weekly, monthly, or yearly.');
        }

        // Validate category belongs to user
        $catStmt = $pdo->prepare('SELECT id FROM categories WHERE id = :id AND user_id = :uid');
        $catStmt->execute(['id' => $body['category_id'], 'uid' => $userId]);
        if (!$catStmt->fetch()) {
            Response::error('Category not found', 404);
        }

        // Check for existing budget with same category+period
        $existsStmt = $pdo->prepare('
            SELECT id FROM budgets WHERE user_id = :uid AND category_id = :cat AND period = :period AND plaid_environment = :env
        ');
        $existsStmt->execute(['uid' => $userId, 'cat' => $body['category_id'], 'period' => $body['period'], 'env' => $environment]);
        $existing = $existsStmt->fetch();

        if ($existing) {
            // Update existing
            $stmt = $pdo->prepare('UPDATE budgets SET amount = :amount WHERE id = :id');
            $stmt->execute(['amount' => $body['amount'], 'id' => $existing['id']]);
            $id = $existing['id'];
        } else {
            $id = 'bgt_' . uniqid();
            $stmt = $pdo->prepare('
                INSERT INTO budgets (id, user_id, category_id, amount, period, plaid_environment)
                VALUES (:id, :uid, :cat, :amount, :period, :env)
            ');
            $stmt->execute([
                'id' => $id,
                'uid' => $userId,
                'cat' => $body['category_id'],
                'amount' => $body['amount'],
                'period' => $body['period'],
                'env' => $environment,
            ]);
        }

        $fetchStmt = $pdo->prepare('
            SELECT b.*, c.name AS category_name, c.color AS category_color 
            FROM budgets b JOIN categories c ON b.category_id = c.id 
            WHERE b.id = :id
        ');
        $fetchStmt->execute(['id' => $id]);
        Response::success($fetchStmt->fetch());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $body = getJsonBody();
        if (empty($body['id'])) {
            Response::error('Budget ID is required');
        }

        $checkStmt = $pdo->prepare('SELECT * FROM budgets WHERE id = :id AND user_id = :uid');
        $checkStmt->execute(['id' => $body['id'], 'uid' => $userId]);
        if (!$checkStmt->fetch()) {
            Response::error('Budget not found', 404);
        }

        $fields = [];
        $params = ['id' => $body['id']];

        if (isset($body['amount'])) { $fields[] = 'amount = :amount'; $params['amount'] = $body['amount']; }
        if (isset($body['category_id'])) { 
            $catStmt = $pdo->prepare('SELECT id FROM categories WHERE id = :id AND user_id = :uid');
            $catStmt->execute(['id' => $body['category_id'], 'uid' => $userId]);
            if (!$catStmt->fetch()) Response::error('Category not found', 404);
            $fields[] = 'category_id = :cat'; $params['cat'] = $body['category_id']; 
        }
        if (isset($body['period'])) { $fields[] = 'period = :period'; $params['period'] = $body['period']; }

        if (empty($fields)) Response::error('No fields to update');

        $sql = 'UPDATE budgets SET ' . implode(', ', $fields) . ' WHERE id = :id';
        $pdo->prepare($sql)->execute($params);

        $fetchStmt = $pdo->prepare('
            SELECT b.*, c.name AS category_name, c.color AS category_color 
            FROM budgets b JOIN categories c ON b.category_id = c.id 
            WHERE b.id = :id
        ');
        $fetchStmt->execute(['id' => $body['id']]);
        Response::success($fetchStmt->fetch());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $body = getJsonBody();
        if (empty($body['id'])) {
            Response::error('Budget ID is required');
        }

        $checkStmt = $pdo->prepare('SELECT id FROM budgets WHERE id = :id AND user_id = :uid');
        $checkStmt->execute(['id' => $body['id'], 'uid' => $userId]);
        if (!$checkStmt->fetch()) {
            Response::error('Budget not found', 404);
        }

        $pdo->prepare('DELETE FROM budgets WHERE id = :id')->execute(['id' => $body['id']]);
        Response::success(null);

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
