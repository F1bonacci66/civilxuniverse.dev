# 🔧 Исправление проблемы с токеном

## Проблема

Ошибка при входе в Docker Registry:
```
Error response from daemon: Get "https://ghcr.io/v2/": denied: denied
```

## Причина

Ваш токен имеет права: `repo, write:packages`

**Отсутствует:** `read:packages`

Для работы с GitHub Container Registry (ghcr.io) нужны **ОБА** права:
- ✅ `read:packages` - для чтения/загрузки образов (docker pull)
- ✅ `write:packages` - для загрузки образов (docker push)

## Решение

### Вариант 1: Обновить существующий токен

1. Перейдите: https://github.com/settings/tokens
2. Найдите ваш токен (начинается с `ghp_tLAc...`)
3. Нажмите **"Edit"** (редактировать)
4. Добавьте право: ✅ **`read:packages`**
5. Нажмите **"Update token"**
6. Используйте тот же токен (он не изменится)

### Вариант 2: Создать новый токен

1. Перейдите: https://github.com/settings/tokens
2. Нажмите **"Generate new token"** → **"Generate new token (classic)"**
3. Укажите имя: `Docker Registry (ghcr.io)`
4. Выберите права:
   - ✅ **`read:packages`** - чтение пакетов
   - ✅ **`write:packages`** - запись пакетов
   - ✅ **`delete:packages`** - удаление пакетов (опционально)
5. Нажмите **"Generate token"**
6. **Скопируйте новый токен** (он показывается только один раз!)

## Использование обновленного токена

### Windows PowerShell:

```powershell
# Установить новый токен
$env:GITHUB_TOKEN = "ghp_новый-токен-здесь"

# Проверить вход
$env:GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin

# Загрузить образ
.\push-to-ghcr.ps1 -Tag v1.0.0
```

### Linux/Mac:

```bash
# Установить новый токен
export GITHUB_TOKEN="ghp_новый-токен-здесь"

# Проверить вход
echo $GITHUB_TOKEN | docker login ghcr.io -u F1bonacci66 --password-stdin

# Загрузить образ
./push-to-ghcr.sh v1.0.0
```

## Проверка прав токена

После обновления токена проверьте права:

```powershell
$headers = @{
    "Authorization" = "token $env:GITHUB_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}
$scopes = (Invoke-WebRequest -Uri "https://api.github.com/user" -Headers $headers).Headers['X-OAuth-Scopes']
Write-Host "Права токена: $scopes"
```

Должно быть: `read:packages, write:packages` (или `repo, read:packages, write:packages`)

## После исправления

1. ✅ Вход в Docker Registry должен работать
2. ✅ Можно загружать образы: `docker push ghcr.io/F1bonacci66/civilx-universe:latest`
3. ✅ Можно загружать образы с сервера: `docker pull ghcr.io/F1bonacci66/civilx-universe:latest`

