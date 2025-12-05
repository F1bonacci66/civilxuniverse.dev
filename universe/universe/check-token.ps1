# Скрипт для проверки GitHub токена
param(
    [string]$Token = $env:GITHUB_TOKEN
)

if (-not $Token) {
    Write-Host "ОШИБКА: Токен не указан!" -ForegroundColor Red
    Write-Host "Использование: .\check-token.ps1 -Token 'your-token'" -ForegroundColor Yellow
    Write-Host "Или установите: `$env:GITHUB_TOKEN = 'your-token'" -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Проверка GitHub Personal Access Token" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка формата токена
if ($Token -notmatch '^ghp_[A-Za-z0-9]{36}$') {
    Write-Host "⚠️  ВНИМАНИЕ: Токен не соответствует стандартному формату (ghp_...)" -ForegroundColor Yellow
    Write-Host "   Длина токена: $($Token.Length) символов" -ForegroundColor White
} else {
    Write-Host "✓ Формат токена корректный" -ForegroundColor Green
}

# Проверка через GitHub API
Write-Host ""
Write-Host "Проверка токена через GitHub API..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "token $Token"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -Method Get
    Write-Host "✓ Токен валидный!" -ForegroundColor Green
    Write-Host "  Пользователь: $($response.login)" -ForegroundColor White
    Write-Host "  Имя: $($response.name)" -ForegroundColor White
} catch {
    Write-Host "✗ ОШИБКА: Токен невалидный или истек!" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor White
    exit 1
}

# Проверка прав токена
Write-Host ""
Write-Host "Проверка прав токена..." -ForegroundColor Yellow

try {
    # Попытка доступа к packages API
    $packagesResponse = Invoke-RestMethod -Uri "https://api.github.com/user/packages?package_type=container" -Headers $headers -Method Get -ErrorAction SilentlyContinue
    Write-Host "✓ Токен имеет доступ к packages API" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ВНИМАНИЕ: Не удалось проверить доступ к packages API" -ForegroundColor Yellow
    Write-Host "  Убедитесь, что токен имеет права: read:packages, write:packages" -ForegroundColor White
}

# Проверка Docker login
Write-Host ""
Write-Host "Проверка входа в Docker Registry..." -ForegroundColor Yellow

try {
    $loginResult = echo $Token | docker login ghcr.io -u F1bonacci66 --password-stdin 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Успешный вход в ghcr.io!" -ForegroundColor Green
    } else {
        Write-Host "✗ ОШИБКА входа в Docker Registry!" -ForegroundColor Red
        Write-Host "  $loginResult" -ForegroundColor White
        Write-Host ""
        Write-Host "Возможные причины:" -ForegroundColor Yellow
        Write-Host "  1. Токен не имеет прав read:packages и write:packages" -ForegroundColor White
        Write-Host "  2. Проверьте токен на: https://github.com/settings/tokens" -ForegroundColor White
    }
} catch {
    Write-Host "✗ ОШИБКА: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan




