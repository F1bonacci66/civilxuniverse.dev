# ✅ Исправление проблемы ERR_CONNECTION_TIMED_OUT

## Проблема

При использовании Docker контейнера для фронтенда возникала ошибка:
- `ERR_CONNECTION_TIMED_OUT` при обращении к `host.docker.internal:8000`
- `ERR_NAME_NOT_RESOLVED` при обращении к `api.civilx.ru`

**Причина:** `host.docker.internal` не работает из браузера (браузер работает на хосте, а не в контейнере).

## Решение

Использование **Next.js rewrite** для проксирования API запросов через Next.js сервер:

1. **API клиенты** используют относительные пути `/api/datalab` когда API URL указывает на localhost
2. **Next.js rewrite** проксирует эти запросы к бэкенду
3. **В контейнере** rewrite использует `host.docker.internal:8000` для доступа к хосту
4. **На хосте** (dev режим) rewrite использует `localhost:8000`

## Как это работает

```
Браузер (на хосте)
    ↓ запрос /api/datalab/projects
Next.js сервер (в контейнере)
    ↓ rewrite проксирует к host.docker.internal:8000
Backend (на хосте localhost:8000)
    ↓ ответ
Next.js сервер
    ↓ возвращает ответ
Браузер
```

## Использование

### 1. Запустить бэкенд локально

```powershell
cd C:\Projects\CivilX\Site\civilx-website\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Важно:** Используйте `--host 0.0.0.0` чтобы бэкенд был доступен из контейнера.

### 2. Собрать и запустить Docker контейнер

```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Использовать скрипт
.\rebuild-local.ps1

# Или вручную
$env:DOCKER_BUILDKIT=1
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000/api/datalab -t civilx-universe:latest .
docker run -d -p 3001:3001 --name test-universe --add-host=host.docker.internal:host-gateway civilx-universe:latest
```

**Важно:** Флаг `--add-host=host.docker.internal:host-gateway` необходим для доступа к хосту из контейнера.

### 3. Проверить работу

1. Откройте браузер: http://localhost:3001
2. Откройте консоль разработчика (F12)
3. Проверьте Network tab - запросы должны идти на `/api/datalab/...` (относительный путь)
4. Не должно быть ошибок `ERR_CONNECTION_TIMED_OUT` или `ERR_NAME_NOT_RESOLVED`

## Что было изменено

### 1. `next.config.mjs`

Добавлен rewrite для проксирования API запросов:

```javascript
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/datalab'
  const isLocalhost = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')
  
  if (isLocalhost) {
    const backendHost = process.env.DOCKER_CONTAINER === 'true' 
      ? 'http://host.docker.internal:8000'
      : 'http://localhost:8000'
    
    return [
      {
        source: '/api/datalab/:path*',
        destination: `${backendHost}/api/datalab/:path*`,
      },
    ]
  }
  return []
}
```

### 2. API клиенты (`lib/api/*.ts`)

Обновлены для использования относительных путей при localhost:

```typescript
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/datalab'
const API_BASE_URL = rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1') 
  ? '/api/datalab'  // Относительный путь для проксирования
  : rawApiUrl       // Полный URL для production
```

### 3. `Dockerfile`

Добавлена переменная окружения:

```dockerfile
ENV DOCKER_CONTAINER="true"
```

## Для production

В production используйте полный URL API:

```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab -t civilx-universe:latest .
```

Или используйте nginx reverse proxy (см. `PRODUCTION_SETUP.md`).

## Устранение проблем

### Ошибка: `ERR_CONNECTION_TIMED_OUT`

**Причина:** Бэкенд не запущен или недоступен.

**Решение:**
1. Убедитесь, что бэкенд запущен: `http://localhost:8000/health`
2. Убедитесь, что бэкенд слушает на `0.0.0.0`: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Проверьте, что контейнер запущен с флагом `--add-host=host.docker.internal:host-gateway`

### Ошибка: `ERR_NAME_NOT_RESOLVED`

**Причина:** `host.docker.internal` не резолвится.

**Решение:**
1. Обновите Docker Desktop до последней версии
2. Убедитесь, что контейнер запущен с флагом `--add-host=host.docker.internal:host-gateway`
3. Или используйте IP адрес хоста вместо `host.docker.internal`

### Запросы не проксируются

**Причина:** Rewrite не работает или API URL не указывает на localhost.

**Решение:**
1. Проверьте, что `NEXT_PUBLIC_API_URL` содержит `localhost` или `127.0.0.1`
2. Проверьте логи Next.js: `docker logs test-universe`
3. Убедитесь, что `DOCKER_CONTAINER=true` установлена в контейнере




