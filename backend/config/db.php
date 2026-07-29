<?php
// ============================================================================
// VaultKeep - Database Connection Manager (PHP PDO Prepared Statements)
// ============================================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'vaultkeep_db');

class Database {
    private static $instance = null;
    private $conn;

    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $this->conn = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Database connection failure: " . $e->getMessage()
            ]);
            exit;
        }
    }

    public static function getInstance() {
        if (self::$instance == null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->conn;
    }
}

// Utility response helper
function sendJsonResponse($status, $dataOrMessage, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    if ($status === 'error') {
        echo json_encode(["status" => "error", "message" => $dataOrMessage]);
    } else {
        echo json_encode(["status" => "success", "data" => $dataOrMessage]);
    }
    exit;
}
?>
