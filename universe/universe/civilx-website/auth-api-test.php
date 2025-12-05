<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Простой тест API
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Убираем имя скрипта из пути
$scriptName = $_SERVER['SCRIPT_NAME'];
if (strpos($path, $scriptName) === 0) {
    $path = substr($path, strlen($scriptName));
}

// Простой тест
if (strpos($path, '/api/test') !== false) {
    echo json_encode([
        'status' => 'success',
        'message' => 'API работает!',
        'method' => $method,
        'path' => $path,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// Тест авторизации
if (strpos($path, '/api/login') !== false && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['email']) || empty($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email и пароль обязательны']);
        exit;
    }
    
    // Простая проверка (для теста)
    if ($input['email'] === 'test@example.com' && $input['password'] === 'password123') {
        echo json_encode([
            'message' => 'Успешный вход (тест)',
            'token' => 'test.jwt.token.123',
            'user' => [
                'id' => 1,
                'email' => 'test@example.com',
                'name' => 'Тестовый пользователь',
                'user_type' => 'user'
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Неверные учетные данные']);
    }
    exit;
}

// Тест доступных версий
if (strpos($path, '/api/available-versions') !== false && $method === 'GET') {
    echo json_encode([
        'success' => true,
        'versions' => [
            [
                'revit_version' => 'Revit 2023',
                'product_version' => '1.0',
                'file_name' => 'CivilX-Revit2023-v1.0.msi',
                'file_path' => 'installer/Revit 2023/1.0/CivilX-Revit2023-v1.0.msi',
                'file_size' => 380928,
                'last_modified' => '2025-09-22T13:03:40+03:00'
            ]
        ]
    ]);
    exit;
}

// Если ничего не найдено
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found', 'path' => $path, 'method' => $method]);
?>
