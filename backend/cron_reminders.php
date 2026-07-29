<?php
// ============================================================================
// VaultKeep - Expiry Notification Engine (PHPMailer Integration)
// Scheduled Background Task / Cron Job (Evaluates 30, 15, and 3 days alerts)
// ============================================================================

require_once __DIR__ . '/config/db.php';

// Recommended PHPMailer Inclusion (Vendor Autoload or direct require)
// require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
// require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/SMTP.php';

$db = Database::getInstance()->getConnection();

echo "[VaultKeep Notification Engine Initialized]\n";

// Query active products near warranty expiration
$query = "
    SELECT p.product_id, p.product_name, p.brand, p.expiry_date, u.full_name, u.email 
    FROM products p
    JOIN users u ON p.user_id = u.user_id
    WHERE DATEDIFF(p.expiry_date, CURDATE()) IN (30, 15, 3)
";

$stmt = $db->query($query);
$alertsTriggered = $stmt->fetchAll();

foreach ($alertsTriggered as $alert) {
    $today = new DateTime();
    $expiry = new DateTime($alert['expiry_date']);
    $daysLeft = $today->diff($expiry)->days;

    $subject = "⚠️ VaultKeep Alert: Warranty Expiring in {$daysLeft} Days!";
    $body = "
        <h2>Hello {$alert['full_name']},</h2>
        <p>This is an automated alert from VaultKeep regarding your registered asset:</p>
        <ul>
            <li><strong>Product:</strong> {$alert['product_name']}</li>
            <li><strong>Brand:</strong> {$alert['brand']}</li>
            <li><strong>Expiration Date:</strong> {$alert['expiry_date']}</li>
            <li><strong>Days Remaining:</strong> {$daysLeft} Days</li>
        </ul>
        <p>Log in to your VaultKeep account to view purchase invoices or log service history.</p>
        <br>
        <p>Best regards,<br>VaultKeep Security Team</p>
    ";

    echo "Dispatching Email Alert to: {$alert['email']} for Product: {$alert['product_name']} ({$daysLeft} days left)\n";

    /*
    // PHPMailer Code Example:
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'notifications@vaultkeep.io';
        $mail->Password   = 'YOUR_SMTP_PASSWORD';
        $mail->SMTPSecure = 'tls';
        $mail->Port       = 587;

        $mail->setFrom('notifications@vaultkeep.io', 'VaultKeep Reminders');
        $mail->addAddress($alert['email'], $alert['full_name']);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        $mail->send();
    } catch (Exception $e) {
        echo "Mailer Error: {$mail->ErrorInfo}\n";
    }
    */
}

echo "[VaultKeep Notification Engine Execution Complete]\n";
?>
