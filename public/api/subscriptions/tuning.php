<?php
/**
 * Subscription Tuning Endpoint (Admin only)
 * GET  -> { params, defaults }
 * POST -> save params (body: { params: {...} } or { reset: true })
 */
require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/SubscriptionTuning.php';

requireAdmin();

$pdo = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    Response::success([
        'params' => SubscriptionTuning::load($pdo),
        'defaults' => SubscriptionTuning::defaults(),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = getJsonBody();
    if (!empty($body['reset'])) {
        SubscriptionTuning::reset($pdo);
        Response::success(['reset' => true, 'params' => SubscriptionTuning::defaults()]);
    }
    $params = $body['params'] ?? null;
    if (!is_array($params)) Response::error('params object required', 400);
    SubscriptionTuning::save($pdo, $params);
    Response::success(['saved' => true, 'params' => SubscriptionTuning::load($pdo)]);
}

Response::error('Method not allowed', 405);
