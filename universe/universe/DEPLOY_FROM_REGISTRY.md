# 🚀 Деплой с Docker Registry на сервер

## Процесс деплоя

### Шаг 1: Загрузка образа в Registry (на локальной машине)

#### Вариант A: Docker Hub (публичный)

```powershell
# Запустить скрипт
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
.\push-to-registry.ps1 -Registry docker.io -Username your-dockerhub-username -Tag v1.0.0

# Или вручную
docker login
docker tag civilx-universe:latest your-username/civilx-universe:latest
docker tag civilx-universe:latest your-username/civilx-universe:v1.0.0
docker push your-username/civilx-universe:latest
docker push your-username/civilx-universe:v1.0.0
```

#### Вариант B: GitHub Container Registry (ghcr.io)

```powershell
# Создать Personal Access Token на GitHub:
# https://github.com/settings/tokens
# Права: read:packages, write:packages

# Запустить скрипт
.\push-to-registry.ps1 -Registry ghcr.io -Username your-github-username -Tag v1.0.0

# Или вручную
echo $env:GITHUB_TOKEN | docker login ghcr.io -u your-github-username --password-stdin
docker tag civilx-universe:latest ghcr.io/your-username/civilx-universe:latest
docker push ghcr.io/your-username/civilx-universe:latest
```

#### Вариант C: Приватный Registry

```powershell
.\push-to-registry.ps1 -Registry registry.yourcompany.com -Username your-username -Tag v1.0.0
```

### Шаг 2: Клонирование репозитория на сервер

```bash
# На сервере (Linux)
cd /opt
git clone https://github.com/yourusername/civilx-website.git
cd civilx-website/universe/universe
```

### Шаг 3: Настройка на сервере

#### 3.1. Создать .env файл

```bash
cd /opt/civilx-website/universe/universe
nano .env
```

Содержимое `.env`:
```env
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
```

#### 3.2. Обновить docker-compose.yml

Отредактируйте `docker-compose.yml` для использования образа из registry:

```yaml
version: '3.8'

services:
  universe:
    image: your-username/civilx-universe:latest  # Или ghcr.io/your-username/civilx-universe:latest
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

**Важно:** Уберите секцию `build:` и используйте только `image:`.

### Шаг 4: Вход в Registry на сервере

#### Для Docker Hub:
```bash
docker login
```

#### Для GitHub Container Registry:
```bash
# Создать Personal Access Token на GitHub
# Использовать токен как пароль
echo $GITHUB_TOKEN | docker login ghcr.io -u your-github-username --password-stdin
```

#### Для приватного Registry:
```bash
docker login registry.yourcompany.com -u your-username
```

### Шаг 5: Загрузка и запуск образа

```bash
cd /opt/civilx-website/universe/universe

# Загрузить образ из registry
docker-compose pull

# Запустить контейнер
docker-compose up -d

# Проверить статус
docker-compose ps

# Просмотр логов
docker-compose logs -f universe
```

### Шаг 6: Проверка работы

```bash
# Проверить health check
curl http://localhost:3001/api/health

# Проверить статус контейнера
docker-compose ps

# Проверить логи
docker-compose logs universe
```

## Обновление на сервере

### Автоматическое обновление

```bash
cd /opt/civilx-website/universe/universe

# Получить последние изменения из git
git pull

# Загрузить новый образ из registry
docker-compose pull

# Перезапустить контейнер с новым образом
docker-compose up -d

# Проверить статус
docker-compose ps
```

### Ручное обновление

```bash
# Остановить контейнер
docker-compose down

# Загрузить новый образ
docker pull your-username/civilx-universe:latest

# Запустить заново
docker-compose up -d
```

## Использование конкретной версии

Для использования конкретной версии образа:

```yaml
services:
  universe:
    image: your-username/civilx-universe:v1.0.0  # Конкретная версия
    # ...
```

Или через переменную окружения:

```bash
# В .env файле
IMAGE_TAG=v1.0.0

# В docker-compose.yml
services:
  universe:
    image: your-username/civilx-universe:${IMAGE_TAG}
```

## Безопасность

### Использование секретов для аутентификации

Для production рекомендуется использовать Docker secrets или переменные окружения:

```bash
# Создать файл с токеном
echo "your-token" > /root/.docker-registry-token
chmod 600 /root/.docker-registry-token

# Использовать при входе
cat /root/.docker-registry-token | docker login ghcr.io -u username --password-stdin
```

### Настройка автоматического обновления

Создайте cron job для автоматической проверки обновлений:

```bash
# Создать скрипт
nano /opt/civilx-website/universe/universe/update.sh
```

```bash
#!/bin/bash
cd /opt/civilx-website/universe/universe
docker-compose pull
docker-compose up -d
```

```bash
# Сделать исполняемым
chmod +x /opt/civilx-website/universe/universe/update.sh

# Добавить в crontab (проверка каждый день в 3:00)
crontab -e
# Добавить строку:
0 3 * * * /opt/civilx-website/universe/universe/update.sh >> /var/log/universe-update.log 2>&1
```

## Устранение проблем

### Ошибка: "unauthorized: authentication required"

**Решение:**
```bash
# Войти в registry заново
docker login your-registry.com
```

### Ошибка: "pull access denied"

**Решение:**
- Проверьте права доступа к репозиторию в registry
- Убедитесь, что вы вошли в правильный аккаунт
- Для приватных репозиториев проверьте настройки доступа

### Образ не обновляется

**Решение:**
```bash
# Принудительно загрузить новый образ (без кэша)
docker-compose pull --no-cache

# Или удалить старый образ и загрузить заново
docker rmi your-username/civilx-universe:latest
docker-compose pull
```

## Примеры для разных Registry

### Docker Hub
```yaml
image: your-username/civilx-universe:latest
```

### GitHub Container Registry
```yaml
image: ghcr.io/your-username/civilx-universe:latest
```

### GitLab Container Registry
```yaml
image: registry.gitlab.com/your-username/civilx-universe:latest
```

### Приватный Registry
```yaml
image: registry.yourcompany.com/civilx-universe:latest
```




