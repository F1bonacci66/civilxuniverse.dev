# Скрипт для удаления Docker образа из GitHub Container Registry
# Использование: .\delete-ghcr-image.ps1 [tag] [github-username]

param(
    [string]$Tag = "latest",
    [string]$GitHubUsername = "F1bonacci66",
    [string]$ImageName = "civilx-universe"
)

$PackageName = $ImageName

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Удаление образа из GitHub Container Registry" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Проверка GitHub Token
Write-Host ""
Write-Host "[1/3] Проверка GitHub Token..." -ForegroundColor Yellow
$token = $env:GITHUB_TOKEN
if (-not $token) {
    Write-Host "Переменная GITHUB_TOKEN не установлена" -ForegroundColor Yellow
    $token = Read-Host "Введите GitHub Personal Access Token"
    if (-not $token) {
        Write-Host "ОШИБКА: Токен не указан!" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Токен найден" -ForegroundColor Green

# Получаем список версий пакета
Write-Host ""
Write-Host "[2/3] Получение списка версий пакета..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$packageUrl = "https://api.github.com/users/$GitHubUsername/packages/container/$PackageName/versions"

try {
    $versions = Invoke-RestMethod -Uri $packageUrl -Headers $headers -Method Get
    Write-Host "Найдено версий: $($versions.Count)" -ForegroundColor Green
    
    # Показываем список версий
    Write-Host ""
    Write-Host "Доступные версии:" -ForegroundColor Cyan
    foreach ($version in $versions) {
        $tags = $version.metadata.container.tags -join ", "
        Write-Host "  ID: $($version.id) | Tags: $tags | Created: $($version.created_at)" -ForegroundColor White
    }
} catch {
    Write-Host "ОШИБКА при получении списка версий!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Удаляем версии
Write-Host ""
Write-Host "[3/3] Удаление версий..." -ForegroundColor Yellow

$deletedCount = 0
foreach ($version in $versions) {
    $versionTags = $version.metadata.container.tags
    
    # Если указан конкретный тег, удаляем только его
    if ($Tag -ne "all") {
        if ($versionTags -notcontains $Tag) {
            continue
        }
    }
    
    $deleteUrl = "https://api.github.com/users/$GitHubUsername/packages/container/$PackageName/versions/$($version.id)"
    
    try {
        Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete
        $tags = $versionTags -join ", "
        Write-Host "  ✓ Удалена версия: $tags (ID: $($version.id))" -ForegroundColor Green
        $deletedCount++
    } catch {
        Write-Host "  ✗ Ошибка при удалении версии ID: $($version.id)" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Удалено версий: $deletedCount" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Просмотр пакетов в GitHub:" -ForegroundColor Cyan
Write-Host "  https://github.com/$GitHubUsername?tab=packages" -ForegroundColor White
Write-Host ""
