<?php
// ОБНОВЛЕНО: 2025-10-02 15:40:00 - ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ JWT_SECRET
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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
    // Сначала подключаемся без указания базы данных
    $pdo = new PDO("mysql:host=$host;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Создаем базу данных, если она не существует
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname`");
    
    // Подключаемся к конкретной базе данных
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Создание таблицы пользователей
$createTable = "
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_type ENUM('user', 'organization') NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
)";
$pdo->exec($createTable);

// Создание таблицы продуктов пользователей
$createUserProductsTable = "
CREATE TABLE IF NOT EXISTS user_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    plan_type ENUM('monthly', 'yearly') NOT NULL,
    purchase_status ENUM('pending', 'completed') DEFAULT 'pending',
    activation_status ENUM('pending', 'ready', 'activated', 'expired') DEFAULT 'pending',
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    activation_date DATETIME NULL,
    expires_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    position_login VARCHAR(50) UNIQUE NOT NULL,
    plugin_group VARCHAR(50) DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_products (user_id, product_name),
    INDEX idx_position_login (position_login),
    INDEX idx_plugin_group (plugin_group)
)";
$pdo->exec($createUserProductsTable);

// Добавление столбца position_login если таблица уже существует
try {
    $pdo->exec("ALTER TABLE user_products ADD COLUMN position_login VARCHAR(50) UNIQUE NOT NULL DEFAULT ''");
    $pdo->exec("ALTER TABLE user_products ADD INDEX idx_position_login (position_login)");
} catch (PDOException $e) {
    // Столбец уже существует, игнорируем ошибку
}

// Добавление столбца login если таблица уже существует
try {
    $pdo->exec("ALTER TABLE users ADD COLUMN login VARCHAR(50) UNIQUE NOT NULL DEFAULT ''");
    $pdo->exec("ALTER TABLE users ADD INDEX idx_login (login)");
} catch (PDOException $e) {
    // Столбец уже существует, игнорируем ошибку
}

// Добавление столбца plugin_group если таблица уже существует
try {
    $pdo->exec("ALTER TABLE user_products ADD COLUMN plugin_group VARCHAR(50) DEFAULT NULL");
    $pdo->exec("ALTER TABLE user_products ADD INDEX idx_plugin_group (plugin_group)");
} catch (PDOException $e) {
    // Столбец уже существует, игнорируем ошибку
}

// Создание таблицы версий продуктов
$createProductVersionsTable = "
CREATE TABLE IF NOT EXISTS product_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    revit_version VARCHAR(20) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    release_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_product_version (product_name, version, revit_version),
    INDEX idx_product_name (product_name),
    INDEX idx_revit_version (revit_version),
    INDEX idx_is_active (is_active)
)";
$pdo->exec($createProductVersionsTable);

// Создание таблицы активации продуктов по версиям Revit
$createProductActivationsTable = "
CREATE TABLE IF NOT EXISTS product_activations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    revit_version VARCHAR(20) NOT NULL,
    product_version VARCHAR(20) NOT NULL,
    activation_status ENUM('active', 'inactive') DEFAULT 'active',
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES user_products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product_revit (user_id, product_id, revit_version)
)";
$pdo->exec($createProductActivationsTable);

// Добавление индексов для быстрого поиска
try {
    $pdo->exec("CREATE INDEX idx_user_activations ON product_activations(user_id, activation_status)");
    $pdo->exec("CREATE INDEX idx_product_revit ON product_activations(product_id, revit_version)");
} catch (PDOException $e) {
    // Индексы уже существуют, игнорируем ошибку
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Убираем имя скрипта из пути для правильной маршрутизации
$scriptName = $_SERVER['SCRIPT_NAME'];
if (strpos($path, $scriptName) === 0) {
    $path = substr($path, strlen($scriptName));
}

// Обработка OPTIONS запросов
if ($method === 'OPTIONS') {
    exit(0);
}

// Маршрутизация
if ($method === 'POST') {
    // Получаем данные из POST запроса
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Получаем токен из POST body или заголовков
    $headers = getallheaders();
    $token = null;
    
    // Сначала пробуем получить токен из POST body
    if (isset($input['token'])) {
        $token = $input['token'];
    }
    // Если не найден в body, пробуем заголовки
    elseif (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    if (strpos($path, '/api/register') !== false) {
        handleRegister($pdo);
    } elseif (strpos($path, '/api/login') !== false) {
        handleLogin($pdo);
    } elseif (strpos($path, '/api/purchase') !== false) {
        handlePurchase($pdo);
    } elseif (strpos($path, '/api/cancel-subscription') !== false) {
        handleCancelSubscription($pdo);
    } elseif (strpos($path, '/api/delete-subscription') !== false) {
        handleDeleteSubscription($pdo);
    } elseif (strpos($path, '/api/update-profile') !== false) {
        handleUpdateProfile($pdo);
    } elseif (strpos($path, '/api/change-password') !== false) {
        handleChangePassword($pdo);
    } elseif (strpos($path, '/api/delete-profile') !== false) {
        handleDeleteProfile($pdo);
    } elseif (strpos($path, '/api/activate-product') !== false) {
        handleActivateProduct($pdo, $input, $token);
    } elseif (strpos($path, '/api/deactivate-product') !== false) {
        handleDeactivateProduct($pdo, $input, $token);
    } elseif (strpos($path, '/api/check-plugin-group') !== false) {
        handleCheckPluginGroup($pdo, $input, $token);
    } elseif (strpos($path, '/api/download-version') !== false) {
        handleDownloadVersion($pdo, $input, $token);
    } elseif (strpos($path, '/api/get-version') !== false) {
        handleGetVersion();
    } elseif (strpos($path, '/api/me') !== false) {
        handleGetUser($pdo, $token);
    } elseif (strpos($path, '/api/user-products') !== false) {
        handleGetUserProducts($pdo, $token);
    } elseif (strpos($path, '/api/product-activations') !== false) {
        handleGetProductActivations($pdo, $token);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
    }
} elseif ($method === 'GET') {
    if (strpos($path, '/api/me') !== false) {
        handleGetUser($pdo);
    } elseif (strpos($path, '/api/user-products') !== false) {
        handleGetUserProducts($pdo);
    } elseif (strpos($path, '/api/product-versions') !== false) {
        handleGetProductVersions($pdo);
    } elseif (strpos($path, '/api/available-versions') !== false) {
        handleGetAvailableVersions();
    } elseif (strpos($path, '/api/download-file') !== false) {
        handleDownloadFile();
    } elseif (strpos($path, '/api/subscription-products') !== false) {
        handleGetSubscriptionProducts($pdo);
    } elseif (strpos($path, '/api/product-activations') !== false) {
        handleGetProductActivations($pdo);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

// JWT Secret Key (replace with a strong, random key in production)
// JWT_SECRET уже определен выше в принудительном блоке

// Функция генерации уникального логина позиции
function generatePositionLogin($pdo) {
    do {
        $login = 'DV' . strtoupper(substr(uniqid(), -8)) . rand(100, 999);
        $stmt = $pdo->prepare("SELECT id FROM user_products WHERE position_login = ?");
        $stmt->execute([$login]);
    } while ($stmt->fetch());
    
    return $login;
}

function handleRegister($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Валидация
    if (empty($input['email']) || empty($input['password']) || empty($input['name']) || empty($input['user_type'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Все обязательные поля должны быть заполнены']);
        return;
    }
    
    // Используем email как login, если login не указан
    if (empty($input['login'])) {
        $input['login'] = $input['email'];
    }
    
    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Некорректный email']);
        return;
    }
    
    // Валидация логина (если он отличается от email)
    if ($input['login'] !== $input['email']) {
        if (strlen($input['login']) < 3 || strlen($input['login']) > 20) {
            http_response_code(400);
            echo json_encode(['error' => 'Логин должен содержать от 3 до 20 символов']);
            return;
        }
        
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $input['login'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Логин может содержать только латинские буквы, цифры и подчеркивания']);
            return;
        }
    }
    
    if (strlen($input['password']) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Пароль должен содержать минимум 6 символов']);
        return;
    }
    
    $validTypes = ['user', 'organization'];
    if (!in_array($input['user_type'], $validTypes)) {
        http_response_code(400);
        echo json_encode(['error' => 'Некорректный тип пользователя']);
        return;
    }
    
    try {
        // Проверка существования пользователя по email
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$input['email']]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Пользователь с таким email уже существует']);
            return;
        }
        
        // Проверка существования пользователя по логину
        $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ?");
        $stmt->execute([$input['login']]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Пользователь с таким логином уже существует']);
            return;
        }
        
        // Хеширование пароля
        $hashedPassword = password_hash($input['password'], PASSWORD_DEFAULT);
        
        // Вставка пользователя
        $stmt = $pdo->prepare("
            INSERT INTO users (login, email, password, name, user_type, company_name, phone) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $input['login'],
            $input['email'],
            $hashedPassword,
            $input['name'],
            $input['user_type'],
            $input['company_name'] ?? null,
            $input['phone'] ?? null
        ]);
        
        $userId = $pdo->lastInsertId();
        
        // Генерация JWT токена
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'user_id' => $userId,
            'email' => $input['email'],
            'user_type' => $input['user_type'],
            'exp' => time() + (24 * 60 * 60) // 24 часа
        ]);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        $token = $base64Header . "." . $base64Payload . "." . $base64Signature;
        
        echo json_encode([
            'message' => 'Пользователь успешно создан',
            'token' => $token,
            'user' => [
                'id' => $userId,
                'login' => $input['login'],
                'email' => $input['email'],
                'name' => $input['name'],
                'user_type' => $input['user_type'],
                'company_name' => $input['company_name'] ?? null
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Ошибка базы данных']);
    }
}

function handleLogin($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['email']) || empty($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email и пароль обязательны']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$input['email']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !password_verify($input['password'], $user['password'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Неверные учетные данные']);
            return;
        }
        
        // Генерация JWT токена
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'user_id' => $user['id'],
            'email' => $user['email'],
            'user_type' => $user['user_type'],
            'exp' => time() + (24 * 60 * 60) // 24 часа
        ]);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        $token = $base64Header . "." . $base64Payload . "." . $base64Signature;
        
        echo json_encode([
            'message' => 'Успешный вход',
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name'],
                'user_type' => $user['user_type'],
                'company_name' => $user['company_name']
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Ошибка базы данных']);
    }
}

function handleGetUser($pdo, $token = null) {
    // Если токен не передан, пытаемся получить из заголовков (для GET запросов)
    if (!$token) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    try {
        // Декодирование JWT токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        $stmt = $pdo->prepare("SELECT id, login, email, name, user_type, company_name, phone, created_at FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'Пользователь не найден']);
            return;
        }
        
        echo json_encode(['user' => $user]);
        
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['error' => 'Недействительный токен']);
    }
}

// Функция покупки продукта
function handlePurchase($pdo) {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        error_log("Authorization header: " . $authHeader);
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
            error_log("Extracted token: " . $token);
            error_log("Token length: " . strlen($token));
        } else {
            error_log("No Bearer token found in header");
        }
    } else {
        error_log("No Authorization header found");
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $productName = $input['product_name'] ?? '';
    $planType = $input['plan_type'] ?? '';
    $quantity = intval($input['quantity'] ?? 1);
    $pluginGroup = $input['plugin_group'] ?? null; // Новая группа плагинов
    
    if (!$productName || !$planType || $quantity < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Product name, plan type and valid quantity required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Проверка, что пользователь существует
        $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            http_response_code(401);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        // Вычисление даты истечения
        $expiresAt = null;
        if ($planType === 'monthly') {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+1 month'));
        } elseif ($planType === 'yearly') {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+1 year'));
        }
        
        $purchasedProducts = [];
        
        // Создание записей для каждого количества
        for ($i = 0; $i < $quantity; $i++) {
            $positionLogin = generatePositionLogin($pdo);
            
            // Для группы "Настройки" (авторизация) делаем всегда активным
            $activationStatus = ($pluginGroup === 'settings' || $pluginGroup === 'authorization') ? 'activated' : 'ready';
            
            $stmt = $pdo->prepare("INSERT INTO user_products (user_id, product_name, plan_type, purchase_status, activation_status, expires_at, position_login, plugin_group) VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)");
            $stmt->execute([$userId, $productName, $planType, $activationStatus, $expiresAt, $positionLogin, $pluginGroup]);
            
            $productId = $pdo->lastInsertId();
            
            $purchasedProducts[] = [
                'product_id' => $productId,
                'product_name' => $productName,
                'plan_type' => $planType,
                'purchase_status' => 'completed',
                'activation_status' => $activationStatus,
                'expires_at' => $expiresAt,
                'position_login' => $positionLogin,
                'plugin_group' => $pluginGroup
            ];
        }
        
        http_response_code(201);
        echo json_encode([
            'message' => "Успешно приобретено {$quantity} позиций продукта",
            'quantity' => $quantity,
            'products' => $purchasedProducts
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Purchase failed: ' . $e->getMessage()]);
    }
}

// Функция получения продуктов пользователя
function handleGetUserProducts($pdo, $token = null) {
    // Если токен не передан, пытаемся получить из заголовков (для GET запросов)
    if (!$token) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Получение продуктов пользователя
        $stmt = $pdo->prepare("SELECT * FROM user_products WHERE user_id = ? ORDER BY purchase_date DESC");
        $stmt->execute([$userId]);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Отладочная информация
        error_log("User $userId products from database: " . json_encode($products));
        
        // Получение активаций для каждого продукта
        foreach ($products as &$product) {
            $stmt = $pdo->prepare("
                SELECT activation_status, revit_version, product_version, activated_at, deactivated_at 
                FROM product_activations 
                WHERE user_id = ? AND product_id = ? AND activation_status = 'active'
            ");
            $stmt->execute([$userId, $product['id']]);
            $activation = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($activation) {
                $product['activation_status'] = $activation['activation_status'];
                $product['revit_version'] = $activation['revit_version'];
                $product['product_version'] = $activation['product_version'];
                $product['activated_at'] = $activation['activated_at'];
                $product['deactivated_at'] = $activation['deactivated_at'];
                error_log("Product {$product['product_name']} (ID: {$product['id']}) has active activation");
            } else {
                $product['activation_status'] = 'ready';
                error_log("Product {$product['product_name']} (ID: {$product['id']}) has no active activation");
            }
        }
        
        // Проверяем, есть ли у пользователя плагин авторизации (настройки)
        $hasAuthPlugin = false;
        foreach ($products as $product) {
            if ($product['plugin_group'] === 'settings' || $product['plugin_group'] === 'authorization') {
                $hasAuthPlugin = true;
                break;
            }
        }
        
        // Если нет плагина авторизации, добавляем его автоматически
        if (!$hasAuthPlugin) {
            $positionLogin = generatePositionLogin($pdo);
            $stmt = $pdo->prepare("INSERT INTO user_products (user_id, product_name, plan_type, purchase_status, activation_status, expires_at, position_login, plugin_group) VALUES (?, 'authorization', 'yearly', 'completed', 'activated', NULL, ?, 'settings')");
            $stmt->execute([$userId, $positionLogin]);
            
            // Добавляем в массив продуктов
            $products[] = [
                'id' => $pdo->lastInsertId(),
                'user_id' => $userId,
                'product_name' => 'authorization',
                'plan_type' => 'yearly',
                'purchase_status' => 'completed',
                'activation_status' => 'activated',
                'purchase_date' => date('Y-m-d H:i:s'),
                'activation_date' => date('Y-m-d H:i:s'),
                'expires_at' => null,
                'cancelled_at' => null,
                'position_login' => $positionLogin,
                'plugin_group' => 'settings'
            ];
        }
        
        // Фильтруем продукты - скрываем группу "authorization" и "settings" от пользователя
        $filteredProducts = array_filter($products, function($product) {
            $pluginGroup = strtolower($product['plugin_group'] ?? '');
            return $pluginGroup !== 'authorization' && $pluginGroup !== 'settings';
        });
        
        // Удаляем поля, которые не нужны в основном списке
        foreach ($filteredProducts as &$product) {
            unset($product['activation_date']);
        }
        
        // Сортируем отфильтрованные продукты по дате покупки
        usort($filteredProducts, function($a, $b) {
            return strcmp($b['purchase_date'], $a['purchase_date']); // Сначала новые
        });
        
        http_response_code(200);
        echo json_encode(['products' => array_values($filteredProducts)]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get user products: ' . $e->getMessage()]);
    }
}

// Функция отмены подписки
function handleCancelSubscription($pdo) {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $productId = $input['product_id'] ?? '';
    
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Проверяем, что это не плагин авторизации (настройки)
        $stmt = $pdo->prepare("SELECT plugin_group FROM user_products WHERE id = ? AND user_id = ?");
        $stmt->execute([$productId, $userId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        if ($product['plugin_group'] === 'settings' || $product['plugin_group'] === 'authorization') {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot cancel authorization plugin - it is always active']);
            return;
        }
        
        // Отмена подписки
        $stmt = $pdo->prepare("UPDATE user_products SET activation_status = 'expired', cancelled_at = NOW() WHERE id = ? AND user_id = ?");
        $stmt->execute([$productId, $userId]);
        
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['message' => 'Subscription cancelled successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to cancel subscription: ' . $e->getMessage()]);
    }
}

// Функция удаления подписки
function handleDeleteSubscription($pdo) {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $productId = $input['product_id'] ?? null;
    
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Проверяем, что это не плагин авторизации (настройки)
        $stmt = $pdo->prepare("SELECT plugin_group FROM user_products WHERE id = ? AND user_id = ?");
        $stmt->execute([$productId, $userId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Subscription not found or access denied']);
            return;
        }
        
        if ($product['plugin_group'] === 'settings' || $product['plugin_group'] === 'authorization') {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot delete authorization plugin - it is always active']);
            return;
        }
        
        // Удаление подписки
        $stmt = $pdo->prepare("DELETE FROM user_products WHERE id = ? AND user_id = ?");
        $stmt->execute([$productId, $userId]);
        
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['message' => 'Subscription deleted successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Subscription not found or access denied']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Delete subscription failed: ' . $e->getMessage()]);
    }
}

// Функция обновления профиля
function handleUpdateProfile($pdo) {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Проверка уникальности логина (если логин изменился)
        if (isset($input['login'])) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ? AND id != ?");
            $stmt->execute([$input['login'], $userId]);
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Пользователь с таким логином уже существует']);
                return;
            }
        }
        
        // Обновление профиля
        $stmt = $pdo->prepare("UPDATE users SET name = ?, login = ?, email = ?, phone = ?, company_name = ? WHERE id = ?");
        $stmt->execute([
            $input['name'],
            $input['login'],
            $input['email'],
            $input['phone'] ?? null,
            $input['company_name'] ?? null,
            $userId
        ]);
        
        http_response_code(200);
        echo json_encode(['message' => 'Profile updated successfully']);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Update profile failed: ' . $e->getMessage()]);
    }
}

// Функция смены пароля
function handleChangePassword($pdo) {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Проверка текущего пароля
        $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if (!$user || !password_verify($input['current_password'], $user['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Current password is incorrect']);
            return;
        }
        
        // Обновление пароля
        $newPasswordHash = password_hash($input['new_password'], PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
        $stmt->execute([$newPasswordHash, $userId]);
        
        http_response_code(200);
        echo json_encode(['message' => 'Password changed successfully']);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Change password failed: ' . $e->getMessage()]);
    }
}

// Функция удаления профиля
function handleDeleteProfile($pdo) {
    $headers = getallheaders();
    $token = null;
    
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        
        // Удаление пользователя (CASCADE удалит связанные записи)
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['message' => 'Profile deleted successfully']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Delete profile failed: ' . $e->getMessage()]);
    }
}

function handleActivateProduct($pdo, $input, $token) {
    if (empty($input['product_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID is required']);
        return;
    }
    
    // Получаем версию Revit из запроса (по умолчанию 2023)
    $revitVersion = $input['revit_version'] ?? '2023';
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        $productId = $input['product_id'];
        
        // Проверяем, что продукт принадлежит пользователю и подписка активна
        $stmt = $pdo->prepare("
            SELECT id, plugin_group, expires_at, activation_status, product_name 
            FROM user_products 
            WHERE id = ? AND user_id = ? 
            AND (expires_at IS NULL OR expires_at > NOW())
        ");
        $stmt->execute([$productId, $userId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found, not owned by user, or subscription expired']);
            return;
        }
        
        // Проверяем, что это не плагин авторизации (настройки)
        if ($product['plugin_group'] === 'settings' || $product['plugin_group'] === 'authorization') {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot activate authorization plugin - it is always active']);
            return;
        }
        
        // Проверяем, существует ли уже запись активации для данной версии Revit
        $stmt = $pdo->prepare("
            SELECT id, activation_status FROM product_activations 
            WHERE user_id = ? AND product_id = ? AND revit_version = ?
        ");
        $stmt->execute([$userId, $productId, $revitVersion]);
        $existingActivation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Получаем последнюю версию продукта для данной версии Revit
        $stmt = $pdo->prepare("
            SELECT version FROM product_versions 
            WHERE product_name = ? 
            AND revit_version = ? 
            AND is_active = 1 
            ORDER BY version DESC 
            LIMIT 1
        ");
        $stmt->execute([$product['product_name'], $revitVersion]);
        $productVersion = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$productVersion) {
            http_response_code(404);
            echo json_encode(['error' => "No product version found for Revit $revitVersion"]);
            return;
        }
        
        // Создаем или обновляем запись активации
        if ($existingActivation) {
            // Обновляем существующую запись - активируем продукт
            $stmt = $pdo->prepare("
                UPDATE product_activations 
                SET activation_status = 'active', 
                    activated_at = NOW(), 
                    deactivated_at = NULL,
                    product_version = ?
                WHERE user_id = ? AND product_id = ? AND revit_version = ?
            ");
            $stmt->execute([$productVersion['version'], $userId, $productId, $revitVersion]);
        } else {
            // Создаем новую запись активации
            $stmt = $pdo->prepare("
                INSERT INTO product_activations (user_id, product_id, revit_version, product_version, activation_status, activated_at) 
                VALUES (?, ?, ?, ?, 'active', NOW())
            ");
            $stmt->execute([$userId, $productId, $revitVersion, $productVersion['version']]);
        }
        
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => "Product activated successfully for Revit $revitVersion",
                'revit_version' => $revitVersion,
                'product_version' => $productVersion['version']
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to activate product']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Activate product failed: ' . $e->getMessage()]);
    }
}

function handleDeactivateProduct($pdo, $input, $token) {
    if (empty($input['product_id']) || empty($input['revit_version'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID and Revit version are required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        $productId = $input['product_id'];
        $revitVersion = $input['revit_version'];
        
        // Проверяем, что продукт принадлежит пользователю
        $stmt = $pdo->prepare("SELECT id, plugin_group FROM user_products WHERE id = ? AND user_id = ?");
        $stmt->execute([$productId, $userId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found or not owned by user']);
            return;
        }
        
        // Проверяем, что это не плагин авторизации (настройки)
        if ($product['plugin_group'] === 'settings' || $product['plugin_group'] === 'authorization') {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot deactivate authorization plugin - it is always active']);
            return;
        }
        
        // Проверяем, что активация существует и активна
        $stmt = $pdo->prepare("
            SELECT id FROM product_activations 
            WHERE user_id = ? AND product_id = ? AND revit_version = ? AND activation_status = 'active'
        ");
        $stmt->execute([$userId, $productId, $revitVersion]);
        $activation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$activation) {
            http_response_code(404);
            echo json_encode(['error' => "No active activation found for Revit $revitVersion"]);
            return;
        }
        
        // Деактивируем продукт для данной версии Revit
        $stmt = $pdo->prepare("
            UPDATE product_activations 
            SET activation_status = 'inactive', deactivated_at = NOW() 
            WHERE user_id = ? AND product_id = ? AND revit_version = ? AND activation_status = 'active'
        ");
        $stmt->execute([$userId, $productId, $revitVersion]);
        
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode([
                'message' => "Product deactivated successfully for Revit $revitVersion",
                'revit_version' => $revitVersion
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to deactivate product']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Deactivate product failed: ' . $e->getMessage()]);
    }
}

// Функция проверки группы плагинов
function handleCheckPluginGroup($pdo, $input, $token) {
    if (empty($input['plugin_group'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Plugin group is required']);
        return;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        $pluginGroup = $input['plugin_group'];
        
        // Для группы "Настройки" всегда возвращаем true (всегда активна)
        if ($pluginGroup === 'settings' || $pluginGroup === 'authorization') {
            $hasActiveSubscription = true;
        } else {
            // Проверяем, есть ли у пользователя активированная подписка на эту группу
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count 
                FROM user_products 
                WHERE user_id = ? 
                AND plugin_group = ? 
                AND activation_status = 'activated' 
                AND (expires_at IS NULL OR expires_at > NOW())
            ");
            $stmt->execute([$userId, $pluginGroup]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $hasActiveSubscription = $result['count'] > 0;
        }
        
        // Получаем информацию о группе
        $stmt = $pdo->prepare("
            SELECT product_name, plan_type, expires_at, activation_status
            FROM user_products 
            WHERE user_id = ? 
            AND plugin_group = ? 
            ORDER BY purchase_date DESC
            LIMIT 1
        ");
        $stmt->execute([$userId, $pluginGroup]);
        $groupInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'has_active_subscription' => $hasActiveSubscription,
            'plugin_group' => $pluginGroup,
            'group_info' => $groupInfo
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Check plugin group failed: ' . $e->getMessage()]);
    }
}

// Функция получения доступных версий продукта
function handleGetProductVersions($pdo) {
    try {
        $productName = $_GET['product'] ?? '';
        $revitVersion = $_GET['revit_version'] ?? '';
        
        if (empty($productName)) {
            http_response_code(400);
            echo json_encode(['error' => 'Product name is required']);
            return;
        }
        
        $sql = "SELECT * FROM product_versions WHERE product_name = ? AND is_active = TRUE";
        $params = [$productName];
        
        if (!empty($revitVersion)) {
            $sql .= " AND revit_version = ?";
            $params[] = $revitVersion;
        }
        
        $sql .= " ORDER BY release_date DESC, version DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $versions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode(['versions' => $versions]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get product versions: ' . $e->getMessage()]);
    }
}

// Функция скачивания MSI файла из файловой системы
function handleDownloadVersion($pdo, $input, $token) {
    try {
        // Проверяем авторизацию
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Token required']);
            return;
        }
        
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            return;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            return;
        }
        
        $userId = $payload['user_id'];
        $subscription = $input['subscription'] ?? '';
        $revitVersion = $input['revit_version'] ?? '';
        $productVersion = $input['product_version'] ?? '';
        
        if (empty($subscription) || empty($revitVersion) || empty($productVersion)) {
            http_response_code(400);
            echo json_encode(['error' => 'Subscription, revit_version and product_version are required']);
            return;
        }
        
        // Проверяем, есть ли у пользователя доступ к этой подписке
        $stmt = $pdo->prepare("
            SELECT id FROM user_products 
            WHERE user_id = ? 
            AND plugin_group = ? 
            AND (expires_at IS NULL OR expires_at > NOW())
        ");
        $stmt->execute([$userId, $subscription]);
        $userProduct = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$userProduct) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied. You need an active subscription to download this product.']);
            return;
        }
        
        // Путь к MSI файлу в новой структуре
        $filePath = __DIR__ . '/installer/' . $revitVersion . '/' . $productVersion;
        
        // Ищем MSI файл в папке
        $msiFile = null;
        if (is_dir($filePath)) {
            $files = scandir($filePath);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..') continue;
                if (is_file($filePath . '/' . $file) && pathinfo($file, PATHINFO_EXTENSION) === 'msi') {
                    $msiFile = $filePath . '/' . $file;
                    break;
                }
            }
        }
        
        if (!$msiFile || !file_exists($msiFile)) {
            http_response_code(404);
            echo json_encode(['error' => 'MSI file not found for this version']);
            return;
        }
        
        // Получаем информацию о файле
        $fileSize = filesize($msiFile);
        $fileName = basename($msiFile);
        
        // Логируем скачивание
        error_log("MSI download: User $userId downloaded $fileName from $subscription/$revitVersion/$productVersion");
        
        // Отправляем файл
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . $fileSize);
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
        
        // Читаем и отправляем файл по частям
        $handle = fopen($msiFile, 'rb');
        if ($handle) {
            while (!feof($handle)) {
                echo fread($handle, 8192);
                flush();
            }
            fclose($handle);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to read MSI file']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process download: ' . $e->getMessage()]);
    }
}

// Функция получения продуктов подписки с кэшированием
function handleGetSubscriptionProducts($pdo) {
    try {
        $subscriptionName = $_GET['subscription'] ?? '';
        
        if (empty($subscriptionName)) {
            http_response_code(400);
            echo json_encode(['error' => 'Subscription name is required']);
            return;
        }
        
        // Получаем кэшированные данные
        $cacheData = getCachedSubscriptionData($subscriptionName);
        
        if ($cacheData === null) {
            // Если кэш недоступен, сканируем файловую систему
            $cacheData = scanSubscriptionFiles($subscriptionName);
        }
        
        http_response_code(200);
        echo json_encode([
            'subscription' => $subscriptionName,
            'products' => $cacheData,
            'cache_timestamp' => getCacheTimestamp($subscriptionName)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get subscription products: ' . $e->getMessage()]);
    }
}

// Функция скачивания файла
function handleDownloadFile() {
    try {
        $revitVersion = $_GET['revit_version'] ?? '';
        $productVersion = $_GET['product_version'] ?? '';
        
        if (empty($revitVersion) || empty($productVersion)) {
            http_response_code(400);
            echo json_encode(['error' => 'Revit version and product version are required']);
            return;
        }
        
        // Убираем пробелы из версии Revit для имени файла
        $revitVersionForFile = str_replace(' ', '', $revitVersion);
        $fileName = "CivilX-{$revitVersionForFile}-v{$productVersion}.msi";
        $filePath = __DIR__ . "/installer/{$revitVersion}/{$productVersion}/{$fileName}";
        
        // Отладочная информация
        error_log("Download request: revitVersion='$revitVersion', productVersion='$productVersion'");
        error_log("Looking for file: $filePath");
        error_log("File exists: " . (file_exists($filePath) ? 'YES' : 'NO'));
        
        if (!file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['error' => 'File not found', 'path' => $filePath, 'fileName' => $fileName]);
            return;
        }
        
        // Получаем информацию о файле
        $fileSize = filesize($filePath);
        
        // Отправляем файл
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . $fileSize);
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');
        
        // Читаем и отправляем файл
        readfile($filePath);
        exit;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Download failed: ' . $e->getMessage()]);
    }
}

// Функция получения всех доступных версий
function handleGetAvailableVersions() {
    try {
        $installerPath = __DIR__ . '/installer';
        $versions = [];
        
        if (!is_dir($installerPath)) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'versions' => []
            ]);
            return;
        }
        
        // Сканируем структуру: installer/revit_version/product_version/
        $revitVersions = scandir($installerPath);
        foreach ($revitVersions as $revitVersion) {
            if ($revitVersion === '.' || $revitVersion === '..') continue;
            
            $revitPath = $installerPath . '/' . $revitVersion;
            if (!is_dir($revitPath)) continue;
            
            $productVersions = scandir($revitPath);
            foreach ($productVersions as $productVersion) {
                if ($productVersion === '.' || $productVersion === '..') continue;
                
                $versionPath = $revitPath . '/' . $productVersion;
                if (!is_dir($versionPath)) continue;
                
                // Ищем MSI файл
                $files = scandir($versionPath);
                foreach ($files as $file) {
                    if ($file === '.' || $file === '..') continue;
                    if (is_file($versionPath . '/' . $file) && pathinfo($file, PATHINFO_EXTENSION) === 'msi') {
                        $versions[] = [
                            'revit_version' => $revitVersion,
                            'product_version' => $productVersion,
                            'file_name' => $file,
                            'file_path' => 'installer/' . $revitVersion . '/' . $productVersion . '/' . $file,
                            'file_size' => filesize($versionPath . '/' . $file),
                            'last_modified' => date('c', filemtime($versionPath . '/' . $file))
                        ];
                        break; // Берем только первый MSI файл
                    }
                }
            }
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'versions' => $versions
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get available versions: ' . $e->getMessage()]);
    }
}

// Функция сканирования файловой системы
function scanSubscriptionFiles($subscriptionName) {
    // Новая структура: installer/revit_version/product_version/
    $installerPath = __DIR__ . '/installer';
    $artifacts = [];
    
    if (!is_dir($installerPath)) {
        return $artifacts;
    }
    
    // Сканируем структуру: installer/revit_version/product_version/
    $revitVersions = scandir($installerPath);
    foreach ($revitVersions as $revitVersion) {
        if ($revitVersion === '.' || $revitVersion === '..') continue;
        
        $revitPath = $installerPath . '/' . $revitVersion;
        if (!is_dir($revitPath)) continue;
        
        $productVersions = scandir($revitPath);
        foreach ($productVersions as $productVersion) {
            if ($productVersion === '.' || $productVersion === '..') continue;
            
            $versionPath = $revitPath . '/' . $productVersion;
            if (!is_dir($versionPath)) continue;
            
            // Ищем MSI файл для скачивания
            $files = scandir($versionPath);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..') continue;
                if (is_file($versionPath . '/' . $file) && pathinfo($file, PATHINFO_EXTENSION) === 'msi') {
                    $artifacts[] = [
                        'subscription' => $subscriptionName,
                        'revit_version' => $revitVersion,
                        'product_version' => $productVersion,
                        'relative_path' => 'installer/' . $revitVersion . '/' . $productVersion . '/' . $file,
                        'file_size' => filesize($versionPath . '/' . $file),
                        'last_modified' => date('c', filemtime($versionPath . '/' . $file))
                    ];
                    break; // Берем только первый MSI файл
                }
            }
        }
    }
    
    // Обновляем кэш
    updateSubscriptionCache($subscriptionName, $artifacts);
    
    return $artifacts;
}

// Функция получения кэшированных данных
function getCachedSubscriptionData($subscriptionName) {
    $cacheFile = __DIR__ . '/subscriptions/cache.json';
    $tmpCacheFile = __DIR__ . '/subscriptions/cache.tmp.json';
    
    // Проверяем, нужно ли обновить кэш (старше 5 минут)
    if (file_exists($cacheFile)) {
        $cacheData = json_decode(file_get_contents($cacheFile), true);
        $cacheTime = strtotime($cacheData['timestamp'] ?? '1970-01-01');
        
        if (time() - $cacheTime < 300) { // 5 минут
            return $cacheData['artifacts'] ?? [];
        }
    }
    
    // Пытаемся обновить кэш в фоне
    if (file_exists($tmpCacheFile)) {
        // Если есть временный файл, значит обновление уже идет
        return $cacheData['artifacts'] ?? [];
    }
    
    return null; // Нужно сканировать файловую систему
}

// Функция обновления кэша
function updateSubscriptionCache($subscriptionName, $artifacts) {
    $cacheFile = __DIR__ . '/subscriptions/cache.json';
    $tmpCacheFile = __DIR__ . '/subscriptions/cache.tmp.json';
    
    try {
        // Читаем существующий кэш
        $cacheData = ['timestamp' => date('c'), 'artifacts' => []];
        if (file_exists($cacheFile)) {
            $existingCache = json_decode(file_get_contents($cacheFile), true);
            if ($existingCache) {
                $cacheData = $existingCache;
            }
        }
        
        // Обновляем данные для конкретной подписки
        $cacheData['timestamp'] = date('c');
        $cacheData['artifacts'] = array_filter($cacheData['artifacts'] ?? [], function($artifact) use ($subscriptionName) {
            return $artifact['subscription'] !== $subscriptionName;
        });
        
        // Добавляем новые данные
        $cacheData['artifacts'] = array_merge($cacheData['artifacts'], $artifacts);
        
        // Записываем во временный файл
        file_put_contents($tmpCacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
        
        // Атомарно заменяем основной файл
        rename($tmpCacheFile, $cacheFile);
        
    } catch (Exception $e) {
        // Логируем ошибку
        error_log("Cache update failed for subscription $subscriptionName: " . $e->getMessage());
        
        // Удаляем временный файл при ошибке
        if (file_exists($tmpCacheFile)) {
            unlink($tmpCacheFile);
        }
    }
}

// Функция получения времени кэша
function getCacheTimestamp($subscriptionName) {
    $cacheFile = __DIR__ . '/subscriptions/cache.json';
    
    if (file_exists($cacheFile)) {
        $cacheData = json_decode(file_get_contents($cacheFile), true);
        return $cacheData['timestamp'] ?? null;
    }
    
    return null;
}

// Функция получения активаций продуктов по версиям Revit
function handleGetProductActivations($pdo, $token = null) {
    // Если токен не передан, пытаемся получить из заголовков
    if (!$token) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Token required']);
        exit;
    }
    
    try {
        // Декодирование токена
        $tokenParts = explode('.', $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            exit;
        }
        
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1])), true);
        if (!$payload || !isset($payload['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token payload']);
            exit;
        }
        
        $userId = $payload['user_id'];
        
        // Получаем все активации пользователя с информацией о продуктах
        $stmt = $pdo->prepare("
            SELECT 
                pa.id,
                pa.product_id,
                pa.revit_version,
                pa.product_version,
                pa.activation_status,
                pa.activated_at,
                pa.deactivated_at,
                up.product_name,
                up.plugin_group
            FROM product_activations pa
            JOIN user_products up ON pa.product_id = up.id
            WHERE pa.user_id = ?
            ORDER BY up.product_name, pa.revit_version
        ");
        $stmt->execute([$userId]);
        $activations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Отладочная информация
        error_log("Product activations for user $userId: " . json_encode($activations));
        
        // Группируем активации по продуктам
        $groupedActivations = [];
        foreach ($activations as $activation) {
            $productId = $activation['product_id'];
            if (!isset($groupedActivations[$productId])) {
                $groupedActivations[$productId] = [
                    'product_id' => $productId,
                    'product_name' => $activation['product_name'],
                    'plugin_group' => $activation['plugin_group'],
                    'revit_versions' => []
                ];
            }
            
            $groupedActivations[$productId]['revit_versions'][] = [
                'revit_version' => $activation['revit_version'],
                'product_version' => $activation['product_version'],
                'activation_status' => $activation['activation_status'],
                'activated_at' => $activation['activated_at'],
                'deactivated_at' => $activation['deactivated_at']
            ];
        }
        
        http_response_code(200);
        echo json_encode([
            'activations' => array_values($groupedActivations)
        ], JSON_UNESCAPED_UNICODE);
        exit;
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Get product activations failed: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function handleGetVersion() {
    try {
        $versionCode = $_POST['version_code'] ?? '';
        
        if (empty($versionCode)) {
            http_response_code(400);
            echo json_encode(['error' => 'Version code is required']);
            return;
        }
        
        // Таблица версий плагинов
        $createVersionsTable = "
        CREATE TABLE IF NOT EXISTS plugin_versions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            version_code VARCHAR(50) UNIQUE NOT NULL,
            version_number VARCHAR(20) NOT NULL,
            release_date DATE,
            is_current BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";
        $pdo->exec($createVersionsTable);
        
        // Проверяем, есть ли версия в базе
        $stmt = $pdo->prepare("SELECT version_number, is_current FROM plugin_versions WHERE version_code = ?");
        $stmt->execute([$versionCode]);
        $version = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($version) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'version_code' => $versionCode,
                'version_number' => $version['version_number'],
                'is_current' => (bool)$version['is_current']
            ]);
        } else {
            // Если версия не найдена, возвращаем базовую версию
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'version_code' => $versionCode,
                'version_number' => '1.0',
                'is_current' => true
            ]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Get version failed: ' . $e->getMessage()]);
    }
}

?>
