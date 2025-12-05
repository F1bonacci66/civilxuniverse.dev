# PowerShell скрипт для автоматического исправления Nginx на сервере

$server = "root@95.163.230.61"
$password = "7LfOgcrTvZxbMR9Y"

Write-Host "🔧 Попытка подключения к серверу и исправления Nginx..." -ForegroundColor Cyan

# Функция для выполнения команды через SSH с паролем
function Invoke-SSHCommand {
    param(
        [string]$Server,
        [string]$Command,
        [string]$Password
    )
    
    # Используем sshpass или expect для автоматической передачи пароля
    # В Windows можно использовать plink или установить sshpass через WSL
    
    # Альтернативный способ - использовать здесь-документ через ssh
    $scriptBlock = @"
$Command
"@
    
    # Сохраняем команду во временный файл
    $tempFile = [System.IO.Path]::GetTempFileName()
    $scriptBlock | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Копируем скрипт на сервер
    Write-Host "📤 Копирование скрипта на сервер..." -ForegroundColor Yellow
    scp $tempFile "${server}:/tmp/fix-nginx-auto.sh"
    
    # Выполняем скрипт
    Write-Host "▶️  Выполнение скрипта на сервере..." -ForegroundColor Yellow
    ssh $server "chmod +x /tmp/fix-nginx-auto.sh && /tmp/fix-nginx-auto.sh"
    
    # Удаляем временный файл
    Remove-Item $tempFile -Force
}

# Копируем исправленную конфигурацию
Write-Host "📤 Копирование конфигурации на сервер..." -ForegroundColor Yellow
scp api_nginx_config.conf "${server}:/tmp/api_nginx_fixed.conf"

# Копируем скрипт исправления
Write-Host "📤 Копирование скрипта исправления..." -ForegroundColor Yellow
scp fix-nginx-auto.sh "${server}:/tmp/"

# Выполняем скрипт
Write-Host "▶️  Выполнение скрипта исправления..." -ForegroundColor Yellow
ssh $server "chmod +x /tmp/fix-nginx-auto.sh && /tmp/fix-nginx-auto.sh"

Write-Host ""
Write-Host "✅ Готово! Проверьте API:" -ForegroundColor Green
Write-Host "   https://api.civilx.ru/api/datalab/health" -ForegroundColor Cyan




