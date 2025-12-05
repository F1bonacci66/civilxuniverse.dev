# 🚀 Деплой Docker образа на сервер

## Подготовка образа

### 1. Сборка образа локально

**Windows PowerShell:**
```powershell
cd C:\Projects\CivilX\Site\civilx-website\universe\universe

# Использовать скрипт сборки
.\build-docker.ps1

# Или вручную
$env:DOCKER_BUILDKIT=1
docker build -t civilx-universe:latest .
```

**Linux/Mac:**
```bash
cd /path/to/civilx-website/universe/universe

# Использовать скрипт сборки
chmod +x build-docker.sh
./build-docker.sh

# Или вручную
export DOCKER_BUILDKIT=1
docker build -t civilx-universe:latest .
```

### 2. Проверка образа

```bash
# Просмотр списка образов
docker images civilx-universe

# Проверка размера (должен быть ~200-300 МБ)
docker images civilx-universe:latest
```

### 3. Тестирование образа локально

```bash
# Запустить контейнер для тестирования
docker run -d \
  --name test-universe \
  -p 3001:3001 \
  -e NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab \
  civilx-universe:latest

# Проверить логи
docker logs -f test-universe

# Проверить health check
curl http://localhost:3001/api/health

# Остановить тестовый контейнер
docker stop test-universe
docker rm test-universe
```

## Экспорт образа для переноса на сервер

### Вариант A: Сохранение в файл (для переноса через USB/сеть)

**Windows PowerShell:**
```powershell
# Сохранить образ в tar архив
docker save -o civilx-universe-latest.tar civilx-universe:latest

# Проверить размер файла
Get-Item civilx-universe-latest.tar | Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}
```

**Linux/Mac:**
```bash
# Сохранить образ в tar архив
docker save -o civilx-universe-latest.tar civilx-universe:latest

# Проверить размер файла
ls -lh civilx-universe-latest.tar
```

### Вариант B: Push в Docker Registry (рекомендуется)

```bash
# Войти в registry (если используется)
docker login your-registry.com

# Тегировать образ
docker tag civilx-universe:latest your-registry.com/civilx-universe:latest
docker tag civilx-universe:latest your-registry.com/civilx-universe:v1.0.0

# Загрузить в registry
docker push your-registry.com/civilx-universe:latest
docker push your-registry.com/civilx-universe:v1.0.0
```

## Загрузка образа на сервер

### Вариант A: Через tar файл

**На локальной машине:**
```bash
# Создать архив
docker save -o civilx-universe-latest.tar civilx-universe:latest

# Сжать архив (опционально, но рекомендуется)
gzip civilx-universe-latest.tar  # Linux/Mac
# или использовать 7-Zip на Windows
```

**На сервере (Linux):**
```bash
# Загрузить файл на сервер (через scp, sftp, или другой способ)
scp civilx-universe-latest.tar user@server:/tmp/

# На сервере: загрузить образ
docker load -i /tmp/civilx-universe-latest.tar

# Проверить
docker images civilx-universe
```

### Вариант B: Через Docker Registry

**На сервере:**
```bash
# Войти в registry
docker login your-registry.com

# Загрузить образ
docker pull your-registry.com/civilx-universe:latest

# Тегировать локально (опционально)
docker tag your-registry.com/civilx-universe:latest civilx-universe:latest
```

## Развёртывание на сервере

### 1. Подготовка на сервере

```bash
# Создать директорию для проекта
sudo mkdir -p /opt/civilx/universe
cd /opt/civilx/universe

# Создать docker-compose.yml (см. ниже)
nano docker-compose.yml

# Создать .env файл
nano .env
```

### 2. Создать docker-compose.yml на сервере

```yaml
version: '3.8'

services:
  universe:
    image: civilx-universe:latest
    container_name: civilx-universe
    restart: unless-stopped
    ports:
      - "3001:3001"
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

### 3. Создать .env файл на сервере

```env
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.civilx.ru/api/datalab
```

### 4. Запустить контейнер

```bash
# Запустить с docker-compose
docker-compose up -d

# Проверить статус
docker-compose ps

# Просмотр логов
docker-compose logs -f universe

# Проверить health check
curl http://localhost:3001/api/health
```

### 5. Настройка Nginx (если нужно)

Создайте конфигурацию Nginx для проксирования:

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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Перезагрузите Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Обновление на сервере

### Метод 1: Через docker-compose

```bash
cd /opt/civilx/universe

# Остановить старый контейнер
docker-compose down

# Загрузить новый образ (если через registry)
docker-compose pull

# Или загрузить новый tar файл
docker load -i /tmp/civilx-universe-latest.tar

# Запустить новый контейнер
docker-compose up -d

# Проверить
docker-compose ps
docker-compose logs -f universe
```

### Метод 2: Ручное обновление

```bash
# Остановить контейнер
docker stop civilx-universe
docker rm civilx-universe

# Загрузить новый образ
docker load -i /tmp/civilx-universe-latest.tar

# Запустить новый контейнер
docker-compose up -d
```

## Мониторинг и логи

```bash
# Просмотр логов в реальном времени
docker-compose logs -f universe

# Просмотр последних 100 строк логов
docker-compose logs --tail=100 universe

# Проверка использования ресурсов
docker stats civilx-universe

# Проверка health check
docker inspect civilx-universe | grep -A 10 Health

# Проверка статуса контейнера
docker-compose ps
```

## Устранение проблем

### Контейнер не запускается

```bash
# Проверить логи
docker-compose logs universe

# Проверить, что порт не занят
sudo netstat -tulpn | grep 3001

# Проверить образ
docker images civilx-universe
```

### Health check не проходит

```bash
# Проверить health endpoint вручную
curl http://localhost:3001/api/health

# Проверить статус health check
docker inspect civilx-universe | grep -A 10 Health

# Войти в контейнер для отладки
docker exec -it civilx-universe sh
```

### Проблемы с памятью

```bash
# Проверить использование ресурсов
docker stats civilx-universe

# Увеличить лимиты в docker-compose.yml
# Изменить memory: 512M на memory: 1G
```

## Автозапуск при перезагрузке сервера

Docker Compose с `restart: unless-stopped` автоматически запускает контейнер при перезагрузке. Для дополнительной надёжности:

```bash
# Создать systemd service (опционально)
sudo nano /etc/systemd/system/civilx-universe.service
```

```ini
[Unit]
Description=CivilX Universe Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/civilx/universe
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Включить автозапуск
sudo systemctl enable civilx-universe.service
sudo systemctl start civilx-universe.service
```

## Резервное копирование

```bash
# Сохранить текущий образ перед обновлением
docker save -o /backup/civilx-universe-backup-$(date +%Y%m%d).tar civilx-universe:latest

# Сжать архив
gzip /backup/civilx-universe-backup-$(date +%Y%m%d).tar
```



