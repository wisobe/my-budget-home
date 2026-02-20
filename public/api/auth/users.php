<?php
/**
 * User Management Endpoint (Admin only)
 * GET    /api/auth/users.php         - List all users
 * POST   /api/auth/users.php         - Create a new user
 * DELETE /api/auth/users.php         - Delete a user
 */

require_once __DIR__ . '/../includes/bootstrap.php';

try {
    $pdo = Database::getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        requireAdmin();
        
        $stmt = $pdo->query('SELECT id, email, name, role, created_at FROM users ORDER BY created_at');
        Response::success($stmt->fetchAll());

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        requireAdmin();
        
        $body = getJsonBody();
        validateRequired($body, ['email', 'name', 'password']);
        
        $email = strtolower(trim($body['email']));
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address');
        }
        
        if (strlen($body['password']) < 6) {
            Response::error('Password must be at least 6 characters');
        }
        
        // Check for duplicate email
        $checkStmt = $pdo->prepare("SELECT 1 FROM users WHERE email = :email");
        $checkStmt->execute(['email' => $email]);
        if ($checkStmt->fetch()) {
            Response::error('A user with this email already exists');
        }
        
        $role = in_array($body['role'] ?? 'user', ['admin', 'user']) ? ($body['role'] ?? 'user') : 'user';
        
        $id = 'user_' . uniqid();
        $hash = password_hash($body['password'], PASSWORD_BCRYPT);
        
        $stmt = $pdo->prepare('
            INSERT INTO users (id, email, name, password_hash, role, created_at)
            VALUES (:id, :email, :name, :hash, :role, NOW())
        ');
        $stmt->execute([
            'id' => $id,
            'email' => $email,
            'name' => trim($body['name']),
            'hash' => $hash,
            'role' => $role,
        ]);
        
        Response::success([
            'id' => $id,
            'email' => $email,
            'name' => trim($body['name']),
            'role' => $role,
        ], 'User created');

    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        requireAdmin();
        
        $body = getJsonBody();
        validateRequired($body, ['id']);
        
        $updates = [];
        $params = ['id' => $body['id']];
        
        // Update email
        if (!empty($body['email'])) {
            $email = strtolower(trim($body['email']));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Response::error('Invalid email address');
            }
            // Check for conflict
            $checkStmt = $pdo->prepare("SELECT 1 FROM users WHERE email = :email AND id != :uid");
            $checkStmt->execute(['email' => $email, 'uid' => $body['id']]);
            if ($checkStmt->fetch()) {
                Response::error('A user with this email already exists');
            }
            $updates[] = 'email = :email';
            $params['email'] = $email;
        }
        
        // Update password
        if (!empty($body['password'])) {
            if (strlen($body['password']) < 6) {
                Response::error('Password must be at least 6 characters');
            }
            $updates[] = 'password_hash = :hash';
            $params['hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
        }
        
        // Update name
        if (!empty($body['name'])) {
            $updates[] = 'name = :name';
            $params['name'] = trim($body['name']);
        }
        
        // Update role
        if (isset($body['role']) && in_array($body['role'], ['admin', 'user'])) {
            $updates[] = 'role = :role';
            $params['role'] = $body['role'];
        }
        
        if (empty($updates)) {
            Response::error('No fields to update');
        }
        
        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        if ($stmt->rowCount() === 0) {
            Response::notFound('User not found');
        }
        
        $fetchStmt = $pdo->prepare('SELECT id, email, name, role, created_at FROM users WHERE id = :id');
        $fetchStmt->execute(['id' => $body['id']]);
        Response::success($fetchStmt->fetch(), 'User updated');

    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $admin = requireAdmin();
        
        $body = getJsonBody();
        validateRequired($body, ['id']);
        
        // Prevent self-deletion
        if ($body['id'] === $admin['id']) {
            Response::error('You cannot delete your own account');
        }
        
        // Delete user (cascades to tokens, connections, accounts, etc.)
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute(['id' => $body['id']]);
        
        if ($stmt->rowCount() === 0) {
            Response::notFound('User not found');
        }
        
        Response::success(null, 'User deleted');

    } else {
        Response::error('Method not allowed', 405);
    }
} catch (Exception $e) {
    Response::error('Failed: ' . $e->getMessage(), 500);
}
