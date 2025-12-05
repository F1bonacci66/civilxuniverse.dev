# 🐳 Локальная разработка с Docker

## Проблема

При тестировании Docker образа локально, фронтенд пытается подключиться к API. Есть два варианта:

1. **Production API** (`https://api.civilx.ru/api/datalab`) - может быть недоступен или не настроен
2. **Локальный бэкенд** (`http://localhost:8000`) - нужно запустить локально

## Решение: Использование локального бэкенда

### Шаг 1: Запустить бэкенд локально

Откройте новый терминал и выполните:

```powershell
# Перейти в директорию backend
cd C:\Projects\CivilX\Site\civilx-website\backend

# Активировать виртуальное окружение
.\venv\Scripts\Activate.ps1

# Запустить бэкенд
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Важно:** Используйте `--host 0.0.0.0` чтобы бэкенд был доступен из Docker контейнера.

Проверьте, что бэкенд запущен:
- Откройте http://localhost:8000/docs - должен открыться Swagger UI
- Откройте http://localhost:8000/health - должен вернуть `{"status": "healthy"}`

### Шаг 2: Собрать Docker образ с локальным API URL

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Собрать образ с локальным API
$env:DOCKER_BUILDKIT=1
docker build --build-arg NEXT_PUBLIC_API_URL=http://host.docker.internal:8000/api/datalab -t civilx-universe:latest .
```

**Важно:** `host.docker.internal` - это специальный DNS имя, которое Docker использует для доступа к хосту из контейнера.

### Шаг 3: Запустить контейнер

```powershell
docker run -d -p 3001:3001 --name test-universe civilx-universe:latest
```

### Шаг 4: Проверить работу

1. Откройте браузер: http://localhost:3001
2. Откройте консоль разработчика (F12)
3. Проверьте Network tab - запросы должны идти на `http://host.docker.internal:8000/api/datalab`
4. Не должно быть ошибок `ERR_NAME_NOT_RESOLVED` или `ERR_CONNECTION_REFUSED`

## Альтернативные варианты

### Вариант 1: Использовать production API

Если production API доступен:

```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab -t civilx-universe:latest .
```

### Вариант 2: Использовать IP адрес хоста

Если `host.docker.internal` не работает (старые версии Docker):

1. Узнайте IP адрес хоста:
   ```powershell
   ipconfig | findstr IPv4
   ```

2. Используйте IP адрес вместо `host.docker.internal`:
   ```powershell
   docker build --build-arg NEXT_PUBLIC_API_URL=http://192.168.1.100:8000/api/datalab -t civilx-universe:latest .
   ```

### Вариант 3: Использовать docker-compose с сетью

Создайте `docker-compose.local.yml`:

```yaml
version: '3.8'

services:
  universe:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://host.docker.internal:8000/api/datalab
    container_name: civilx-universe-local
    ports:
      - "3001:3001"
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Запуск:
```powershell
docker-compose -f docker-compose.local.yml up -d --build
```

## Устранение проблем

### Ошибка: `ERR_NAME_NOT_RESOLVED` для `api.civilx.ru`

**Причина:** Production API недоступен или домен не настроен.

**Решение:** Используйте локальный бэкенд (см. выше).

### Ошибка: `ERR_CONNECTION_REFUSED` для `host.docker.internal:8000`

**Причина:** Бэкенд не запущен или недоступен из контейнера.

**Решение:**
1. Убедитесь, что бэкенд запущен: `http://localhost:8000/health`
2. Убедитесь, что бэкенд слушает на `0.0.0.0`, а не `127.0.0.1`:
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
3. Проверьте firewall - порт 8000 должен быть доступен

### `host.docker.internal` не работает

**Причина:** Старая версия Docker или Linux без специальной настройки.

**Решение:**
1. Обновите Docker Desktop
2. Или используйте IP адрес хоста (см. Вариант 2 выше)
3. Или используйте `extra_hosts` в docker-compose (см. Вариант 3 выше)

## Быстрая команда для пересборки

Создайте файл `rebuild-local.ps1`:

```powershell
# Пересборка образа для локальной разработки
$env:DOCKER_BUILDKIT=1
docker build --build-arg NEXT_PUBLIC_API_URL=http://host.docker.internal:8000/api/datalab -t civilx-universe:latest .

# Остановить и удалить старый контейнер
docker stop test-universe 2>$null
docker rm test-universe 2>$null

# Запустить новый контейнер
docker run -d -p 3001:3001 --name test-universe civilx-universe:latest

Write-Host "Готово! Откройте http://localhost:3001" -ForegroundColor Green
```

Использование:
```powershell
.\rebuild-local.ps1
```

