# Финальный скрипт настройки домена civilxuniverse.ru
# Выполнит все действия за один запуск
# Использование: .\final-setup.ps1

$Server = "root@95.163.230.61"
$Password = "7LfOgcrTvZxbMR9Y"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Настройка домена civilxuniverse.ru" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Введите пароль при запросе: $Password" -ForegroundColor Yellow
Write-Host ""

# Шаг 1: Копирование next.config.mjs
Write-Host "[1/4] Копирование next.config.mjs на сервер..." -ForegroundColor Yellow
$localConfig = "c:\Projects\CivilX\Site\civilx-website\universe\universe\next.config.mjs"
$remoteConfig = "/opt/civilx-universe/universe/next.config.mjs"

# Создаем команду для копирования через base64
$configContent = Get-Content $localConfig -Raw -Encoding UTF8
$configBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($configContent))

$copyCommand = @'
mkdir -p /opt/civilx-universe/universe
echo '{0}' | base64 -d > /opt/civilx-universe/universe/next.config.mjs
chmod 644 /opt/civilx-universe/universe/next.config.mjs
echo "✅ Файл скопирован"
ls -la /opt/civilx-universe/universe/next.config.mjs
'@ -f $configBase64

$copyCommand = $copyCommand -replace "`r`n", "`n"
$copyCommand | ssh -o StrictHostKeyChecking=no $Server "bash -s"

Write-Host ""

# Шаг 2: Обновление конфигурации
Write-Host "[2/4] Обновление конфигурации..." -ForegroundColor Yellow
$updateCommand = @'
cd /opt/civilx-universe/universe
if [ -f "next.config.mjs" ]; then
    cp next.config.mjs next.config.mjs.backup.$(date +%Y%m%d_%H%M%S)
    sed -i "s|basePath: '/Universe',|// basePath: '/Universe',|g" next.config.mjs
    sed -i "s|assetPrefix: '/Universe',|// assetPrefix: '/Universe',|g" next.config.mjs
    echo "✅ Конфигурация обновлена"
    echo "Проверка:"
    grep -A 1 "basePath\|assetPrefix" next.config.mjs | head -4
else
    echo "❌ Файл next.config.mjs не найден"
fi
'@

$updateCommand = $updateCommand -replace "`r`n", "`n"
$updateCommand | ssh -o StrictHostKeyChecking=no $Server "bash -s"

Write-Host ""

# Шаг 3: Пересборка Docker
Write-Host "[3/4] Пересборка Docker образа (это займет несколько минут)..." -ForegroundColor Yellow
$rebuildCommand = @'
cd /opt/civilx-universe
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

echo "Используется файл: $COMPOSE_FILE"
docker-compose -f "$COMPOSE_FILE" down
docker-compose -f "$COMPOSE_FILE" build --no-cache universe
docker-compose -f "$COMPOSE_FILE" up -d

echo "Ожидание запуска..."
sleep 20

echo "Статус контейнера:"
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "Последние логи:"
docker-compose -f "$COMPOSE_FILE" logs --tail=15 universe
'@

$rebuildCommand = $rebuildCommand -replace "`r`n", "`n"
$rebuildCommand | ssh -o StrictHostKeyChecking=no $Server "bash -s"

Write-Host ""

# Шаг 4: Проверка
Write-Host "[4/4] Проверка доступности..." -ForegroundColor Yellow
$checkCommand = @'
sleep 5
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo "✅ Приложение доступно на http://localhost:3001/"
    curl -s http://localhost:3001/ | head -5
else
    echo "⚠️  Приложение еще запускается, подождите немного"
    echo "Проверьте логи: docker-compose -f docker-compose.yml logs universe"
fi
'@

$checkCommand = $checkCommand -replace "`r`n", "`n"
$checkCommand | ssh -o StrictHostKeyChecking=no $Server "bash -s"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Настройка Universe завершена!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Следующие шаги для настройки Apache:" -ForegroundColor Yellow
Write-Host "1. Найдите корневую директорию домена civilxuniverse.ru" -ForegroundColor White
Write-Host "2. Создайте .htaccess с содержимым из .htaccess.civilxuniverse" -ForegroundColor White
Write-Host "3. Включите модули: a2enmod proxy proxy_http rewrite headers deflate expires" -ForegroundColor White
Write-Host "4. Перезагрузите Apache: systemctl reload apache2" -ForegroundColor White
Write-Host ""

