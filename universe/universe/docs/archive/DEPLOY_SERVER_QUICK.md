# 🚀 Быстрый деплой на сервер с GitHub Container Registry

## Предварительные требования

1. **Docker и Docker Compose** установлены на сервере
2. **GitHub Personal Access Token** с правами `read:packages`
3. **Доступ к серверу** по SSH

## Шаг 1: Подготовка на сервере

### 1.1. Создать директорию проекта

```bash
sudo mkdir -p /opt/civilx-universe
cd /opt/civilx-universe
```

### 1.2. Создать файл `.env`

```bash
nano .env
```

Содержимое:
```env
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
DOCKER_IMAGE=ghcr.io/f1bonacci66/civilx-universe:latest
GITHUB_TOKEN=your-github-token-here
```

### 1.3. Создать `docker-compose.yml`

```bash
nano docker-compose.yml
```

Содержимое:
```yaml
version: '3.8'

services:
  universe:
    image: ${DOCKER_IMAGE:-ghcr.io/f1bonacci66/civilx-universe:latest}
    container_name: civilx-universe
    restart: unless-stopped
    ports:
      - "${PORT:-3001}:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOSTNAME=0.0.0.0
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.civilx.ru/api/datalab}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

networks:
  app-network:
    driver: bridge
    name: civilx-universe-network
```

## Шаг 2: Авторизация в GitHub Container Registry

```bash
# Загрузить токен из .env
source .env

# Войти в GitHub Container Registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

## Шаг 3: Запуск приложения

```bash
# Загрузить образ
docker-compose pull

# Запустить контейнер
docker-compose up -d

# Проверить статус
docker-compose ps

# Просмотр логов
docker-compose logs -f universe
```

## Шаг 4: Проверка работы

```bash
# Проверить health check
curl http://localhost:3001/api/health

# Должен вернуть: {"status":"ok"}
```

## Обновление приложения

```bash
cd /opt/civilx-universe

# Загрузить новый образ
docker-compose pull

# Перезапустить контейнер
docker-compose up -d

# Проверить логи
docker-compose logs -f universe
```

## Автоматический скрипт деплоя

Создайте файл `deploy.sh`:

```bash
#!/bin/bash
cd /opt/civilx-universe

# Загрузить переменные окружения
source .env

# Войти в registry (если нужно)
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin

# Загрузить и запустить
docker-compose pull
docker-compose up -d

# Проверить статус
docker-compose ps

echo "Деплой завершен!"
```

Сделать исполняемым:
```bash
chmod +x deploy.sh
```

Использование:
```bash
./deploy.sh
```

## Устранение проблем

### Ошибка: "unauthorized: authentication required"

```bash
# Войти заново
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

### Ошибка: "pull access denied"

- Проверьте, что токен имеет права `read:packages`
- Убедитесь, что токен правильный в `.env` файле

### Контейнер не запускается

```bash
# Проверить логи
docker-compose logs universe

# Проверить статус
docker-compose ps

# Перезапустить
docker-compose restart universe
```

## Настройка Nginx (опционально)

Если нужно проксировать через Nginx:

```nginx
server {
    listen 80;
    server_name universe.civilx.ru;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

