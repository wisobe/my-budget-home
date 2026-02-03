<?php
/**
 * API Response Helper
 * Standardizes JSON responses and handles CORS
 */

class Response {
    private static array $allowedOrigins = [];

    public static function init(array $allowedOrigins): void {
        self::$allowedOrigins = $allowedOrigins;
    }

    public static function setCorsHeaders(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        // Check if origin is allowed
        if (in_array($origin, self::$allowedOrigins) || in_array('*', self::$allowedOrigins)) {
            header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
        }
        
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 86400');
        header('Content-Type: application/json');
    }

    public static function handlePreflight(): void {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            self::setCorsHeaders();
            http_response_code(204);
            exit;
        }
    }

    public static function success($data, string $message = null): void {
        self::setCorsHeaders();
        echo json_encode([
            'success' => true,
            'data' => $data,
            'message' => $message,
        ]);
        exit;
    }

    public static function paginated(array $data, int $total, int $page, int $perPage): void {
        self::setCorsHeaders();
        echo json_encode([
            'data' => $data,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => ceil($total / $perPage),
        ]);
        exit;
    }

    public static function error(string $message, int $statusCode = 400): void {
        self::setCorsHeaders();
        http_response_code($statusCode);
        echo json_encode([
            'success' => false,
            'message' => $message,
        ]);
        exit;
    }

    public static function notFound(string $message = 'Resource not found'): void {
        self::error($message, 404);
    }

    public static function unauthorized(string $message = 'Unauthorized'): void {
        self::error($message, 401);
    }

    public static function serverError(string $message = 'Internal server error'): void {
        self::error($message, 500);
    }
}
