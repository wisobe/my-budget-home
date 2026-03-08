<?php
/**
 * Audit Log Endpoint (Admin only)
 * GET /api/audit/index.php?page=1&per_page=50&event_type=login_success&user_id=...&start_date=...&end_date=...&search=...
 */

require_once __DIR__ . '/../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

try {
    requireAdmin();
    $pdo = Database::getConnection();

    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int)($_GET['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;

    $where = [];
    $params = [];

    if (!empty($_GET['event_type'])) {
        $where[] = 'a.event_type = :event_type';
        $params['event_type'] = $_GET['event_type'];
    }

    if (!empty($_GET['user_id'])) {
        $where[] = '(a.user_id = :uid OR a.target_user_id = :tuid)';
        $params['uid'] = $_GET['user_id'];
        $params['tuid'] = $_GET['user_id'];
    }

    if (!empty($_GET['start_date'])) {
        $where[] = 'a.created_at >= :start_date';
        $params['start_date'] = $_GET['start_date'] . ' 00:00:00';
    }

    if (!empty($_GET['end_date'])) {
        $where[] = 'a.created_at <= :end_date';
        $params['end_date'] = $_GET['end_date'] . ' 23:59:59';
    }

    if (!empty($_GET['search'])) {
        $where[] = '(a.details LIKE :search OR u.name LIKE :search2 OR u.email LIKE :search3)';
        $params['search'] = '%' . $_GET['search'] . '%';
        $params['search2'] = '%' . $_GET['search'] . '%';
        $params['search3'] = '%' . $_GET['search'] . '%';
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count total
    $countSql = "SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON a.user_id = u.id $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Fetch page
    $sql = "
        SELECT a.id, a.event_type, a.user_id, a.target_user_id, a.ip_address, a.user_agent, a.details, a.created_at,
               u.name AS user_name, u.email AS user_email,
               t.name AS target_user_name, t.email AS target_user_email
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN users t ON a.target_user_id = t.id
        $whereClause
        ORDER BY a.created_at DESC
        LIMIT $perPage OFFSET $offset
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    Response::paginated($rows, $total, $page, $perPage);

} catch (Exception $e) {
    Response::error('Failed to fetch audit log: ' . $e->getMessage(), 500);
}
