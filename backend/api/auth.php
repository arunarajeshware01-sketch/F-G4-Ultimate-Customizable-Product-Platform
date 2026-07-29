<?php
// ============================================================================
// VaultKeep - Authentication API Endpoint (PHP 8.x)
// Features: Password Hashing (password_hash), Session Security & Prepared Statements
// ============================================================================

session_start();
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');
$db = Database::getInstance()->getConnection();

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        handleRegister($db);
        break;
    case 'login':
        handleLogin($db);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'session':
        checkSession();
        break;
    default:
        sendJsonResponse('error', 'Invalid authentication action', 400);
}

function handleRegister($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    $fullName = trim($input['full_name'] ?? '');
    $email = filter_var(trim($input['email'] ?? ''), FILTER_VALIDATE_EMAIL);
    $password = $input['password'] ?? '';

    if (!$fullName || !$email) {
        sendJsonResponse('error', 'Please provide a valid full name and email address.', 400);
    }

    // Mirrors the client-side checklist: at least 8 chars, one uppercase, one lowercase,
    // one digit, and one special character. Enforced here too because a request can always
    // bypass the browser's JS validation.
    $passwordErrors = [];
    if (strlen($password) < 8) $passwordErrors[] = 'at least 8 characters';
    if (!preg_match('/[A-Z]/', $password)) $passwordErrors[] = 'an uppercase letter';
    if (!preg_match('/[a-z]/', $password)) $passwordErrors[] = 'a lowercase letter';
    if (!preg_match('/[0-9]/', $password)) $passwordErrors[] = 'a number';
    if (!preg_match('/[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]/', $password)) $passwordErrors[] = 'a special character';

    if (!empty($passwordErrors)) {
        sendJsonResponse('error', 'Password must contain ' . implode(', ', $passwordErrors) . '.', 400);
    }

    // Check if user exists (Prepared statement)
    $stmt = $db->prepare("SELECT user_id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    if ($stmt->fetch()) {
        sendJsonResponse('error', 'An account with this email address already exists.', 409);
    }

    // Secure Password Hashing (SRS Requirement §4.0)
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $db->prepare("INSERT INTO users (full_name, email, password, role, status) VALUES (:name, :email, :password, 'user', 'Active')");
    $stmt->execute([
        'name' => $fullName,
        'email' => $email,
        'password' => $passwordHash
    ]);

    $userId = $db->lastInsertId();
    $_SESSION['user_id'] = $userId;
    $_SESSION['full_name'] = $fullName;
    $_SESSION['email'] = $email;
    $_SESSION['role'] = 'user';

    sendJsonResponse('success', [
        'user_id' => $userId,
        'full_name' => $fullName,
        'email' => $email,
        'role' => 'user'
    ]);
}

function handleLogin($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = filter_var(trim($input['email'] ?? ''), FILTER_VALIDATE_EMAIL);
    $password = $input['password'] ?? '';

    if (!$email || !$password) {
        sendJsonResponse('error', 'Email and password are required.', 400);
    }

    $stmt = $db->prepare("SELECT user_id, full_name, email, password, role, status FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        sendJsonResponse('error', 'Invalid email or password credentials.', 401);
    }

    if ($user['status'] === 'Suspended') {
        sendJsonResponse('error', 'Your account has been suspended by an administrator.', 403);
    }

    // Prevent Session Hijacking (SRS Requirement §4.0)
    session_regenerate_id(true);

    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];

    sendJsonResponse('success', [
        'user_id' => $user['user_id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role']
    ]);
}

function handleLogout() {
    session_unset();
    session_destroy();
    sendJsonResponse('success', 'Logged out successfully');
}

function checkSession() {
    if (isset($_SESSION['user_id'])) {
        sendJsonResponse('success', [
            'user_id' => $_SESSION['user_id'],
            'full_name' => $_SESSION['full_name'],
            'email' => $_SESSION['email'],
            'role' => $_SESSION['role']
        ]);
    } else {
        sendJsonResponse('error', 'Unauthenticated', 401);
    }
}
?>
