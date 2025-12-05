<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

try {
    $helpPath = '../installer/Help_information/';
    
    // Проверяем существование папки
    if (!is_dir($helpPath)) {
        throw new Exception('Папка Help_information не найдена');
    }
    
    // Получаем список папок
    $folders = [];
    $items = scandir($helpPath);
    
    foreach ($items as $item) {
        // Пропускаем текущую и родительскую папки
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        // Проверяем, что это папка
        $fullPath = $helpPath . $item;
        if (is_dir($fullPath)) {
            $folders[] = $item;
        }
    }
    
    // Сортируем папки по алфавиту
    sort($folders);
    
    // Возвращаем результат
    echo json_encode([
        'success' => true,
        'folders' => $folders,
        'count' => count($folders)
    ]);
    
} catch (Exception $e) {
    // В случае ошибки возвращаем пустой список
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'folders' => [],
        'count' => 0
    ]);
}
?>

