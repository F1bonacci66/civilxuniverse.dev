# 🔍 Почему Docker Registry требует явное read:packages?

## Важное открытие

Вы правы: **`write:packages` включает в себя возможность чтения пакетов** через GitHub API!

Однако **Docker Registry (ghcr.io) требует ЯВНОЕ указание `read:packages`** в scopes токена, даже если `write:packages` уже есть.

## Разница между GitHub API и Docker Registry

### GitHub API
- ✅ `write:packages` достаточно для чтения через API
- ✅ Можно читать список пакетов
- ✅ Можно получать информацию о пакетах

### Docker Registry (ghcr.io)
- ❌ Требует **ЯВНОЕ** `read:packages` в scopes токена
- ❌ `write:packages` недостаточно для Docker аутентификации
- ✅ Нужны **ОБА** права: `read:packages` И `write:packages`

## Почему так происходит?

Docker Registry использует **OAuth2 Bearer Token** аутентификацию, которая проверяет scopes токена напрямую. Если в списке scopes нет `read:packages`, Docker Registry отклоняет запрос, даже если токен имеет `write:packages`.

GitHub API, с другой стороны, использует более гибкую систему разрешений, где `write:packages` неявно включает чтение.

## Решение

**Отметьте `read:packages` в настройках токена**, даже если кажется, что это избыточно.

Это необходимо для работы с `ghcr.io` через Docker команды:
- `docker login ghcr.io`
- `docker push ghcr.io/...`
- `docker pull ghcr.io/...`

## Проверка

После добавления `read:packages`:

```powershell
# Проверить права
$headers = @{"Authorization" = "token $env:GITHUB_TOKEN"; "Accept" = "application/vnd.github.v3+json"}
$response = Invoke-WebRequest -Uri "https://api.github.com/user" -Headers $headers
$scopes = $response.Headers['X-OAuth-Scopes']
Write-Host "Права: $scopes"
# Должно быть: read:packages, write:packages

# Проверить Docker login
$env:GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin
# Должно быть: Login Succeeded
```

## Итог

- ✅ Вы правы: `write:packages` включает чтение через API
- ✅ Но Docker Registry требует явное `read:packages`
- ✅ Отметьте оба права для полной совместимости

