<?php
// ============================================================================
// VaultKeep - Admin Control API (PHP 8.x)
// Implements: User management (suspend/activate), category CRUD, global metrics
// ============================================================================

session_start();
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');
$db = Database::getInstance()->getConnection();

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$isAdmin = ($_SESSION['role'] ?? '') === 'admin';

// Reading the category list has to be available to every logged-in user (not just
// admins), because the "Add Product" form needs it to populate its category dropdown.
// Only mutating actions (add/delete category, metrics, user management) stay admin-only.
$isPublicRead = ($action === 'categories' && $method === 'GET');

if (!isset($_SESSION['user_id'])) {
    sendJsonResponse('error', 'You must be logged in to access this resource.', 401);
}
if (!$isAdmin && !$isPublicRead) {
    sendJsonResponse('error', 'Admin privileges are required to access this resource.', 403);
}

switch ($action) {
    case 'metrics':
        getAdminMetrics($db);
        break;
    case 'categories':
        if ($method === 'POST') addCategory($db);
        else if ($method === 'DELETE') deleteCategory($db);
        else getCategories($db);
        break;
    case 'users':
        if ($method === 'POST') toggleUserStatus($db);
        else getUsers($db);
        break;
    default:
        sendJsonResponse('error', 'Invalid admin action', 400);
}

function getAdminMetrics($db) {
    $userCount = $db->query("SELECT COUNT(*) as total FROM users WHERE role = 'user'")->fetch()['total'];
    $productCount = $db->query("SELECT COUNT(*) as total FROM products")->fetch()['total'];
    $categoryCount = $db->query("SELECT COUNT(*) as total FROM categories")->fetch()['total'];

    sendJsonResponse('success', [
        'total_users' => $userCount,
        'total_products' => $productCount,
        'total_categories' => $categoryCount
    ]);
}

function getCategories($db) {
    $categories = $db->query("SELECT * FROM categories ORDER BY category_name ASC")->fetchAll();
    sendJsonResponse('success', $categories);
}

function addCategory($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['category_name'] ?? '');
    if (!$name) sendJsonResponse('error', 'Category name is required', 400);

    $stmt = $db->prepare("INSERT INTO categories (category_name) VALUES (:name)");
    $stmt->execute(['name' => $name]);

    sendJsonResponse('success', ['category_id' => $db->lastInsertId(), 'category_name' => $name]);
}

function deleteCategory($db) {
    $id = intval($_GET['category_id'] ?? 0);
    $stmt = $db->prepare("DELETE FROM categories WHERE category_id = :id");
    $stmt->execute(['id' => $id]);
    sendJsonResponse('success', 'Category deleted');
}

function getUsers($db) {
    // Registered end users only (excludes admin accounts), newest first,
    // with a live count of assets each user has added.
    $sql = "SELECT u.user_id, u.full_name, u.email, u.role, u.status, u.created_at,
                   (SELECT COUNT(*) FROM products p WHERE p.user_id = u.user_id) AS products_count
            FROM users u
            WHERE u.role = 'user'
            ORDER BY u.created_at DESC";
    $users = $db->query($sql)->fetchAll();
    sendJsonResponse('success', $users);
}

function toggleUserStatus($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = intval($input['user_id'] ?? 0);
    $status = $input['status'] ?? 'Active';

    if (!$userId) {
        sendJsonResponse('error', 'A valid user_id is required.', 400);
    }
    if (!in_array($status, ['Active', 'Suspended'], true)) {
        sendJsonResponse('error', 'Status must be Active or Suspended.', 400);
    }

    $stmt = $db->prepare("UPDATE users SET status = :status WHERE user_id = :id");
    $stmt->execute(['status' => $status, 'id' => $userId]);

    sendJsonResponse('success', ['user_id' => $userId, 'status' => $status]);
}
?>
