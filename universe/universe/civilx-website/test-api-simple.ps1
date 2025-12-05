# Простой тест API CivilX
Write-Host "🔍 Тестирование API CivilX" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

$baseUrl = "http://civilx.ru"

# Тест 1: Проверка доступности API
Write-Host "`n📡 Тест 1: Проверка /api/available-versions" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth-api.php/api/available-versions" -Method GET
    Write-Host "✅ Успешно!" -ForegroundColor Green
    Write-Host "Ответ: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
}

# Тест 2: Проверка авторизации
Write-Host "`n🔐 Тест 2: Проверка авторизации" -ForegroundColor Yellow
$loginData = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth-api.php/api/login" -Method POST -Body $loginData -ContentType "application/json"
    Write-Host "✅ Авторизация успешна!" -ForegroundColor Green
    
    if ($response.token) {
        $tokenParts = $response.token -split '\.'
        Write-Host "Токен получен:" -ForegroundColor Green
        Write-Host "  - Длина: $($response.token.Length)" -ForegroundColor Gray
        Write-Host "  - Частей: $($tokenParts.Count)" -ForegroundColor Gray
        Write-Host "  - Формат: $(if ($tokenParts.Count -eq 3) { 'JWT ✅' } else { 'НЕ JWT ❌' })" -ForegroundColor $(if ($tokenParts.Count -eq 3) { 'Green' } else { 'Red' })
        Write-Host "  - Превью: $($response.token.Substring(0, 50))..." -ForegroundColor Gray
        
        # Тест 3: Проверка /api/me с токеном
        Write-Host "`n👤 Тест 3: Проверка /api/me" -ForegroundColor Yellow
        try {
            $headers = @{
                "Authorization" = "Bearer $($response.token)"
            }
            $meResponse = Invoke-RestMethod -Uri "$baseUrl/auth-api.php/api/me" -Method GET -Headers $headers
            Write-Host "✅ /api/me работает!" -ForegroundColor Green
            Write-Host "Пользователь: $($meResponse.user.name)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ /api/me ошибка: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # Тест 4: Проверка /api/user-products с токеном
        Write-Host "`n📦 Тест 4: Проверка /api/user-products" -ForegroundColor Yellow
        try {
            $productsResponse = Invoke-RestMethod -Uri "$baseUrl/auth-api.php/api/user-products" -Method GET -Headers $headers
            Write-Host "✅ /api/user-products работает!" -ForegroundColor Green
            Write-Host "Продуктов: $($productsResponse.products.Count)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ /api/user-products ошибка: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Ошибка авторизации: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🏁 Тестирование завершено!" -ForegroundColor Green
