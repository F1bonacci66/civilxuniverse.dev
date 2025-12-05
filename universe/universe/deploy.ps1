# Скрипт для быстрого деплоя CivilX.Universe
# Использование: .\deploy.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Деплой CivilX.Universe на хостинг" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Проверка наличия Node.js
try {
    $nodeVersion = node --version
    Write-Host "`nNode.js версия: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "`nОШИБКА: Node.js не установлен!" -ForegroundColor Red
    Write-Host "Установите Node.js с https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Переход в директорию проекта
$projectDir = Join-Path $PSScriptRoot "."
if (-not (Test-Path (Join-Path $projectDir "package.json"))) {
    Write-Host "`nОШИБКА: package.json не найден!" -ForegroundColor Red
    Write-Host "Убедитесь, что вы запускаете скрипт из директории проекта" -ForegroundColor Yellow
    exit 1
}

Set-Location $projectDir

# Шаг 1: Установка зависимостей (если нужно)
if (-not (Test-Path "node_modules")) {
    Write-Host "`n[1/4] Установка зависимостей..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ОШИБКА при установке зависимостей!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[1/4] Зависимости уже установлены" -ForegroundColor Green
}

# Шаг 2: Сборка проекта
Write-Host "`n[2/4] Сборка проекта..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ОШИБКА при сборке проекта!" -ForegroundColor Red
    exit 1
}

# Проверка наличия папки out
if (-not (Test-Path "out")) {
    Write-Host "`nОШИБКА: Папка 'out' не создана после сборки!" -ForegroundColor Red
    exit 1
}

# Шаг 3: Копирование .htaccess
Write-Host "`n[3/4] Копирование .htaccess..." -ForegroundColor Yellow
if (Test-Path "output\.htaccess") {
    Copy-Item "output\.htaccess" "out\.htaccess" -Force
    Write-Host "✓ .htaccess скопирован" -ForegroundColor Green
} else {
    Write-Host "⚠ .htaccess не найден в output, будет создан базовый" -ForegroundColor Yellow
    $htaccessContent = @"
# Rewrite rules for Next.js static export
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /universe/universe/

  # Handle client-side routing
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_URI} !^/universe/universe/_next/
  
  # For app routes, try index.html
  RewriteCond %{REQUEST_URI} ^/universe/universe/app/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^app/(.*)$ /universe/universe/app/$1/index.html [L]
  
  # Fallback to index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
"@
    Set-Content -Path "out\.htaccess" -Value $htaccessContent
}

# Шаг 4: Создание архива
Write-Host "`n[4/4] Создание архива для загрузки..." -ForegroundColor Yellow
$date = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "universe-deploy-$date.zip"

# Удаляем старые архивы деплоя (опционально)
Get-ChildItem -Path $projectDir -Filter "universe-deploy-*.zip" | Remove-Item -Force -ErrorAction SilentlyContinue

# Создаем архив
Set-Location out
Compress-Archive -Path * -DestinationPath "..\$archiveName" -Force
Set-Location ..

if (-not (Test-Path $archiveName)) {
    Write-Host "ОШИБКА: Не удалось создать архив!" -ForegroundColor Red
    exit 1
}

# Информация о размере
$archiveSize = (Get-Item $archiveName).Length / 1MB
Write-Host "`n[4/4] Готово!" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "   Деплой завершен успешно!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nАрхив создан: $archiveName" -ForegroundColor White
Write-Host "Размер архива: $([math]::Round($archiveSize, 2)) MB" -ForegroundColor White
Write-Host "`nСледующие шаги:" -ForegroundColor Yellow
Write-Host "1. Загрузите архив '$archiveName' на хостинг" -ForegroundColor White
Write-Host "2. Распакуйте архив в папку Universe" -ForegroundColor White
Write-Host "3. Убедитесь, что файл .htaccess находится в корне" -ForegroundColor White
Write-Host "4. Проверьте работу сайта" -ForegroundColor White
Write-Host "`n========================================" -ForegroundColor Cyan
