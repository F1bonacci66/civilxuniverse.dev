<?php
header('Content-Type: application/json; charset=utf-8');

// Проверяем, определена ли константа JWT_SECRET
if (!defined('JWT_SECRET')) {
    define('JWT_SECRET', 'your_super_secret_jwt_key_for_php');
}

echo json_encode([
    'status' => 'success',
    'jwt_secret_defined' => defined('JWT_SECRET'),
    'jwt_secret_value' => JWT_SECRET,
    'timestamp' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE);
?>
