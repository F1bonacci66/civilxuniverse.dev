# Скрипт сборки Docker образа для CivilX.Universe
# Использование: .\build-docker.ps1 [tag]

param(
    [string]$Tag = "latest",
    [string]$ImageName = "civilx-universe"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Сборка Docker образа для деплоя" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Проверка Docker
Write-Host ""
Write-Host "[1/5] Проверка Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "Docker найден: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "ОШИБКА: Docker не найден!" -ForegroundColor Red
    Write-Host "Установите Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# Проверка, что Docker Desktop запущен
Write-Host ""
Write-Host "Проверка статуса Docker Desktop..." -ForegroundColor Yellow
$dockerCheck = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ОШИБКА: Docker Desktop не запущен!" -ForegroundColor Red
    Write-Host "Запустите Docker Desktop и подождите, пока он полностью загрузится" -ForegroundColor Yellow
    Write-Host "Затем повторите попытку" -ForegroundColor Yellow
    exit 1
}
Write-Host "Docker Desktop запущен и готов" -ForegroundColor Green

# Проверка текущей директории
Write-Host ""
Write-Host "[2/5] Проверка директории..." -ForegroundColor Yellow
if (-not (Test-Path "Dockerfile")) {
    Write-Host "ОШИБКА: Dockerfile не найден!" -ForegroundColor Red
    Write-Host "Запустите скрипт из директории universe/universe/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Dockerfile найден" -ForegroundColor Green

# Проверка необходимых файлов
Write-Host ""
Write-Host "[3/5] Проверка файлов..." -ForegroundColor Yellow
$requiredFiles = @("package.json", "next.config.mjs", "tsconfig.json", "tailwind.config.ts", "postcss.config.mjs")
$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}
if ($missingFiles.Count -gt 0) {
    Write-Host "ОШИБКА: Отсутствуют файлы: $($missingFiles -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "Все необходимые файлы найдены" -ForegroundColor Green

# Включение BuildKit
Write-Host ""
Write-Host "[4/5] Настройка BuildKit..." -ForegroundColor Yellow
$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"
Write-Host "BuildKit включен" -ForegroundColor Green

# Сборка образа
Write-Host ""
Write-Host "[5/5] Сборка Docker образа..." -ForegroundColor Yellow
Write-Host "Образ: ${ImageName}:${Tag}" -ForegroundColor White
Write-Host "Это может занять 5-10 минут при первой сборке..." -ForegroundColor White

# Определяем API URL для сборки (можно переопределить через переменную окружения)
$apiUrl = $env:NEXT_PUBLIC_API_URL
if (-not $apiUrl) {
    $apiUrl = "https://api.civilx.ru/api/datalab"
}

$buildCommand = "docker build --build-arg NEXT_PUBLIC_API_URL=$apiUrl -t ${ImageName}:${Tag} -t ${ImageName}:latest ."
Write-Host ""
Write-Host "Выполняется: $buildCommand" -ForegroundColor Gray

try {
    Invoke-Expression $buildCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "   Сборка завершена успешно!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        
        # Показываем информацию об образе
        Write-Host ""
        Write-Host "Информация об образе:" -ForegroundColor Cyan
        docker images ${ImageName}:${Tag} | Select-Object -First 2
        
        Write-Host ""
        Write-Host "Следующие шаги:" -ForegroundColor Cyan
        Write-Host "1. Проверить образ: docker images ${ImageName}:${Tag}" -ForegroundColor White
        Write-Host "2. Протестировать локально: docker run -d -p 3001:3001 --name test-universe ${ImageName}:${Tag}" -ForegroundColor White
        Write-Host "3. Сохранить образ: docker save -o ${ImageName}-${Tag}.tar ${ImageName}:${Tag}" -ForegroundColor White
        Write-Host "4. Загрузить на сервер и запустить (см. DEPLOY_DOCKER.md)" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "ОШИБКА при сборке образа!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    $errorMsg = $_.Exception.Message
    Write-Host "ОШИБКА: $errorMsg" -ForegroundColor Red
    exit 1
}