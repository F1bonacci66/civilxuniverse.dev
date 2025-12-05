<?php
header('Content-Type: application/json; charset=utf-8');

// Проверяем версию API
$apiFile = __DIR__ . '/auth-api.php';
$fileExists = file_exists($apiFile);
$fileSize = $fileExists ? filesize($apiFile) : 0;
$lastModified = $fileExists ? date('Y-m-d H:i:s', filemtime($apiFile)) : null;

// Читаем содержимое файла
$content = $fileExists ? file_get_contents($apiFile) : '';
$hasJwtSecret = strpos($content, 'JWT_SECRET') !== false;
$hasForceUpdate = strpos($content, 'ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ') !== false;
$hasUpdateComment = strpos($content, 'ОБНОВЛЕНО: 2025-10-02 15:40:00') !== false;

// Проверяем, определена ли константа
if (!defined('JWT_SECRET')) {
    define('JWT_SECRET', 'your_super_secret_jwt_key_for_php');
}

echo json_encode([
    'status' => 'success',
    'api_file' => [
        'exists' => $fileExists,
        'size' => $fileSize,
        'last_modified' => $lastModified,
        'has_jwt_secret' => $hasJwtSecret,
        'has_force_update' => $hasForceUpdate,
        'has_update_comment' => $hasUpdateComment
    ],
    'jwt_secret' => [
        'defined' => defined('JWT_SECRET'),
        'value' => JWT_SECRET
    ],
    'timestamp' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE);
?>
