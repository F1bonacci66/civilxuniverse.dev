# Тест API CivilX через PowerShell
Write-Host "🔍 Тестирование API CivilX" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Базовый URL
$baseUrl = "http://civilx.ru"

# Функция для тестирования эндпоинта
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "`n🌐 Тестируем: $Name" -ForegroundColor Yellow
    Write-Host "URL: $Url" -ForegroundColor Gray
    Write-Host "Method: $Method" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ErrorAction = 'Stop'
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 3)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Host "✅ Успешно!" -ForegroundColor Green
        Write-Host "Статус: OK" -ForegroundColor Green
        Write-Host "Тип ответа: $($response.GetType().Name)" -ForegroundColor Green
        
        if ($response -is [string]) {
            Write-Host "Длина ответа: $($response.Length)" -ForegroundColor Green
            Write-Host "Превью: $($response.Substring(0, [Math]::Min(100, $response.Length)))..." -ForegroundColor Gray
        } else {
            Write-Host "Содержимое: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        }
        
        return $response
        
    } catch {
        Write-Host "❌ Ошибка!" -ForegroundColor Red
        Write-Host "Статус: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Ошибка: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            Write-Host "Ответ сервера: $responseBody" -ForegroundColor Red
        }
        
        return $null
    }
}

# Тест 1: Проверка доступности API
Write-Host "`n📡 Тест 1: Проверка доступности API" -ForegroundColor Cyan
Test-Endpoint -Name "Available Versions" -Url "$baseUrl/auth-api.php/api/available-versions"

# Тест 2: Проверка авторизации
Write-Host "`n🔐 Тест 2: Проверка авторизации" -ForegroundColor Cyan
$loginData = @{
    email = "test@example.com"
    password = "password123"
}

$loginResponse = Test-Endpoint -Name "Login" -Url "$baseUrl/auth-api.php/api/login" -Method "POST" -Body $loginData

# Если авторизация успешна, тестируем защищенные эндпоинты
if ($loginResponse -and $loginResponse.token) {
    Write-Host "`n🎫 Токен получен!" -ForegroundColor Green
    Write-Host "Тип токена: $($loginResponse.token.GetType().Name)" -ForegroundColor Green
    Write-Host "Длина токена: $($loginResponse.token.Length)" -ForegroundColor Green
    Write-Host "Частей токена: $(($loginResponse.token -split '\.').Count)" -ForegroundColor Green
    Write-Host "Формат: $(if (($loginResponse.token -split '\.').Count -eq 3) { 'JWT ✅' } else { 'НЕ JWT ❌' })" -ForegroundColor $(if (($loginResponse.token -split '\.').Count -eq 3) { 'Green' } else { 'Red' })
    
    $token = $loginResponse.token
    $authHeaders = @{
        "Authorization" = "Bearer $token"
    }
    
    # Тест 3: Проверка /api/me
    Write-Host "`n👤 Тест 3: Проверка /api/me" -ForegroundColor Cyan
    Test-Endpoint -Name "Get User" -Url "$baseUrl/auth-api.php/api/me" -Headers $authHeaders
    
    # Тест 4: Проверка /api/user-products
    Write-Host "`n📦 Тест 4: Проверка /api/user-products" -ForegroundColor Cyan
    Test-Endpoint -Name "Get User Products" -Url "$baseUrl/auth-api.php/api/user-products" -Headers $authHeaders
    
} else {
    Write-Host "`n❌ Авторизация не удалась" -ForegroundColor Red
    Write-Host "Проверьте логин/пароль или состояние API" -ForegroundColor Red
}

# Тест 5: Проверка других эндпоинтов
Write-Host "`n📋 Тест 5: Проверка других эндпоинтов" -ForegroundColor Cyan
Test-Endpoint -Name "Product Versions" -Url "$baseUrl/auth-api.php/api/product-versions"
Test-Endpoint -Name "Subscription Products" -Url "$baseUrl/auth-api.php/api/subscription-products"

Write-Host "`n🏁 Тестирование завершено!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
