# PowerShell скрипт для применения исправленной конфигурации Nginx

$SERVER = "95.163.230.61"
$USER = "root"
$SSH_KEY = "C:\Users\dimag\.ssh\Universe"

Write-Host "🔧 Применение исправленной конфигурации Nginx для api.civilx.ru" -ForegroundColor Cyan
Write-Host ""

# Проверяем наличие файлов
if (-not (Test-Path "api_nginx_fixed.conf")) {
    Write-Host "❌ Ошибка: файл api_nginx_fixed.conf не найден!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "apply-nginx-fix.sh")) {
    Write-Host "❌ Ошибка: файл apply-nginx-fix.sh не найден!" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Копирование файлов на сервер..." -ForegroundColor Yellow
Write-Host "   (Если потребуется пароль, введите: 7LfOgcrTvZxbMR9Y)" -ForegroundColor Gray
Write-Host ""

# Копируем файлы на сервер
Write-Host "   Копирование api_nginx_fixed.conf..." -ForegroundColor Gray
scp -i $SSH_KEY api_nginx_fixed.conf ${USER}@${SERVER}:/root/ 2>&1
if ($?) {
    Write-Host "   ✅ api_nginx_fixed.conf скопирован" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Попытка без ключа..." -ForegroundColor Yellow
    scp api_nginx_fixed.conf ${USER}@${SERVER}:/root/
}

Write-Host "   Копирование apply-nginx-fix.sh..." -ForegroundColor Gray
scp -i $SSH_KEY apply-nginx-fix.sh ${USER}@${SERVER}:/root/ 2>&1
if ($?) {
    Write-Host "   ✅ apply-nginx-fix.sh скопирован" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Попытка без ключа..." -ForegroundColor Yellow
    scp apply-nginx-fix.sh ${USER}@${SERVER}:/root/
}

Write-Host ""
Write-Host "🚀 Применение конфигурации на сервере..." -ForegroundColor Yellow
Write-Host "   (Если потребуется пароль, введите: 7LfOgcrTvZxbMR9Y)" -ForegroundColor Gray
Write-Host ""

# Применяем конфигурацию
$sshCmd = "cd /root; chmod +x apply-nginx-fix.sh; ./apply-nginx-fix.sh"
ssh -i $SSH_KEY ${USER}@${SERVER} $sshCmd 2>&1
if (-not $?) {
    Write-Host "   Попытка без ключа..." -ForegroundColor Yellow
    ssh ${USER}@${SERVER} $sshCmd
}

Write-Host ""
Write-Host "ГОТОВО! Конфигурация применена." -ForegroundColor Green
Write-Host ""
Write-Host "Проверьте в браузере:" -ForegroundColor Cyan
Write-Host "   http://civilxuniverse.ru/auth/register" -ForegroundColor White
