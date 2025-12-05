<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

try {
    // Получаем название папки из параметра
    $folderName = $_GET['folder'] ?? '';
    
    if (empty($folderName)) {
        throw new Exception('Не указано название папки');
    }
    
    // Проверяем безопасность пути
    if (strpos($folderName, '..') !== false || strpos($folderName, '/') !== false) {
        throw new Exception('Недопустимое название папки');
    }
    
    $folderPath = '../installer/Help_information/' . $folderName . '/';
    
    // Проверяем существование папки
    if (!is_dir($folderPath)) {
        throw new Exception('Папка не найдена');
    }
    
    // Получаем список файлов
    $files = [];
    $items = scandir($folderPath);
    
    foreach ($items as $item) {
        // Пропускаем текущую и родительскую папки
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        // Проверяем, что это файл
        $fullPath = $folderPath . $item;
        if (is_file($fullPath)) {
            // Проверяем, что это архив
            $extension = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (in_array($extension, ['zip', 'rar', '7z', 'tar', 'gz'])) {
                $files[] = [
                    'name' => $item,
                    'size' => filesize($fullPath),
                    'extension' => $extension
                ];
            }
        }
    }
    
    // Сортируем файлы по имени
    usort($files, function($a, $b) {
        return strcmp($a['name'], $b['name']);
    });
    
    // Возвращаем результат
    echo json_encode([
        'success' => true,
        'folder' => $folderName,
        'files' => $files,
        'count' => count($files)
    ]);
    
} catch (Exception $e) {
    // В случае ошибки возвращаем пустой список
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'files' => [],
        'count' => 0
    ]);
}
?>

