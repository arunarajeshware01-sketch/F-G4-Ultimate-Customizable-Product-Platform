<?php
// ============================================================================
// VaultKeep - Service History API Endpoint (PHP 8.x)
// Implements: Maintenance records, repair cost logging, service provider history
// ============================================================================

session_start();
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');
$db = Database::getInstance()->getConnection();

if (!isset($_SESSION['user_id'])) {
    sendJsonResponse('error', 'You must be logged in to access service history.', 401);
}
$userId = $_SESSION['user_id'];

// Confirms the product belongs to the logged-in user before allowing access to its service history
function productBelongsToUser($db, $productId, $userId) {
    $stmt = $db->prepare("SELECT product_id FROM products WHERE product_id = :product_id AND user_id = :user_id");
    $stmt->execute(['product_id' => $productId, 'user_id' => $userId]);
    return (bool)$stmt->fetch();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $productId = intval($_GET['product_id'] ?? 0);
    if (!$productId) {
        sendJsonResponse('error', 'Product ID is required', 400);
    }
    if (!productBelongsToUser($db, $productId, $userId)) {
        sendJsonResponse('error', 'Product not found in your vault.', 404);
    }

    $stmt = $db->prepare("SELECT * FROM service_histories WHERE product_id = :product_id ORDER BY service_date DESC");
    $stmt->execute(['product_id' => $productId]);
    sendJsonResponse('success', $stmt->fetchAll());
} 
else if ($method === 'POST') {
    $productId = intval($_POST['product_id'] ?? 0);
    $providerName = trim($_POST['provider_name'] ?? '');
    $cost = floatval($_POST['cost'] ?? 0);
    $serviceDate = $_POST['service_date'] ?? '';
    $description = trim($_POST['description'] ?? '');

    if (!$productId || !$providerName || !$serviceDate) {
        sendJsonResponse('error', 'Product ID, Provider Name, and Service Date are mandatory.', 400);
    }
    if (!productBelongsToUser($db, $productId, $userId)) {
        sendJsonResponse('error', 'Product not found in your vault.', 404);
    }

    $stmt = $db->prepare("
        INSERT INTO service_histories (product_id, service_date, provider_name, cost_inr, description)
        VALUES (:product_id, :service_date, :provider_name, :cost, :description)
    ");

    $stmt->execute([
        'product_id' => $productId,
        'service_date' => $serviceDate,
        'provider_name' => $providerName,
        'cost' => $cost,
        'description' => $description
    ]);

    sendJsonResponse('success', [
        'service_id' => $db->lastInsertId(),
        'message' => 'Service history record added successfully.'
    ]);
}
?>
