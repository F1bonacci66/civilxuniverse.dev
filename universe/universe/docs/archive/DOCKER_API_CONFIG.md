# 🔧 Настройка API URL для Docker образа

## Проблема

При сборке Next.js приложения переменная `NEXT_PUBLIC_API_URL` должна быть установлена **во время сборки**, а не во время выполнения, так как она встраивается в JavaScript код клиента.

## Решение

### 1. Dockerfile обновлён

В Dockerfile добавлен build-arg для передачи API URL:

```dockerfile
ARG NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
```

### 2. Сборка образа

**С production API URL (по умолчанию):**
```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab -t civilx-universe:latest .
```

**С локальным API (для разработки):**
```powershell
# Если бэкенд запущен на хосте
docker build --build-arg NEXT_PUBLIC_API_URL=http://host.docker.internal:8000/api/datalab -t civilx-universe:latest .
```

**Используя скрипт build-docker.ps1:**
```powershell
# Production (по умолчанию)
.\build-docker.ps1

# С кастомным API URL
$env:NEXT_PUBLIC_API_URL="http://host.docker.internal:8000/api/datalab"
.\build-docker.ps1
```

### 3. Запуск контейнера

После сборки переменная уже встроена в код, но можно также передать её при запуске (для переопределения, если нужно):

```powershell
docker run -d -p 3001:3001 --name universe -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab civilx-universe:latest
```

**Важно:** Если переменная не была установлена при сборке, Next.js будет использовать fallback `http://localhost:8000/api/datalab`, который не будет работать из контейнера.

## Варианты конфигурации

### Production (рекомендуется)
```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab -t civilx-universe:latest .
```

### Development (локальный бэкенд на хосте)
```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=http://host.docker.internal:8000/api/datalab -t civilx-universe:latest .
```

### Staging
```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://staging-api.civilx.ru/api/datalab -t civilx-universe:latest .
```

## Проверка

После сборки и запуска контейнера:

1. Откройте браузер: http://localhost:3001
2. Откройте консоль разработчика (F12)
3. Проверьте Network tab - запросы должны идти на правильный API URL
4. Не должно быть ошибок `ERR_CONNECTION_REFUSED` для API запросов

## Устранение проблем

### Ошибка: `ERR_CONNECTION_REFUSED` на `:8000/api/datalab`

**Причина:** Переменная `NEXT_PUBLIC_API_URL` не была установлена при сборке.

**Решение:** Пересоберите образ с правильным build-arg:
```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab -t civilx-universe:latest .
```

### Ошибка: CORS при обращении к API

**Причина:** API не настроен для работы с фронтендом.

**Решение:** Настройте CORS на бэкенде для разрешения запросов с домена фронтенда.

### Локальный бэкенд недоступен из контейнера

**Причина:** `localhost` в контейнере указывает на сам контейнер, а не на хост.

**Решение:** Используйте `host.docker.internal` вместо `localhost`:
```powershell
docker build --build-arg NEXT_PUBLIC_API_URL=http://host.docker.internal:8000/api/datalab -t civilx-universe:latest .
```

## Обновление скрипта сборки

Скрипт `build-docker.ps1` обновлён для автоматической передачи API URL:

```powershell
# Использует переменную окружения или значение по умолчанию
$env:NEXT_PUBLIC_API_URL="https://api.civilx.ru/api/datalab"
.\build-docker.ps1
```

