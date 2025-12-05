# 🐳 Сборка Docker образа для Universe

## ⚠️ Требования

Перед началом убедитесь, что установлен Docker Desktop для Windows:
- Скачать: https://www.docker.com/products/docker-desktop/
- После установки перезапустите компьютер
- Проверьте установку: `docker --version`

## Быстрая сборка

### 1. Перейти в директорию проекта

**Windows PowerShell:**
```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
```

**Linux/Mac:**
```bash
cd /path/to/civilx-website/universe/universe
```

### 2. Включить BuildKit (рекомендуется)

**Windows PowerShell:**
```powershell
$env:DOCKER_BUILDKIT=1
$env:COMPOSE_DOCKER_CLI_BUILD=1
```

**Linux/Mac:**
```bash
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

### 3. Собрать образ

**Windows PowerShell:**
```powershell
docker build -t civilx-universe:latest .
```

**Linux/Mac:**
```bash
docker build -t civilx-universe:latest .
```

**Ожидаемое время первой сборки**: ~5-10 минут

### 4. Проверить образ

```bash
# Просмотр списка образов
docker images | grep civilx-universe

# Проверка размера образа
docker images civilx-universe:latest
```

## Запуск контейнера

### Базовый запуск

**Windows PowerShell (одна строка):**
```powershell
docker run -d --name civilx-universe -p 3001:3001 -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab civilx-universe:latest
```

**Windows PowerShell (многострочно с обратными кавычками):**
```powershell
docker run -d `
  --name civilx-universe `
  -p 3001:3001 `
  -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab `
  civilx-universe:latest
```

**Linux/Mac:**
```bash
docker run -d \
  --name civilx-universe \
  -p 3001:3001 \
  -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab \
  civilx-universe:latest
```

### Запуск с переменными окружения

**Windows PowerShell (одна строка):**
```powershell
docker run -d --name civilx-universe -p 3001:3001 -e NODE_ENV=production -e PORT=3001 -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab --restart unless-stopped civilx-universe:latest
```

**Windows PowerShell (многострочно):**
```powershell
docker run -d `
  --name civilx-universe `
  -p 3001:3001 `
  -e NODE_ENV=production `
  -e PORT=3001 `
  -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab `
  --restart unless-stopped `
  civilx-universe:latest
```

**Linux/Mac:**
```bash
docker run -d \
  --name civilx-universe \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab \
  --restart unless-stopped \
  civilx-universe:latest
```

### Запуск с файлом переменных окружения

Создайте файл `.env.docker`:

```env
NODE_ENV=production
PORT=3001
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
```

Запустите:

**Windows PowerShell:**
```powershell
docker run -d --name civilx-universe -p 3001:3001 --env-file .env.docker --restart unless-stopped civilx-universe:latest
```

**Linux/Mac:**
```bash
docker run -d \
  --name civilx-universe \
  -p 3001:3001 \
  --env-file .env.docker \
  --restart unless-stopped \
  civilx-universe:latest
```

## Проверка работы

**Windows PowerShell:**
```powershell
# Проверить, что контейнер запущен
docker ps | Select-String "civilx-universe"

# Просмотр логов
docker logs -f civilx-universe

# Проверить доступность приложения (откройте в браузере)
# http://localhost:3001
```

**Linux/Mac:**
```bash
# Проверить, что контейнер запущен
docker ps | grep civilx-universe

# Просмотр логов
docker logs -f civilx-universe

# Проверить доступность приложения
curl http://localhost:3001
# или откройте в браузере: http://localhost:3001
```

## Обновление образа

### 1. Остановить и удалить старый контейнер

**Windows PowerShell / Linux/Mac:**
```powershell
docker stop civilx-universe
docker rm civilx-universe
```

### 2. Пересобрать образ

**Windows PowerShell:**
```powershell
# Включить BuildKit
$env:DOCKER_BUILDKIT=1

# Пересобрать (используется кэш для неизменённых слоёв)
docker build -t civilx-universe:latest .
```

**Linux/Mac:**
```bash
# Включить BuildKit
export DOCKER_BUILDKIT=1

# Пересобрать (используется кэш для неизменённых слоёв)
docker build -t civilx-universe:latest .
```

**Ожидаемое время пересборки**:
- При изменении только кода: ~1-2 минуты
- При изменении зависимостей: ~3-5 минут
- Без изменений: ~10-30 секунд

### 3. Запустить новый контейнер

**Windows PowerShell:**
```powershell
docker run -d --name civilx-universe -p 3001:3001 -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab --restart unless-stopped civilx-universe:latest
```

**Linux/Mac:**
```bash
docker run -d \
  --name civilx-universe \
  -p 3001:3001 \
  -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab \
  --restart unless-stopped \
  civilx-universe:latest
```

## Использование Docker Compose (рекомендуется)

Файл `docker-compose.yml` уже создан в директории `universe/universe/` с полной конфигурацией, включая:
- Health checks
- Resource limits
- Network configuration
- Environment variables

**Использование для Production:**

**Windows PowerShell / Linux/Mac:**
```powershell
# Создать .env файл (см. ENV_EXAMPLE.md)
# Собрать и запустить
docker-compose up -d --build

# Пересобрать и перезапустить
docker-compose up -d --build universe

# Просмотр логов
docker-compose logs -f universe

# Проверить статус health check
docker-compose ps

# Остановить
docker-compose down
```

**Использование для Development:**

**Windows PowerShell / Linux/Mac:**
```powershell
# Создать .env файл с NODE_ENV=development
# Запустить с hot reload
docker-compose -f docker-compose.dev.yml up -d --build

# Просмотр логов
docker-compose -f docker-compose.dev.yml logs -f universe

# Остановить
docker-compose -f docker-compose.dev.yml down
```

**Примечание:** Для development используется `docker-compose.dev.yml`, который включает:
- Hot reload с монтированием исходного кода
- Увеличенные лимиты ресурсов
- Development-режим Next.js

## Оптимизация сборки

### Использование кэша из registry

Если образы хранятся в Docker registry:

**Windows PowerShell:**
```powershell
docker build --cache-from civilx-universe:latest --tag civilx-universe:latest .
```

**Linux/Mac:**
```bash
docker build \
  --cache-from civilx-universe:latest \
  --tag civilx-universe:latest \
  .
```

### Очистка неиспользуемых образов

**Windows PowerShell / Linux/Mac:**
```powershell
# Удалить неиспользуемые образы
docker image prune -a

# Удалить конкретный старый образ
docker rmi civilx-universe:old-tag
```

## Устранение проблем

### Проблема: Сборка занимает слишком много времени

**Решение:**
- Убедитесь, что BuildKit включен
- Проверьте, что `.dockerignore` правильно настроен
- Используйте кэш Docker (не удаляйте промежуточные образы)

### Проблема: Ошибка "npm ci" при сборке

**Решение:**
```powershell
# Убедитесь, что package-lock.json существует
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
npm install  # Это обновит package-lock.json
```

### Проблема: Контейнер не запускается

**Решение:**
```powershell
# Проверить логи
docker logs civilx-universe

# Проверить, что порт не занят
netstat -ano | findstr :3001  # Windows
# lsof -i :3001  # Linux/Mac
```

### Проблема: Docker не найден в PowerShell

**Решение:**
1. Установите Docker Desktop для Windows: https://www.docker.com/products/docker-desktop/
2. После установки перезапустите компьютер
3. Убедитесь, что Docker Desktop запущен (иконка в системном трее)
4. Проверьте установку: `docker --version`

### Проблема: Приложение не может подключиться к API

**Решение:**
- Проверьте переменную окружения `NEXT_PUBLIC_API_URL`
- Убедитесь, что API доступен с сервера
- Проверьте настройки CORS на backend

## Размещение на сервере

После сборки образа на сервере:

1. **Загрузить образ на сервер** (если собирали локально):
   
   **Windows PowerShell:**
   ```powershell
   # Сохранить образ
   docker save -o civilx-universe-latest.tar civilx-universe:latest
   ```
   
   **На сервере (Linux):**
   ```bash
   # Загрузить образ
   docker load -i civilx-universe-latest.tar
   ```

2. **Настроить Nginx reverse proxy** (см. `DEPLOY_INSTRUCTIONS.md`)

3. **Запустить контейнер** с правильными переменными окружения

4. **Настроить автозапуск** через systemd или docker-compose

Подробные инструкции по деплою см. в `DEPLOY_INSTRUCTIONS.md`

