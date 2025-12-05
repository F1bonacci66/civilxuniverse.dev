# 🚀 Деплой CivilX.Universe на сервер

Полное руководство по развертыванию проекта на production сервере.

## 📋 Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Деплой Frontend](#деплой-frontend)
3. [Деплой Backend](#деплой-backend)
4. [Обновление приложения](#обновление-приложения)
5. [Проверка работы](#проверка-работы)
6. [Устранение проблем](#устранение-проблем)

## 🚀 Быстрый старт

### Требования

- Сервер с Ubuntu/Debian
- Docker и Docker Compose установлены
- Доступ к GitHub Container Registry (GHCR)
- GitHub Personal Access Token с правами `read:packages`, `write:packages`

### Быстрый деплой

```bash
# 1. Подключиться к серверу
ssh root@95.163.230.61

# 2. Создать директорию
sudo mkdir -p /opt/civilx-universe
cd /opt/civilx-universe

# 3. Использовать скрипт автоматического деплоя
# (см. scripts/deploy-on-server.sh)
```

## 📦 Деплой Frontend

### Вариант 1: Из Docker Registry (рекомендуется)

#### Шаг 1: Подготовка на локальной машине

```powershell
# Собрать образ
cd C:\Projects\CivilX\Site\civilx-website\universe\universe
.\scripts\build-docker.ps1

# Загрузить в GHCR
.\scripts\push-to-ghcr.ps1
```

#### Шаг 2: Настройка на сервере

```bash
# Создать директорию
sudo mkdir -p /opt/civilx-universe
cd /opt/civilx-universe

# Создать .env файл
cat > .env << EOF
PORT=3001
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://95.163.230.61:8000/api/datalab
DOCKER_IMAGE=ghcr.io/f1bonacci66/civilx-universe:latest
GITHUB_TOKEN=your-github-token-here
EOF

# Создать docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'

services:
  universe:
    image: \${DOCKER_IMAGE:-ghcr.io/f1bonacci66/civilx-universe:latest}
    container_name: civilx-universe
    restart: unless-stopped
    ports:
      - "\${PORT:-3001}:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOSTNAME=0.0.0.0
      - NEXT_PUBLIC_API_URL=\${NEXT_PUBLIC_API_URL}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3

networks:
  app-network:
    driver: bridge
    name: civilx-universe-network
EOF

# Войти в GHCR
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin

# Загрузить и запустить
docker-compose pull
docker-compose up -d

# Проверить статус
docker-compose ps
```

### Вариант 2: Локальная сборка на сервере

```bash
# Клонировать репозиторий
git clone https://github.com/F1bonacci66/civilx.univers.git
cd civilx.univers/universe/universe

# Собрать образ
docker build -t civilx-universe:latest .

# Запустить
docker-compose up -d
```

## 🔧 Деплой Backend

### Шаг 1: Подготовка сервера

```bash
# Создать директорию
sudo mkdir -p /opt/civilx-backend
cd /opt/civilx-backend

# Установить Python
sudo apt update
sudo apt install -y python3 python3-pip python3-venv
```

### Шаг 2: Копирование кода

**С локальной машины (PowerShell):**

```powershell
cd C:\Projects\CivilX\Site\civilx-website\backend
.\scripts\copy-backend.ps1
```

**Или вручную через scp:**

```bash
# С локальной машины
scp -r app root@95.163.230.61:/opt/civilx-backend/
scp requirements.txt root@95.163.230.61:/opt/civilx-backend/
```

### Шаг 3: Установка зависимостей

```bash
cd /opt/civilx-backend

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt
```

### Шаг 4: Настройка окружения

```bash
# Создать .env файл
cat > .env << EOF
DATABASE_URL=sqlite:///./data/civilx_universe.db
CORS_ORIGINS=http://localhost:3001,http://localhost:3000,http://95.163.230.61:3001,http://95.163.230.61:3000
JWT_SECRET=your-jwt-secret-here
EOF

# Создать директорию для данных
mkdir -p data
```

### Шаг 5: Запуск Backend

```bash
# Запустить в фоне
cd /opt/civilx-backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# Проверить статус
ps aux | grep uvicorn
curl http://localhost:8000/health
```

### Шаг 6: Systemd Service (опционально, для production)

```bash
# Создать service файл
sudo nano /etc/systemd/system/civilx-backend.service
```

```ini
[Unit]
Description=CivilX Universe Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/civilx-backend
Environment="PATH=/opt/civilx-backend/venv/bin"
ExecStart=/opt/civilx-backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Запустить service
sudo systemctl daemon-reload
sudo systemctl enable civilx-backend
sudo systemctl start civilx-backend
sudo systemctl status civilx-backend
```

## 🔄 Обновление приложения

### Обновление Frontend

```bash
# На сервере
cd /opt/civilx-universe

# Загрузить новый образ
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
docker-compose pull

# Перезапустить контейнер
docker-compose up -d

# Проверить статус
docker-compose ps
docker-compose logs -f universe
```

### Обновление Backend

```bash
# На локальной машине - скопировать обновленные файлы
cd C:\Projects\CivilX\Site\civilx-website\backend
.\scripts\copy-backend.ps1

# На сервере - перезапустить
cd /opt/civilx-backend
pkill -f uvicorn
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

## ✅ Проверка работы

### Проверка Frontend

```bash
# Health check
curl http://localhost:3001/api/health

# Статус контейнера
docker-compose ps

# Логи
docker-compose logs -f universe
```

### Проверка Backend

```bash
# Health check
curl http://localhost:8000/health

# API документация
curl http://localhost:8000/docs

# Проверка API
curl http://localhost:8000/api/datalab/projects?limit=5&offset=0
```

### Проверка связи Frontend ↔ Backend

```bash
# Из контейнера frontend
docker exec civilx-universe curl http://host.docker.internal:8000/health

# Извне
curl -H "Origin: http://95.163.230.61:3001" http://95.163.230.61:8000/api/datalab/projects
```

## 🐛 Устранение проблем

### Frontend не запускается

```bash
# Проверить логи
docker-compose logs universe

# Проверить конфигурацию
docker-compose config

# Пересоздать контейнер
docker-compose down
docker-compose up -d
```

### Backend не отвечает

```bash
# Проверить процесс
ps aux | grep uvicorn

# Проверить логи
tail -50 /opt/civilx-backend/backend.log

# Проверить порт
netstat -tulpn | grep 8000

# Перезапустить
pkill -f uvicorn
cd /opt/civilx-backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

### Ошибка авторизации в GHCR

```bash
# Выйти и войти заново
docker logout ghcr.io
source .env
echo "$GITHUB_TOKEN" | docker login ghcr.io -u f1bonacci66 --password-stdin
```

### CORS ошибки

Проверить настройки CORS в `backend/app/main.py`:

```python
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://95.163.230.61:3001",
    "http://95.163.230.61:3000"
]
```

## 📚 Дополнительные материалы

- [Быстрый деплой](QUICK_DEPLOY.md)
- [Деплой из Registry](DEPLOY_FROM_REGISTRY.md)
- [Docker настройка](DOCKER.md)
- [Решение проблем](../../troubleshooting/TROUBLESHOOTING.md)




