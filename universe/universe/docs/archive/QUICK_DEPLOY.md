# 🚀 Быстрый деплой на сервер

## Процесс деплоя (кратко)

### 1. Загрузить образ в Registry (на локальной машине)

#### Docker Hub (публичный):
```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Использовать скрипт
.\push-to-registry.ps1 -Registry docker.io -Username your-dockerhub-username -Tag v1.0.0

# Или вручную
docker login
docker tag civilx-universe:latest your-username/civilx-universe:latest
docker tag civilx-universe:latest your-username/civilx-universe:v1.0.0
docker push your-username/civilx-universe:latest
docker push your-username/civilx-universe:v1.0.0
```

#### GitHub Container Registry:
```powershell
# Создать токен: https://github.com/settings/tokens (read:packages, write:packages)
.\push-to-registry.ps1 -Registry ghcr.io -Username your-github-username -Tag v1.0.0
```

### 2. На сервере: Клонировать репозиторий

```bash
cd /opt
git clone https://github.com/yourusername/civilx-website.git
cd civilx-website/universe/universe
```

### 3. На сервере: Настроить и запустить

```bash
# Создать .env файл
cat > .env << EOF
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
DOCKER_IMAGE=your-username/civilx-universe:latest
EOF

# Войти в registry
docker login  # для Docker Hub
# или
docker login ghcr.io -u your-github-username  # для GitHub

# Запустить деплой
chmod +x deploy-server.sh
./deploy-server.sh your-username/civilx-universe:latest

# Или вручную
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Проверить работу

```bash
# Проверить статус
docker-compose -f docker-compose.prod.yml ps

# Проверить health
curl http://localhost:3001/api/health

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f universe
```

## Обновление на сервере

```bash
cd /opt/civilx-website/universe/universe

# Получить обновления из git
git pull

# Загрузить новый образ
docker-compose -f docker-compose.prod.yml pull

# Перезапустить
docker-compose -f docker-compose.prod.yml up -d
```

Подробнее см. `DEPLOY_FROM_REGISTRY.md`

