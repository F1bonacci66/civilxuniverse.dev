<?php
header('Content-Type: application/json; charset=utf-8');

// ПРИНУДИТЕЛЬНОЕ ОПРЕДЕЛЕНИЕ JWT_SECRET
if (!defined('JWT_SECRET')) {
    define('JWT_SECRET', 'your_super_secret_jwt_key_for_php');
}

// Настройки базы данных
$host = 'localhost';
$dbname = 'u3279080_CivilX_users';
$username = 'u3279080_civilx_user';
$password = '!Grosheva78';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Тестируем авторизацию
    $email = 'test@example.com';
    $password = 'password123';
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($password, $user['password'])) {
        // Генерируем JWT токен
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'user_id' => $user['id'],
            'email' => $user['email'],
            'exp' => time() + (24 * 60 * 60) // 24 часа
        ]);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        $token = $base64Header . "." . $base64Payload . "." . $base64Signature;
        
        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name'],
                'user_type' => $user['user_type']
            ],
            'jwt_secret_defined' => defined('JWT_SECRET'),
            'timestamp' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Неверные учетные данные',
            'jwt_secret_defined' => defined('JWT_SECRET'),
            'timestamp' => date('Y-m-d H:i:s')
        ], JSON_UNESCAPED_UNICODE);
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage(),
        'jwt_secret_defined' => defined('JWT_SECRET'),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
}
?>
