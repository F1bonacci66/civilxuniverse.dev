# Автоматическая настройка домена civilxuniverse.ru
# Использование: .\auto-setup.ps1

$Server = "root@95.163.230.61"
$Password = "7LfOgcrTvZxbMR9Y"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Настройка домена civilxuniverse.ru" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Создаем скрипт для выполнения на сервере
$remoteScript = @"
#!/bin/bash
set -e

echo "[1/6] Поиск директории Universe..."
UNIVERSE_DIR=`$(find /opt -type d -name "universe" 2>/dev/null | head -1)

if [ -z "`$UNIVERSE_DIR" ]; then
    echo "❌ Директория не найдена, используем стандартный путь"
    UNIVERSE_DIR="/opt/civilx-universe/universe"
fi

echo "✅ Найдена директория: `$UNIVERSE_DIR"
echo ""

echo "[2/6] Обновление next.config.mjs..."
cd "`$UNIVERSE_DIR"

if [ ! -f "next.config.mjs" ]; then
    echo "❌ Файл next.config.mjs не найден"
    exit 1
fi

# Создать резервную копию
BACKUP_FILE="next.config.mjs.backup.`$(date +%Y%m%d_%H%M%S)"
cp next.config.mjs "`$BACKUP_FILE"
echo "✅ Создана резервная копия: `$BACKUP_FILE"

# Закомментировать basePath и assetPrefix
sed -i "s|basePath: '/Universe',|// basePath: '/Universe',|g" next.config.mjs
sed -i "s|assetPrefix: '/Universe',|// assetPrefix: '/Universe',|g" next.config.mjs

echo "Проверка изменений:"
grep -A 1 "basePath\|assetPrefix" next.config.mjs | head -4
echo "✅ Конфигурация обновлена"
echo ""

echo "[3/6] Пересборка Docker образа..."
cd "`$(dirname `$UNIVERSE_DIR)"

if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

echo "Используется файл: `$COMPOSE_FILE"

# Остановить контейнер
echo "Остановка контейнера..."
docker-compose -f "`$COMPOSE_FILE" down

# Пересобрать образ
echo "Пересборка образа (это может занять несколько минут)..."
docker-compose -f "`$COMPOSE_FILE" build --no-cache universe

# Запустить контейнер
echo "Запуск контейнера..."
docker-compose -f "`$COMPOSE_FILE" up -d

echo "✅ Docker пересобран и перезапущен"
echo ""

echo "[4/6] Ожидание запуска контейнера..."
sleep 15

echo "[5/6] Проверка статуса..."
docker-compose -f "`$COMPOSE_FILE" ps
echo ""
echo "Последние логи:"
docker-compose -f "`$COMPOSE_FILE" logs --tail=10 universe
echo ""

echo "[6/6] Проверка доступности..."
sleep 5
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo "✅ Приложение доступно на http://localhost:3001/"
else
    echo "⚠️  Приложение еще запускается, подождите немного"
fi

echo ""
echo "========================================"
echo "✅ Настройка Universe завершена!"
echo "========================================"
"@

# Сохраняем скрипт во временный файл с правильными окончаниями строк (LF)
$tempScript = [System.IO.Path]::GetTempFileName() + ".sh"
# Конвертируем CRLF в LF
$remoteScript = $remoteScript -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($tempScript, $remoteScript, [System.Text.UTF8Encoding]::new($false))

Write-Host "[*] Подключение к серверу и выполнение скрипта..." -ForegroundColor Yellow
Write-Host "[*] Введите пароль при запросе: $Password" -ForegroundColor Yellow
Write-Host ""

# Передаем скрипт через SSH
$scriptContent = [System.IO.File]::ReadAllText($tempScript, [System.Text.UTF8Encoding]::new($false))
$scriptContent | ssh -o StrictHostKeyChecking=no $Server "bash -s"

# Удаляем временный файл
Remove-Item $tempScript -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Настройка завершена!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Yellow
Write-Host "1. Найдите корневую директорию домена civilxuniverse.ru" -ForegroundColor White
Write-Host "2. Создайте .htaccess с содержимым из .htaccess.civilxuniverse" -ForegroundColor White
Write-Host "3. Включите модули Apache: a2enmod proxy proxy_http rewrite headers deflate expires" -ForegroundColor White
Write-Host "4. Перезагрузите Apache: systemctl reload apache2" -ForegroundColor White
Write-Host ""

