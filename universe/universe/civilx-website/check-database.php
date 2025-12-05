<?php
// Проверка базы данных CivilX
header('Content-Type: application/json; charset=utf-8');

// Настройки базы данных
$host = 'localhost';
$dbname = 'u3279080_CivilX_users';
$username = 'u3279080_civilx_user';
$password = '!Grosheva78';

try {
    // Подключение к базе данных
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $result = [
        'status' => 'success',
        'message' => 'Подключение к БД успешно',
        'database_info' => []
    ];
    
    // Проверяем таблицы
    $tables = ['users', 'user_products', 'product_activations', 'product_versions'];
    
    foreach ($tables as $table) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM $table");
            $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
            $result['database_info'][$table] = [
                'exists' => true,
                'count' => $count
            ];
            
            // Если это таблица users, показываем пользователей
            if ($table === 'users' && $count > 0) {
                $stmt = $pdo->query("SELECT id, email, name, user_type, is_active FROM users LIMIT 5");
                $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $result['database_info'][$table]['users'] = $users;
            }
            
        } catch (PDOException $e) {
            $result['database_info'][$table] = [
                'exists' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    // Проверяем структуру таблицы users
    try {
        $stmt = $pdo->query("DESCRIBE users");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result['database_info']['users_structure'] = $columns;
    } catch (PDOException $e) {
        $result['database_info']['users_structure'] = ['error' => $e->getMessage()];
    }
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Ошибка подключения к БД: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
