<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Настройки базы данных - ИЗМЕНЕНЫ ДЛЯ НОВОГО ХОСТИНГА
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
    
    // Получаем токен из заголовков
    $headers = getallheaders();
    $token = null;
    if (isset($headers['Authorization'])) {
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
define('JWT_SECRET', 'your_super_secret_jwt_key_for_php');

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
    if (empty($input['email']) || empty($input['password']) || empty($input['name']) || empty($input['user_type']) || empty($input['login'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Все обязательные поля должны быть заполнены']);
        return;
    }
    
    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Некорректный email']);
        return;
    }
    
    // Валидация логина
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

function handleGetUser($pdo) {
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

// Функция получения продуктов пользователя
function handleGetUserProducts($pdo) {
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
        
        // Получение продуктов пользователя
        $stmt = $pdo->prepare("SELECT * FROM user_products WHERE user_id = ? ORDER BY purchase_date DESC");
        $stmt->execute([$userId]);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
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
            } else {
                $product['activation_status'] = 'ready';
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

// Остальные функции остаются без изменений...
// (Для краткости не копирую все функции, но они должны быть скопированы из работающего API)

?>
