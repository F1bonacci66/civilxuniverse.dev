<?php
// Простой тест PHP
header('Content-Type: text/html; charset=utf-8');
echo "<h1>Тест PHP работает!</h1>";
echo "<p>Время: " . date('Y-m-d H:i:s') . "</p>";
echo "<p>Версия PHP: " . phpversion() . "</p>";
echo "<p>Сервер: " . $_SERVER['SERVER_SOFTWARE'] . "</p>";
echo "<p>Документ рут: " . $_SERVER['DOCUMENT_ROOT'] . "</p>";
echo "<p>Текущий файл: " . __FILE__ . "</p>";
?>

