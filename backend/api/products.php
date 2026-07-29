<?php
// ============================================================================
// VaultKeep - Product & Document Vault API (PHP 8.x + File Upload Engine)
// Implements: File validation (<5MB, PDF/JPG/PNG), Expiry Calculation, PDO
// ============================================================================

session_start();
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');
$db = Database::getInstance()->getConnection();

if (!isset($_SESSION['user_id'])) {
    sendJsonResponse('error', 'You must be logged in to access the product vault.', 401);
}
$userId = $_SESSION['user_id'];

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        fetchProducts($db, $userId);
        break;
    case 'POST':
        addProduct($db, $userId);
        break;
    case 'DELETE':
        deleteProduct($db, $userId);
        break;
    default:
        sendJsonResponse('error', 'Method not allowed', 405);
}

function fetchProducts($db, $userId) {
    $stmt = $db->prepare("
        SELECT p.*, c.category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.category_id 
        WHERE p.user_id = :user_id 
        ORDER BY p.created_at DESC
    ");
    $stmt->execute(['user_id' => $userId]);
    $products = $stmt->fetchAll();

    // Calculate dynamic warranty metrics
    $today = new DateTime();
    foreach ($products as &$p) {
        $expiry = new DateTime($p['expiry_date']);
        $interval = $today->diff($expiry);
        $daysRemaining = (int)$interval->format('%r%a');

        $p['days_remaining'] = $daysRemaining;
        if ($daysRemaining <= 0) {
            $p['status'] = 'expired';
            $p['status_text'] = 'Expired';
        } else if ($daysRemaining <= 30) {
            $p['status'] = 'warning';
            $p['status_text'] = "Expires in {$daysRemaining}d";
        } else {
            $p['status'] = 'active';
            $p['status_text'] = "{$daysRemaining} Days Left";
        }
    }

    sendJsonResponse('success', $products);
}

function addProduct($db, $userId) {
    $productName = trim($_POST['product_name'] ?? '');
    $brand = trim($_POST['brand'] ?? '');
    $categoryId = !empty($_POST['category_id']) ? intval($_POST['category_id']) : null;
    $serialNumber = trim($_POST['serial_number'] ?? 'N/A');
    $purchaseDate = $_POST['purchase_date'] ?? '';
    $warrantyMonths = intval($_POST['warranty_period_months'] ?? 12);
    $priceInr = floatval($_POST['price_inr'] ?? 0);
    $notes = trim($_POST['notes'] ?? '');

    if (!$productName || !$brand || !$purchaseDate || $warrantyMonths <= 0) {
        sendJsonResponse('error', 'Product Name, Brand, Purchase Date, and Warranty Period are required.', 400);
    }

    // Calculate Expiry Date
    $purchaseDateTime = new DateTime($purchaseDate);
    $expiryDateTime = clone $purchaseDateTime;
    $expiryDateTime->modify("+{$warrantyMonths} months");
    $expiryDateStr = $expiryDateTime->format('Y-m-d');

    // File Upload Handling (SRS Constraint: < 5MB, PDF/JPG/PNG)
    $billPath = null;
    if (isset($_FILES['bill_file']) && $_FILES['bill_file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['bill_file'];
        $maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
        $allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

        if ($file['size'] > $maxSizeBytes) {
            sendJsonResponse('error', 'File size exceeds maximum allowed limit of 5MB.', 400);
        }

        $fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($fileExt, $allowedExtensions)) {
            sendJsonResponse('error', 'Invalid file format. Only PDF, JPG, and PNG are allowed.', 400);
        }

        // Extension checks alone can be spoofed (e.g. a script renamed to .jpg). Verify
        // the actual file content matches an allowed MIME type before accepting it.
        $allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detectedMime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (!in_array($detectedMime, $allowedMimeTypes, true)) {
            sendJsonResponse('error', 'File content does not match an allowed type (PDF, JPG, PNG).', 400);
        }

        $uploadDir = __DIR__ . '/../uploads/bills/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $newFileName = 'bill_' . time() . '_' . uniqid() . '.' . $fileExt;
        $targetFilePath = $uploadDir . $newFileName;

        if (move_uploaded_file($file['tmp_name'], $targetFilePath)) {
            $billPath = 'uploads/bills/' . $newFileName;
        } else {
            sendJsonResponse('error', 'Failed to upload bill file to server.', 500);
        }
    }

    // Insert Product using PDO Prepared Statements
    $stmt = $db->prepare("
        INSERT INTO products 
        (user_id, category_id, product_name, brand, serial_number, purchase_date, warranty_period_months, expiry_date, price_inr, bill_path, notes)
        VALUES 
        (:user_id, :category_id, :product_name, :brand, :serial_number, :purchase_date, :warranty_months, :expiry_date, :price_inr, :bill_path, :notes)
    ");

    $stmt->execute([
        'user_id' => $userId,
        'category_id' => $categoryId,
        'product_name' => $productName,
        'brand' => $brand,
        'serial_number' => $serialNumber,
        'purchase_date' => $purchaseDate,
        'warranty_months' => $warrantyMonths,
        'expiry_date' => $expiryDateStr,
        'price_inr' => $priceInr,
        'bill_path' => $billPath,
        'notes' => $notes
    ]);

    $newProductId = $db->lastInsertId();

    sendJsonResponse('success', [
        'product_id' => $newProductId,
        'product_name' => $productName,
        'expiry_date' => $expiryDateStr,
        'price_inr' => $priceInr
    ]);
}

function deleteProduct($db, $userId) {
    parse_str(file_get_contents('php://input'), $_DELETE);
    $productId = intval($_DELETE['product_id'] ?? $_GET['product_id'] ?? 0);

    if (!$productId) {
        sendJsonResponse('error', 'Missing product_id parameter', 400);
    }

    $stmt = $db->prepare("DELETE FROM products WHERE product_id = :product_id AND user_id = :user_id");
    $stmt->execute([
        'product_id' => $productId,
        'user_id' => $userId
    ]);

    sendJsonResponse('success', 'Product record removed from vault.');
}
?>
