<?php
header('Content-Type: application/json; charset=utf-8');

// Настройки базы данных
$host = 'localhost';
$dbname = 'u3279080_CivilX_users';
$username = 'u3279080_civilx_user';
$password = '!Grosheva78';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Получаем всех пользователей
    $stmt = $pdo->query("SELECT id, email, name, user_type, is_active, created_at FROM users ORDER BY created_at DESC");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'status' => 'success',
        'users_count' => count($users),
        'users' => $users
    ], JSON_UNESCAPED_UNICODE);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
