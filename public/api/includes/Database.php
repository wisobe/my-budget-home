<?php
/**
 * Database Connection Handler
 * Manages PDO connection to MariaDB
 */

class Database {
    private static ?PDO $instance = null;
    private static array $config;

    public static function init(array $config): void {
        self::$config = $config;
    }

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                self::$config['host'],
                self::$config['port'],
                self::$config['name'],
                self::$config['charset']
            );

            try {
                self::$instance = new PDO($dsn, self::$config['user'], self::$config['password'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                throw new Exception('Database connection failed: ' . $e->getMessage());
            }
        }

        return self::$instance;
    }

    public static function testConnection(): array {
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->query('SELECT VERSION() as version');
            $result = $stmt->fetch();
            return [
                'success' => true,
                'version' => $result['version'] ?? 'Unknown',
                'message' => 'Connection successful'
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
}
